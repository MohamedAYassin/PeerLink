import { PrismaService } from "./prisma.service";
import { NodeService } from "./node.service";
import { SessionService } from "./session.service";
import { PubSubService, PubSubChannels } from "./pubsub.service";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Logger } from "../utils/logger.utils";
import { createRedisClient } from "../config/redis.config";
import { storageRepository } from "../repositories/storage.repository";
import { config } from "../config/app.config";

/**
 * ClusterManager - Central coordinator for all cluster operations
 * Manages lifecycle of all cluster services and cross-node communication
 */
export class ClusterManager {
  private static instance: ClusterManager | null = null;

  // Services
  private prisma = PrismaService.getInstance();
  private nodeService = new NodeService();
  private sessionService = new SessionService();
  private pubSubService = new PubSubService();

  // Socket.IO server instance
  private io: SocketIOServer | null = null;

  // Current node info
  private nodeId: string | null = null;
  private isMaster: boolean = false;
  private electionInterval: NodeJS.Timeout | null = null;
  // Local cache of clients connected to this node
  private localClients = new Map<string, string>(); // clientId -> socketId
  private redisClient: any = null;

  private constructor() { }

  /**
   * Get singleton instance
   */
  static getInstance(): ClusterManager {
    if (!this.instance) {
      this.instance = new ClusterManager();
    }
    return this.instance;
  }

  /**
   * Initialize the cluster manager
   */
  async initialize(
    hostname: string,
    port: number,
    io: SocketIOServer
  ): Promise<void> {
    try {
      console.log(`Initializing Cluster Manager (Mode: ${config.useCluster ? 'Cluster' : 'Standalone'})...`);

      // Store Socket.IO instance
      this.io = io;

      // Connect to database
      await PrismaService.connect();

      // Register this node (Required for Session relations)
      this.nodeId = await this.nodeService.register(hostname, port);

      if (config.useCluster) {
        // Initialize Redis for Election & PubSub
        if (config.useRedis) {
          await this.pubSubService.initialize();
          this.redisClient = await createRedisClient();
          this.setupPubSubHandlers();
        }

        // Start Master Election
        this.startElection();
      } else {
        // Standalone Mode: Always Master, No Redis/PubSub needed for clustering
        this.isMaster = true;
        await this.nodeService.updateRole(this.nodeId, "master");
        console.log("Standalone mode: Node is Master");
      }

      console.log("Cluster Manager initialized successfully");
    } catch (error) {
      Logger.error(error, "Failed to initialize Cluster Manager");
      throw error;
    }
  }

  /**
   * Leader Election Logic
   * Tries to acquire a 'master' lock in Redis.
   */
  private startElection() {
    const ELECTION_INTERVAL = 5000; // 5 seconds
    const MASTER_TTL = 15; // 15 seconds (Redis key expiration)

    const tryBecomeMaster = async () => {
      if (!this.nodeId || !this.redisClient) return;

      try {
        // Try to set 'cluster:master' key if it doesn't exist (NX)
        const result = await this.redisClient.set(
          "cluster:master",
          this.nodeId,
          {
            NX: true,
            EX: MASTER_TTL,
          }
        );

        if (result === "OK") {
          if (!this.isMaster) {
            console.log("I am now the Master Node!");
            this.isMaster = true;
            await this.nodeService.updateRole(this.nodeId, "master");
            this.notifyLocalClientsOfRoleChange("master");
          }
        } else {
          // Key exists, check if I am the master (refresh TTL)
          const currentMaster = await this.redisClient.get("cluster:master");
          if (currentMaster === this.nodeId) {
            await this.redisClient.expire("cluster:master", MASTER_TTL);
            if (!this.isMaster) {
              this.isMaster = true;
              await this.nodeService.updateRole(this.nodeId, "master");
              this.notifyLocalClientsOfRoleChange("master");
            }
          } else {
            if (this.isMaster) {
              console.log("I lost Master status.");
              this.isMaster = false;
              await this.nodeService.updateRole(this.nodeId, "worker");
              this.notifyLocalClientsOfRoleChange("worker");
            }
            // Optional: Log who is master?
          }
        }
      } catch (error) {
        console.error("Election error:", error);
      }
    };

    // Run immediately then interval
    tryBecomeMaster();
    this.electionInterval = setInterval(tryBecomeMaster, ELECTION_INTERVAL);
  }

