import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { FileUpload, TransferFailedEvent, ChunkRetryEvent, ChunkAcknowledgedEvent } from "../types";
import { downloadManager } from "../utils/streaming";
import { startTransfer, updateTransfer, getTransferSpeed, endTransfer } from "../utils/performance";
import { compressChunk, decompressChunk } from "../utils/compression";
import { config } from "../config/app.config";

export const useFileTransfer = (socket: Socket | null, clientId: string, shareId: string) => {
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentDownloadFileName, setCurrentDownloadFileName] = useState("");
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);

  const [useCompression] = useState(true);

  const uploadFileRefs = useRef<Map<string, { offset: number; file: File }>>(new Map());
  const fileNamesRef = useRef<Map<string, string>>(new Map());

  // New state for chunk acknowledgment system
  const [failedUploads, setFailedUploads] = useState<Map<string, { reason: string; failedChunks: number[] }>>(new Map());
  const [retryingChunks, setRetryingChunks] = useState<Map<string, number[]>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const onChunkUploaded = (data: any) => {
      setFileUploads((prev) =>
        prev.map((f) =>
          f.fileId === data.fileId && f.status !== 'completed' && f.status !== 'uploaded'
            ? { ...f, progress: data.progress }
            : f
        )
      );

      const speed = getTransferSpeed(data.fileId);
      if (speed > 0) setUploadSpeed(speed);
    };

    const onUploadComplete = (data: any) => {
      console.log("Upload complete:", data.fileName);
      if (data.fileId) {
        uploadFileRefs.current.delete(data.fileId);
        endTransfer(data.fileId);
      }
      setFileUploads((prev) =>
        prev.map((f) =>
          (f.fileId === data.fileId || f.file.name === data.fileName) && f.status !== 'completed'
            ? { ...f, progress: 100, status: "uploaded" as const }
            : f
        )
      );
      setUploadSpeed(0);
    };

    const onDownloadConfirmed = (data: any) => {
      console.log("Download confirmed:", data.fileName);
      setFileUploads((prev) =>
        prev.map((f) =>
          f.fileId === data.fileId || f.file.name === data.fileName
            ? { ...f, progress: 100, status: "completed" as const }
            : f
        )
      );
    };

    const onFileTransferStarted = (data: any) => {
      console.log("File transfer started:", data.fileName);
      fileNamesRef.current.set(data.fileId, data.fileName);

      downloadManager.createDownload(
        data.fileId,
        data.fileName,
        data.totalChunks,
        {
          onProgress: (progress) => setDownloadProgress(progress),
          onComplete: () => {
            setDownloadedFiles((prev) => [...prev, data.fileName]);
            endTransfer(data.fileId);
            setDownloadSpeed(0);
            setDownloadProgress(0);
            setCurrentDownloadFileName("");
            fileNamesRef.current.delete(data.fileId);

            socket.emit("download-confirmed", {
              fileId: data.fileId,
              fileName: data.fileName,
              shareId: shareId,
            });
          },
          onError: (error) => {
            console.error("Download error:", error);
            setDownloadSpeed(0);
          },
        }
      );

      startTransfer(data.fileId);
      setCurrentDownloadFileName(data.fileName);
      setDownloadProgress(0);
    };

    const onChunkReceived = async (data: any) => {
      const download = downloadManager.getDownload(data.fileId);
      if (!download) return;

      let chunkData = data.chunk;
      // Handle Node.js Buffer JSON representation (from Redis Pub/Sub)
      if (chunkData && chunkData.type === 'Buffer' && Array.isArray(chunkData.data)) {
        chunkData = new Uint8Array(chunkData.data).buffer;
      }

      const decompressedChunk = useCompression
        ? decompressChunk(chunkData)
        : chunkData;

      download.addChunk(data.chunkIndex, decompressedChunk);
      updateTransfer(data.fileId, decompressedChunk.byteLength);

      const speed = getTransferSpeed(data.fileId);
      if (speed > 0) setDownloadSpeed(speed);
    };

    // Chunk acknowledged handler
    const onChunkAcknowledged = (data: ChunkAcknowledgedEvent) => {
      console.log(`Chunk ${data.chunkIndex} acknowledged for ${data.fileId}`);
      setRetryingChunks(prev => {
        const newMap = new Map(prev);
        const chunks = newMap.get(data.fileId);
        if (chunks) {
          newMap.set(data.fileId, chunks.filter(c => c !== data.chunkIndex));
        }
        return newMap;
      });
    };

    // Transfer failed handler
    const onTransferFailed = async (data: TransferFailedEvent) => {
      console.error(`Transfer failed for ${data.fileId}:`, data.reason);

      setFailedUploads(prev => new Map(prev).set(data.fileId, {
        reason: data.reason,
        failedChunks: data.failedChunks
      }));

      setFileUploads(prev => prev.map(f =>
        f.fileId === data.fileId ? { ...f, status: 'error' as const } : f
      ));
    };

    // Chunk retry handler
    const onChunkRetry = (data: ChunkRetryEvent) => {
      console.warn(`Retrying chunk ${data.chunkIndex} for ${data.fileId} (attempt ${data.attempt})`);

      setRetryingChunks(prev => {
        const chunks = prev.get(data.fileId) || [];
        if (!chunks.includes(data.chunkIndex)) {
          return new Map(prev).set(data.fileId, [...chunks, data.chunkIndex]);
        }
        return prev;
      });
    };

    socket.on("chunk-uploaded", onChunkUploaded);
    socket.on("upload-complete", onUploadComplete);
    socket.on("download-confirmed", onDownloadConfirmed);
    socket.on("file-transfer-started", onFileTransferStarted);
    socket.on("chunk-received", onChunkReceived);
    socket.on("chunk-acknowledged", onChunkAcknowledged);
    socket.on("transfer-failed", onTransferFailed);
    socket.on("chunk-retry", onChunkRetry);

    // Debug: Check if listeners are attached
    console.log("FileTransfer listeners attached to socket:", socket.id);

    return () => {
      console.log("FileTransfer listeners detached from socket:", socket.id);
      socket.off("chunk-uploaded", onChunkUploaded);
      socket.off("upload-complete", onUploadComplete);
      socket.off("download-confirmed", onDownloadConfirmed);
      socket.off("file-transfer-started", onFileTransferStarted);
      socket.off("chunk-received", onChunkReceived);
      socket.off("chunk-acknowledged", onChunkAcknowledged);
      socket.off("transfer-failed", onTransferFailed);
      socket.off("chunk-retry", onChunkRetry);
    };
  }, [socket, shareId, useCompression, clientId]);

  const uploadFile = async (file: File, fileIndex: number) => {
    if (!socket) return;

    const chunkSize = config.CHUNK_SIZE;
    const concurrency = config.UPLOAD_CONCURRENCY;
    const totalChunks = Math.ceil(file.size / chunkSize);

    socket.emit("upload-init", {
      clientId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
    });

    socket.once("upload-init-response", async ({ fileId }: any) => {
      uploadFileRefs.current.set(fileId, { offset: 0, file });

      startTransfer(fileId);
      setFileUploads((prev) =>
        prev.map((f, idx) =>
          idx === fileIndex ? { ...f, status: "uploading" as const, fileId } : f
        )
      );

      const sendChunk = async () => {
        const ref = uploadFileRefs.current.get(fileId);
        if (!ref) return;

        const currentOffset = ref.offset;
        if (currentOffset >= file.size) return;

        ref.offset += chunkSize;
        uploadFileRefs.current.set(fileId, ref);

        const chunk = file.slice(currentOffset, currentOffset + chunkSize);
        const arrayBuffer = await chunk.arrayBuffer();

        const processedChunk = useCompression
          ? compressChunk(arrayBuffer)
          : new Uint8Array(arrayBuffer);

        const chunkData = {
          fileId,
          chunkIndex: Math.floor(currentOffset / chunkSize),
          chunk: processedChunk.buffer,
          clientId,
        };

        socket.emit("upload-chunk", chunkData, (response: any) => {
          if (response?.error) {
            console.error("Upload chunk error:", response.error);
            return;
          }

          updateTransfer(fileId, arrayBuffer.byteLength);
          const speed = getTransferSpeed(fileId);
          if (speed > 0) setUploadSpeed(speed);

          sendChunk();
        });
      };

      for (let i = 0; i < concurrency; i++) sendChunk();
    });
  };

  const initiateUploads = () => {
    fileUploads.forEach((f, index) => {
      if (f.status === 'pending') {
        uploadFile(f.file, index);
      }
    });
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (files) {
      const newUploads = Array.from(files).map(file => ({
        file,
        progress: 0,
        status: 'pending' as const
      }));
      setFileUploads(newUploads);
    }
  };

  const resetState = () => {
    setFileUploads([]);
    setDownloadProgress(0);
    setCurrentDownloadFileName("");
    setFailedUploads(new Map());
    setRetryingChunks(new Map());
  };

  const dismissError = (fileId: string) => {
    setFailedUploads(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  };

  return {
    fileUploads,
    downloadProgress,
    currentDownloadFileName,
    downloadedFiles,
    uploadSpeed,
    downloadSpeed,
    handleFilesSelected,
    initiateUploads,
    resetState,
    useCompression,
    failedUploads,
    retryingChunks,
    dismissError
  };
};
