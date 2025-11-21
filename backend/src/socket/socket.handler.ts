import { Server, Socket } from "socket.io";
import { storageRepository } from "../repositories/storage.repository";
import { ClusterManager } from "../services/cluster.service";
import { ErrorFactory, safeHandler } from "../utils/error.utils";
import { config } from "../config/app.config";
import { webhookService } from "../services/webhook.service";
import { simdChecksum } from "../native";
import { Logger } from "../utils/logger.utils";
import { statsService } from "../services/stats.service";

export class SocketHandler {
  private io: Server;
  private clusterManager = ClusterManager.getInstance();

  constructor(io: Server) {
    this.io = io;
    this.initialize();
    this.startAckTimeoutChecker();
  }

  private initialize() {
    this.io.on("connection", (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.handleConnection(socket);
    });
  }

  /**
   * Start periodic checker for unacknowledged chunks
   */
  private startAckTimeoutChecker() {
    const ACK_TIMEOUT_MS = config.ackTimeout;
    const MAX_RETRIES = config.maxRetries;
    const CHECK_INTERVAL_MS = config.ackCheckInterval;

    setInterval(async () => {
      const uploads = await storageRepository.getAllUploadStates();
      const now = Date.now();

      for (const [fileId, upload] of uploads) {
        if (
          upload.status !== "uploading" ||
          !upload.pendingAcks ||
          upload.pendingAcks.size === 0
        ) {
          continue;
        }

        const timedOutChunks: number[] = [];
        const failedChunks: number[] = [];

        for (const [chunkIndex, ackInfo] of upload.pendingAcks) {
          const age = now - ackInfo.timestamp;

          if (age > ACK_TIMEOUT_MS) {
            if (ackInfo.retries >= MAX_RETRIES) {
              // Too many retries - mark as failed
              failedChunks.push(chunkIndex);
            } else {
              // Retry
              timedOutChunks.push(chunkIndex);
              ackInfo.retries++;
              ackInfo.timestamp = now;
            }
          }
        }

        // Handle retries
        if (timedOutChunks.length > 0) {
          const session = await storageRepository.getClientSession(
            upload.clientId
          );
          if (session) {
            const socket = this.io.sockets.sockets.get(session.socketId);
            if (socket) {
              for (const chunkIndex of timedOutChunks) {
                socket.emit("chunk-retry", {
                  fileId,
                  chunkIndex,
                  attempt: upload.pendingAcks!.get(chunkIndex)!.retries,
                });
                console.log(
                  `Chunk ${chunkIndex} retry for ${fileId} (attempt ${upload.pendingAcks!.get(chunkIndex)!.retries})`
                );
              }
            }
          }
        }

        // Handle failures
        if (failedChunks.length > 0) {
          upload.status = "failed";
          await storageRepository.setUploadState(fileId, upload);

          const session = await storageRepository.getClientSession(
            upload.clientId
          );
          if (session) {
            const socket = this.io.sockets.sockets.get(session.socketId);
            if (socket) {
              socket.emit("transfer-failed", {
                fileId,
                reason: `Failed to deliver ${failedChunks.length} chunk(s) after ${MAX_RETRIES} retries. Master node may be down.`,
                failedChunks,
              });
              console.error(
                `Transfer failed: ${fileId} (chunks ${failedChunks.join(", ")} not acknowledged)`
              );
            }
          }

          await webhookService.triggerWebhook("upload-cancelled", {
            fileId,
            fileName: upload.fileName,
            reason: "Chunk acknowledgment timeout",
            clientId: upload.clientId,
          });
        }

        // Save updated ack info
        if (timedOutChunks.length > 0 && failedChunks.length === 0) {
          await storageRepository.setUploadState(fileId, upload);
        }
      }
    }, CHECK_INTERVAL_MS);
  }