  /**
   * Notify local clients about role change
   */
  private notifyLocalClientsOfRoleChange(role: "master" | "worker") {
    if (this.io) {
      this.io.emit("cluster-role-change", {
        nodeId: this.nodeId,
        role,
        isMaster: role === "master"
      });
    }
  }

  /**
   * Set up Pub/Sub event handlers for cross-node communication
   */
  private setupPubSubHandlers(): void {
    // Handle session events
    this.pubSubService.subscribe(
      PubSubChannels.SESSION_CREATED,
      async (data: any) => {
        console.log(
          `Client session created: ${data.clientId} on node ${data.nodeId}`
        );
      }
    );

    this.pubSubService.subscribe(
      PubSubChannels.SESSION_ENDED,
      async (data: any) => {
        console.log(`Client session ended: ${data.clientId}`);
      }
    );

    // Handle message routing between nodes
    this.pubSubService.subscribe(
      PubSubChannels.MESSAGE_ROUTE,
      async (data: any) => {
        // Route message to specific socket on this node
        if (data.targetNodeId === this.nodeId && this.io) {
          let socket = this.io.sockets.sockets.get(data.socketId);

          // Fallback: If socketId not found, try looking up by clientId
          if (!socket && data.targetClientId) {
            const localSocketId = this.localClients.get(data.targetClientId);
            if (localSocketId) {
              socket = this.io.sockets.sockets.get(localSocketId);
              if (socket) {
                console.log(
                  `Recovered routing for ${data.targetClientId} using local cache (Old: ${data.socketId}, New: ${localSocketId})`
                );
              }
            }
          }

          if (socket) {
            socket.emit(data.event, data.payload);
          } else {
            console.warn(
              `Failed to route message to ${
                data.targetClientId || "unknown"
              } (Socket ${data.socketId} not found)`
            );
          }
        }
      }
    );

    // Handle routing requests (Master Node Only)
    this.pubSubService.subscribe(
      PubSubChannels.ROUTING_REQUEST,
      async (data: any) => {
        // Only Master should process these requests
        if (!this.isMaster) return;

        console.log(`Master routing request for user: ${data.targetClientId}`);

        // 1. Lookup where the target user is connected
        const sessions = await this.sessionService.getClientSessions(
          data.targetClientId
        );

        if (sessions.length === 0) {
          // Optional: Notify sender that user is offline?
          // For now, we just drop it or log it.
          console.warn(`User ${data.targetClientId} not found for routing.`);
          return;
        }

        // 2. Dispatch message to all active sessions of that user
        for (const session of sessions) {
          // If target is on this Master node, send directly
          if (session.nodeId === this.nodeId && this.io) {
            const socket = this.io.sockets.sockets.get(session.socketId);
            if (socket) {
              socket.emit(data.event, data.payload);
            }
          } else {
            // If target is on another node, publish to MESSAGE_ROUTE channel
            // This sends it to the specific Worker Node
            if (this.pubSubService.isReady()) {
              await this.pubSubService.publish(PubSubChannels.MESSAGE_ROUTE, {
                targetNodeId: session.nodeId,
                socketId: session.socketId,
                event: data.event,
                payload: data.payload,
              });
            }
          }
        }
      }
    );

    console.log("Pub/Sub handlers configured");
  }

  /**
   * Handle client connection
   */
  async handleClientConnect(
    socket: Socket,
    clientId: string,
    username?: string
  ): Promise<void> {
    try {
      // Create session in database with clientId
      const session = await this.sessionService.createSession(
        clientId,
        this.nodeId!,
        socket.id,
        {
          clientId,
          username: username || `client_${clientId}`,
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers["user-agent"],
        }
      );

      // Publish session created event
      if (this.pubSubService.isReady()) {
        await this.pubSubService.publish(PubSubChannels.SESSION_CREATED, {
          clientId,
          nodeId: this.nodeId,
          socketId: socket.id,
        });
      }

      // Cache locally for fast routing
      this.localClients.set(clientId, socket.id);

      console.log(`Client connected: ${clientId} (Session: ${session.id})`);
    } catch (error) {
      Logger.error(error, "Error handling client connect");
    }
  }

  /**
   * Handle client disconnection
   */
  async handleClientDisconnect(socketId: string): Promise<void> {
    try {
      // Get session (needed to know who disconnected)
      const session = await this.sessionService.getSessionBySocketId(socketId);

      if (session) {
        // Remove session
        await this.sessionService.removeSession(socketId);

        // Publish session ended event
        if (this.pubSubService.isReady()) {
          await this.pubSubService.publish(PubSubChannels.SESSION_ENDED, {
            clientId: session.clientId,
            nodeId: this.nodeId,
            socketId,
          });
        }

        // Remove from local cache
        this.localClients.delete(session.clientId);

        console.log(`Client disconnected: ${socketId}`);
      }
    } catch (error) {
      Logger.error(error, "Error handling client disconnect");
    }
  }

  /**
   * Handle share creation
   */
  async handleShareCreate(
    clientId: string,
    shareCode: string,
    metadata: any = {}
  ): Promise<any> {
    try {
      // Share model removed from DB - ephemeral only now.
      const share = { id: shareCode, shareCode, clientId, metadata };

      // Publish share created event
      if (this.pubSubService.isReady()) {
        await this.pubSubService.publish(PubSubChannels.SHARE_CREATED, {
          shareId: share.id,
          shareCode,
          clientId,
          nodeId: this.nodeId,
        });
      }

      return share;
    } catch (error) {
      Logger.error(error, "Error creating share");
      throw error;
    }
  }