  private handleConnection(socket: Socket) {
    // Register client
    socket.on(
      "register",
      safeHandler(async (clientId: string, username?: string) => {
        console.log(
          `Registering client: ${clientId}, username: ${username}`
        );

        const session = {
          clientId,
          socketId: socket.id,
          nodeId: this.clusterManager.getNodeId() || undefined,
          connected: true,
          lastHeartbeat: Date.now(),
          uploads: [],
          downloads: [],
          uploadSpeed: 0,
          downloadSpeed: 0,
        };

        await storageRepository.setClientSession(clientId, session);
        storageRepository.setActiveConnection(clientId, socket);

        // Always register in database (for cluster sync)
        try {
          console.log(`Creating database session for ${clientId}...`);
          await this.clusterManager.handleClientConnect(
            socket,
            clientId,
            username
          );
          console.log(`Database session created for ${clientId}`);
        } catch (error) {
          // Log error but don't crash
          Logger.error(
            error,
            `Failed to register client ${clientId} in database`
          );
        }

        socket.emit("registered", { 
          clientId, 
          socketId: socket.id,
          nodeId: this.clusterManager.getNodeId(),
          isMaster: this.clusterManager.getIsMaster(),
          masterId: await this.clusterManager.getCurrentMasterId()
        });
        await webhookService.triggerWebhook("client-connected", {
          clientId,
          socketId: socket.id,
        });
        console.log(`Client registered: ${clientId}`);
      })
    );

    // Get cluster info
    socket.on(
      "get-cluster-info",
      safeHandler(async () => {
        socket.emit("cluster-info", {
          nodeId: this.clusterManager.getNodeId(),
          isMaster: this.clusterManager.getIsMaster()
        });
      })
    );

    // Heartbeat
    socket.on(
      "heartbeat",
      safeHandler(async (clientId: string) => {
        const rateLimit = await storageRepository.checkRateLimit(
          `heartbeat:${clientId}`,
          config.rateLimitMessages
        );

        if (!rateLimit.allowed) {
          socket.emit("rate-limited", { resetAt: rateLimit.resetAt });
          return;
        }

        const session = await storageRepository.getClientSession(clientId);
        if (session) {
          session.lastHeartbeat = Date.now();
          await storageRepository.setClientSession(clientId, session);
          socket.emit("heartbeat-ack");
        }
      })
    );

    // Upload initialization
    socket.on(
      "upload-init",
      safeHandler(
        async (data: {
          clientId: string;
          fileName: string;
          fileSize: number;
          totalChunks: number;
        }) => {
          // Rate limiting
          const rateLimit = await storageRepository.checkRateLimit(
            `upload:${data.clientId}`,
            config.rateLimitUploads
          );

          if (!rateLimit.allowed) {
            socket.emit("rate-limited", { resetAt: rateLimit.resetAt });
            return;
          }

          // Check concurrent uploads
          const allUploads = await storageRepository.getAllUploadStates();
          let activeUploads = 0;
          for (const u of allUploads.values()) {
            if (u.clientId === data.clientId && u.status === "uploading") {
              activeUploads++;
            }
          }

          if (activeUploads >= config.maxConcurrentUploads) {
            throw ErrorFactory.uploadFailed(
              `Too many concurrent uploads (max ${config.maxConcurrentUploads})`
            );
          }

          // Check concurrent transfers (Sender)
          const senderSession = await storageRepository.getClientSession(data.clientId);
          const senderActiveDownloads = senderSession?.downloads?.length || 0;
          if (activeUploads + senderActiveDownloads >= config.maxConcurrentTransfers) {
             throw ErrorFactory.uploadFailed(
              `Too many concurrent transfers (max ${config.maxConcurrentTransfers})`
            );
          }

          // Validation
          if (data.fileSize > config.maxFileSize) {
            throw ErrorFactory.fileTooLarge(data.fileSize, config.maxFileSize);
          }

          const fileId = `file-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;

          const upload = {
            fileId,
            fileName: data.fileName,
            fileSize: data.fileSize,
            totalChunks: data.totalChunks,
            uploadedChunks: new Set<number>(),
            clientId: data.clientId,
            startTime: Date.now(),
            lastUpdate: Date.now(),
            status: "uploading" as const,
          };

          await storageRepository.setUploadState(fileId, upload);

          // Also create file in database if cluster is enabled
          if (config.useCluster) {
            try {
              const clientSession = await storageRepository.getClientSession(
                data.clientId
              );
              if (clientSession?.shareId) {
                // Get or create share in database
                const shareSession = await storageRepository.getShareSession(
                  clientSession.shareId
                );
                if (shareSession) {
                  // Just ensure share exists via handleShareCreate if needed,
                  // but we already check Redis.
                  // We can skip DB check for performance or do it async.
                  // Removed dbShare check because getFileService is removed and we trust Redis state + Create event

                }
              }
            } catch (error) {
              console.warn("Failed to create file in database:", error);
            }
          }

          // Notify other clients in share session that a file transfer is starting
          const clientSession = await storageRepository.getClientSession(
            data.clientId
          );
          
          const acceptedReceivers: string[] = [];

          if (clientSession?.shareId) {
            const shareSession = await storageRepository.getShareSession(
              clientSession.shareId
            );
            if (shareSession) {
              const otherClients = shareSession.clients.filter(
                (cid: string) => cid !== data.clientId
              );

              for (const otherClientId of otherClients) {
                // Check concurrent downloads for receiver
                const otherSession = await storageRepository.getClientSession(otherClientId);
                if (otherSession) {
                  // Initialize downloads array if missing
                  if (!otherSession.downloads) otherSession.downloads = [];
                  
                  // Check limit
                  if (otherSession.downloads.length >= config.maxConcurrentDownloads) {
                    console.warn(`Skipping transfer to ${otherClientId}: Too many concurrent downloads (${otherSession.downloads.length})`);
                    continue;
                  }

                  // Check concurrent transfers (Receiver)
                  let receiverActiveUploads = 0;
                  for (const u of allUploads.values()) {
                    if (u.clientId === otherClientId && u.status === "uploading") {
                      receiverActiveUploads++;
                    }
                  }

                  if (otherSession.downloads.length + receiverActiveUploads >= config.maxConcurrentTransfers) {
                    console.warn(`Skipping transfer to ${otherClientId}: Too many concurrent transfers`);
                    continue;
                  }

                  // Add to active downloads
                  otherSession.downloads.push(fileId);
                  await storageRepository.setClientSession(otherClientId, otherSession);
                  acceptedReceivers.push(otherClientId);
                }
              }
            }
          }

          // If there are potential receivers but none accepted, fail the upload
          // Note: If it's a solo upload (no share session or no other clients), we allow it (maybe for later download?)
          // But PeerLink is real-time P2P mostly.
          // If share session exists and has other clients, but all rejected -> Fail.
          if (clientSession?.shareId) {
             const shareSession = await storageRepository.getShareSession(clientSession.shareId);
             if (shareSession && shareSession.clients.length > 1 && acceptedReceivers.length === 0) {
                throw ErrorFactory.uploadFailed("All receivers are busy (too many concurrent transfers)");
             }
          }

          socket.emit("upload-init-response", {
            fileId,
            message: "Upload initialized",
            resumeFrom: [],
          });

          // Notify accepted receivers
          for (const receiverId of acceptedReceivers) {
             await this.clusterManager.routeMessageToClient(
                receiverId,
                "file-transfer-started",
                {
                  fileId,
                  fileName: data.fileName,
                  fileSize: data.fileSize,
                  totalChunks: data.totalChunks,
                }
              );
          }

          console.log(`Upload initialized: ${data.fileName} (${fileId})`);
        }
      )
    );

    // Upload chunk
    socket.on(
      "upload-chunk",
      safeHandler(
        async (
          data: {
            fileId: string;
            chunkIndex: number;
            chunk: Buffer;
            clientId: string;
            checksum?: string;
          },
          callback?: (response: any) => void
        ) => {
          const upload = await storageRepository.getUploadState(data.fileId);

          if (!upload) {
            if (callback) callback({ error: "Upload not found or cancelled" });
            throw ErrorFactory.uploadFailed("Upload not found or cancelled");
          }

          if (upload.status === "cancelled" || upload.status === "paused") {
            if (callback) callback({ error: "Upload cancelled or paused" });
            return;
          }

          // Add chunk to the Set (in-memory operation is fast)
          if (!upload.uploadedChunks.has(data.chunkIndex)) {
            upload.uploadedChunks.add(data.chunkIndex);
            upload.lastUpdate = Date.now();

            // Calculate checksum if enabled
            let chunkChecksum = "";
            if (config.useNativeAddon) {
              chunkChecksum = simdChecksum(data.chunk);
              if (!upload.chunkChecksums) {
                upload.chunkChecksums = new Map();
              }
              upload.chunkChecksums.set(data.chunkIndex, chunkChecksum);
            }

            // Track pending acknowledgment
            if (!upload.pendingAcks) {
              upload.pendingAcks = new Map();
            }
            upload.pendingAcks.set(data.chunkIndex, {
              timestamp: Date.now(),
              retries: 0,
            });
          }

          const progress =
            (upload.uploadedChunks.size / upload.totalChunks) * 100;

          // Emit upload progress
          socket.emit("chunk-uploaded", {
            fileId: data.fileId,
            chunkIndex: data.chunkIndex,
            progress: Math.round(progress),
            uploadedChunks: upload.uploadedChunks.size,
            totalChunks: upload.totalChunks,
          });

          // Forward chunk to other clients in the share session
          const clientSession = await storageRepository.getClientSession(
            data.clientId
          );
          if (clientSession?.shareId) {
            const shareSession = await storageRepository.getShareSession(
              clientSession.shareId
            );
            if (shareSession) {
              const otherClients = shareSession.clients.filter(
                (cid: string) => cid !== data.clientId
              );

              for (const otherClientId of otherClients) {
                // Check if this client is actually downloading this file
                // This prevents sending chunks to clients who were skipped due to rate limits
                const otherSession = await storageRepository.getClientSession(otherClientId);
                if (otherSession && otherSession.downloads && otherSession.downloads.includes(data.fileId)) {
                  // Always route via cluster manager
                  await this.clusterManager.routeMessageToClient(
                    otherClientId,
                    "chunk-received",
                    {
                      fileId: data.fileId,
                      chunkIndex: data.chunkIndex,
                      chunk: data.chunk,
                      totalChunks: upload.totalChunks,
                    }
                  );

                  // Send acknowledgment back to sender
                  // Note: In a multi-receiver scenario, we might get multiple ACKs.
                  // The sender logic currently handles ACKs by chunkIndex. 
                  // If ANY receiver ACKs, it might be considered ACKed?
                  // Or does it need ALL? The current logic just removes from pendingAcks on first ACK.
                  // This is a limitation of the current simple ACK system for multi-cast.
                  // For now, we relay ACKs.
                  await this.clusterManager.routeMessageToClient(
                    data.clientId,
                    "chunk-acknowledged",
                    {
                      fileId: data.fileId,
                      chunkIndex: data.chunkIndex,
                    }
                  );
                }
              }
            }
          }

          // Acknowledge receipt to allow uploader to send next chunk (Flow Control)
          if (callback) {
            callback({ success: true });
          }

          // Check if upload is complete (only check once)
          if (
            upload.uploadedChunks.size === upload.totalChunks &&
            upload.status !== "completed"
          ) {
            upload.status = "completed";
            await storageRepository.setUploadState(data.fileId, upload);

            const completionData = {
              fileId: data.fileId,
              fileName: upload.fileName,
              fileSize: upload.fileSize,
              duration: Date.now() - upload.startTime,
            };

            console.log(
              `Upload complete: ${upload.fileName} (${(
                upload.fileSize /
                1024 /
                1024
              ).toFixed(2)} MB in ${(completionData.duration / 1000).toFixed(
                2
              )}s)`
            );
            socket.emit("upload-complete", completionData);

            await webhookService.triggerWebhook("upload-complete", {
              fileId: data.fileId,
              fileName: upload.fileName,
              fileSize: upload.fileSize,
              duration: completionData.duration,
              clientId: data.clientId,
            });

            // Update persistent stats
            try {
              await statsService.incrementFilesSent();
            } catch (error) {
              Logger.error(error, "Failed to update stats");
            }

            await storageRepository.removeCancelledDownloads(data.fileId);
          }
        }
      )
    );

    // Chunk acknowledged (Receiver → Sender)
    socket.on(
      "chunk-acknowledged",
      safeHandler(async (data: { fileId: string; chunkIndex: number }) => {
        const upload = await storageRepository.getUploadState(data.fileId);
        if (!upload) return;

        // Remove from pending acks
        if (upload.pendingAcks) {
          upload.pendingAcks.delete(data.chunkIndex);
          upload.lastAckTime = Date.now();
          await storageRepository.setUploadState(data.fileId, upload);
        }

        console.log(
          `Chunk ${data.chunkIndex} acknowledged for ${data.fileId} (${upload.pendingAcks?.size || 0} pending)`
        );
      })
    );

    // Download confirmed
    socket.on(
      "download-confirmed",
      safeHandler(
        async (data: { fileId: string; fileName: string; shareId: string }) => {
          console.log(
            `Download confirmed: ${data.fileName} (${data.fileId})`
          );

          // Remove from active downloads for the downloader
          const allSessions = await storageRepository.getAllClientSessions();
          let downloaderClientId: string | null = null;

          for (const [clientId, session] of allSessions) {
            if (session.socketId === socket.id) {
              downloaderClientId = clientId;
              // Remove fileId from downloads
              if (session.downloads && session.downloads.includes(data.fileId)) {
                session.downloads = session.downloads.filter(id => id !== data.fileId);
                await storageRepository.setClientSession(clientId, session);
              }
              break;
            }
          }

          // Find the uploader using UploadState (Source of Truth)
          const upload = await storageRepository.getUploadState(data.fileId);
          if (upload && upload.clientId) {
            const uploaderClientId = upload.clientId;
            console.log(`Uploader identified from UploadState: ${uploaderClientId}`);

            // Notify the uploader that download is confirmed
            console.log(
              `Routing download-confirmed to ${uploaderClientId} via cluster`
            );
            await this.clusterManager.routeMessageToClient(
              uploaderClientId,
              "download-confirmed",
              {
                fileId: data.fileId,
                fileName: data.fileName,
              }
            );
          } else {
            console.warn(`Could not find upload state or uploader for file ${data.fileId}`);
            
            // Fallback to Share Session logic if UploadState is missing (e.g. expired)
            const shareSession = await storageRepository.getShareSession(data.shareId);
            if (shareSession && downloaderClientId) {
               const uploaderClientId = shareSession.clients.find(
                (cid: string) => cid !== downloaderClientId
              );
              if (uploaderClientId) {
                 console.log(`Fallback: Routing download-confirmed to ${uploaderClientId} via share session`);
                 await this.clusterManager.routeMessageToClient(
                  uploaderClientId,
                  "download-confirmed",
                  {
                    fileId: data.fileId,
                    fileName: data.fileName,
                  }
                );
              }
            }
          }

          await webhookService.triggerWebhook("download-complete", {
            fileId: data.fileId,
            fileName: data.fileName,
            shareId: data.shareId,
          });
        }
      )
    );

    // Cancel download
    socket.on(
      "cancel-download",
      safeHandler(async (data: { fileId: string; clientId: string }) => {
        await storageRepository.addCancelledDownload(
          data.fileId,
          data.clientId
        );

        // Remove from active downloads
        const session = await storageRepository.getClientSession(data.clientId);
        if (session && session.downloads && session.downloads.includes(data.fileId)) {
          session.downloads = session.downloads.filter(id => id !== data.fileId);
          await storageRepository.setClientSession(data.clientId, session);
        }

        socket.emit("download-cancelled", { fileId: data.fileId });

        const upload = await storageRepository.getUploadState(data.fileId);
        if (upload) {
          await webhookService.triggerWebhook("download-cancelled", {
            fileId: data.fileId,
            fileName: upload.fileName,
            clientId: data.clientId,
          });
        }

        console.log(
          `Download cancelled: ${data.fileId} by ${data.clientId}`
        );
      })
    );

    // Disconnect
    socket.on(
      "disconnect",
      safeHandler(async () => {
        console.log(`Client disconnected: ${socket.id}`);

        // Always handle disconnect in database
        try {
          await this.clusterManager.handleClientDisconnect(socket.id);
        } catch (error) {
          Logger.error(error, "Failed to handle database disconnect");
        }

        const sessions = await storageRepository.getAllClientSessions();
        for (const [clientId, session] of sessions) {
          if (session.socketId === socket.id) {
            // Notify other clients in the share session before disconnecting
            if (session.shareId) {
              const shareSession = await storageRepository.getShareSession(
                session.shareId
              );
              if (shareSession) {
                // Notify all other clients in the share
                const otherClients = shareSession.clients.filter(
                  (cid: string) => cid !== clientId
                );

                for (const otherClientId of otherClients) {
                  // Always route via cluster manager
                  await this.clusterManager.routeMessageToClient(
                    otherClientId,
                    "client-disconnected-from-share",
                    {
                      clientId,
                      shareId: session.shareId,
                    }
                  );
                }

                // Remove client from share session
                shareSession.clients = shareSession.clients.filter(
                  (cid: string) => cid !== clientId
                );
                if (shareSession.clients.length === 0) {
                  // Delete share session if no clients left
                  await storageRepository.deleteShareSession(session.shareId);
                  console.log(
                    `Deleted empty share session: ${session.shareId}`
                  );
                } else {
                  await storageRepository.setShareSession(
                    session.shareId,
                    shareSession
                  );
                }
              }
            }

            session.connected = false;
            await storageRepository.setClientSession(clientId, session);
            storageRepository.deleteActiveConnection(clientId);

            await webhookService.triggerWebhook("client-disconnected", {
              clientId,
              socketId: socket.id,
            });
            break;
          }
        }
      })
    );
  }
}