  /**
   * Route message to client (cross-node aware)
   * Worker -> Master -> Target Worker logic implemented here.
   */
  async routeMessageToClient(
    clientId: string,
    event: string,
    payload: any
  ): Promise<void> {
    try {
      console.log(`Routing ${event} to ${clientId} (Node: ${this.nodeId})`);

      // 1. Try Local Delivery (Fastest, In-Memory)
      const localSocketId = this.localClients.get(clientId);
      if (localSocketId && this.io) {
        const socket = this.io.sockets.sockets.get(localSocketId);
        if (socket) {
          socket.emit(event, payload);
          console.log(`Delivered locally to ${clientId} (${localSocketId})`);
          return; // Delivered locally
        } else {
          // Inconsistency found, remove from map
          console.warn(`Local socket ${localSocketId} not found for ${clientId}, removing from cache`);
          this.localClients.delete(clientId);
        }
      } else {
        console.log(`Client ${clientId} not in local cache`);
      }

      // 2. Try Direct Worker-to-Worker Routing (via Redis Session Lookup)
      // This avoids the Master node bottleneck
      const session = await storageRepository.getClientSession(clientId);
      if (session && session.nodeId) {
        console.log(`Found session for ${clientId}: Node ${session.nodeId}, Socket ${session.socketId}`);
        
        if (session.nodeId === this.nodeId) {
          // Should have been caught by local delivery, but just in case
          if (this.io) {
            const socket = this.io.sockets.sockets.get(session.socketId);
            if (socket) {
                socket.emit(event, payload);
                console.log(`Delivered locally (via Redis lookup) to ${clientId} (${session.socketId})`);
            } else {
                console.warn(`Socket ${session.socketId} not found locally despite Redis saying so`);
            }
          }
          return;
        }

        if (this.pubSubService.isReady()) {
          // Route directly to the target worker node
          console.log(`Routing to remote node ${session.nodeId} via PubSub`);
          await this.pubSubService.publish(PubSubChannels.MESSAGE_ROUTE, {
            targetNodeId: session.nodeId,
            targetClientId: clientId,
            socketId: session.socketId,
            event,
            payload,
          });
          return;
        }
      } else {
          console.warn(`No session found for ${clientId} in Redis`);
      }

      // 3. Fallback: Handle Routing based on Role
      if (!this.isMaster) {
        // WORKER: Delegate routing to Master
        if (this.pubSubService.isReady()) {
          console.log(`Requesting Master routing for ${clientId}`);
          await this.pubSubService.publish(PubSubChannels.ROUTING_REQUEST, {
            targetClientId: clientId,
            event,
            payload,
          });
        } else {
          console.warn(`PubSub not ready, cannot route to ${clientId}`);
        }
      } else {
        // MASTER: Query Database (Source of Truth)
        console.log(`Master Looking up route for ${clientId}`);
        const sessions = await this.sessionService.getClientSessions(clientId);

        if (sessions.length === 0) {
          console.warn(`No sessions found for client ${clientId}`);
          return;
        }

        for (const session of sessions) {
          // Note: If Master is the target node, it should have been caught by step 1
          // unless it's a race condition or disconnected.
          // But strictly speaking, Master also acts as a Node.

          if (session.nodeId === this.nodeId) {
            // Re-check local if DB says it's here (maybe local cache missed?)
            if (this.io) {
              const socket = this.io.sockets.sockets.get(session.socketId);
              if (socket) {
                socket.emit(event, payload);
              }
            }
          } else {
            // Remote delivery via PubSub to specific Worker Node
            if (this.pubSubService.isReady()) {
              await this.pubSubService.publish(PubSubChannels.MESSAGE_ROUTE, {
                targetNodeId: session.nodeId,
                targetClientId: clientId,
                socketId: session.socketId,
                event,
                payload,
              });
            }
          }
        }
      }
    } catch (error) {
      Logger.error(error, "Error routing message");
    }
  }

  /**
   * Get cluster statistics
   */
  async getClusterStats(): Promise<any> {
    try {
      const [nodes, sessionStats] = await Promise.all([
        this.nodeService.getActiveNodes(),
        this.sessionService.getSessionStats(),
      ]);

      return {
        role: this.isMaster ? "master" : "worker",
        nodeId: this.nodeId,
        nodes: {
          total: nodes.length,
          active: nodes.filter((n: any) => n.status === "active").length,
          list: nodes,
        },
        sessions: sessionStats,
      };
    } catch (error) {
      console.error("Error getting cluster stats:", error);
      return null;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      console.log("Shutting down Cluster Manager...");

      if (this.electionInterval) clearInterval(this.electionInterval);
      if (this.redisClient) await this.redisClient.quit();

      // Deregister node
      if (this.nodeId) {
        await this.nodeService.deregister();
      }

      // Disconnect pub/sub
      if (this.pubSubService.isReady()) {
        await this.pubSubService.disconnect();
      }

      // Disconnect from database
      await PrismaService.disconnect();

      console.log("Cluster Manager shut down successfully");
    } catch (error) {
      console.error("Error during shutdown:", error);
    }
  }

  // Getters for services
  getNodeService() {
    return this.nodeService;
  }
  getSessionService() {
    return this.sessionService;
  }

  getPubSubService() {
    return this.pubSubService;
  }
  getNodeId() {
    return this.nodeId;
  }
  getIsMaster() {
    return this.isMaster;
  }

  /**
   * Get the current master node ID from Redis
   */
  async getCurrentMasterId(): Promise<string | null> {
    if (!this.redisClient) return null;
    try {
      return await this.redisClient.get("cluster:master");
    } catch (error) {
      console.error("Error getting current master ID:", error);
      return null;
    }
  }
}
