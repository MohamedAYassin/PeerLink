import { useState, useEffect, useRef, useReducer } from "react";
import { Socket } from "socket.io-client";
import { FileUpload, TransferFailedEvent, ChunkRetryEvent, ChunkAcknowledgedEvent } from "../types";
import { downloadManager } from "../utils/streaming";
import { startTransfer, updateTransfer, getTransferSpeed, endTransfer } from "../utils/performance";
import { compressChunk, decompressChunk } from "../utils/compression";
import { config } from "../config/app.config";

type TransferState = {
  fileUploads: FileUpload[];
  downloadProgress: number;
  currentDownloadFileName: string;
  downloadedFiles: string[];
  uploadSpeed: number;
  downloadSpeed: number;
  failedUploads: Map<string, { reason: string; failedChunks: number[] }>;
  retryingChunks: Map<string, number[]>;
};

type TransferAction =
  | { type: "CHUNK_UPLOADED"; fileId: string; progress: number; speed: number }
  | { type: "UPLOAD_COMPLETE"; fileId: string; fileName: string }
  | { type: "DOWNLOAD_CONFIRMED"; fileId: string; fileName: string }
  | { type: "FILE_TRANSFER_STARTED"; fileId: string; fileName: string }
  | { type: "CHUNK_RECEIVED"; fileId: string; speed: number; progress?: number }
  | { type: "DOWNLOAD_COMPLETE"; fileName: string; fileId: string }
  | { type: "DOWNLOAD_ERROR" }
  | { type: "CHUNK_ACKNOWLEDGED"; fileId: string; chunkIndex: number }
  | { type: "TRANSFER_FAILED"; fileId: string; reason: string; failedChunks: number[] }
  | { type: "CHUNK_RETRY"; fileId: string; chunkIndex: number }
  | { type: "MARK_FILE_UPLOADING"; fileIndex: number; fileId: string }
  | { type: "SET_FILE_UPLOADS"; fileUploads: FileUpload[] }
  | { type: "DISMISS_ERROR"; fileId: string }
  | { type: "SET_UPLOAD_SPEED"; speed: number }
  | { type: "SET_DOWNLOAD_SPEED"; speed: number }
  | { type: "RESET" };

const initialTransferState: TransferState = {
  fileUploads: [],
  downloadProgress: 0,
  currentDownloadFileName: "",
  downloadedFiles: [],
  uploadSpeed: 0,
  downloadSpeed: 0,
  failedUploads: new Map(),
  retryingChunks: new Map(),
};

function transferReducer(state: TransferState, action: TransferAction): TransferState {
  switch (action.type) {
    case "CHUNK_UPLOADED":
      return {
        ...state,
        fileUploads: state.fileUploads.map((f) =>
          f.fileId === action.fileId && f.status !== "completed" && f.status !== "uploaded"
            ? { ...f, progress: action.progress }
            : f
        ),
        uploadSpeed: action.speed > 0 ? action.speed : state.uploadSpeed,
      };
    case "UPLOAD_COMPLETE":
      return {
        ...state,
        fileUploads: state.fileUploads.map((f) =>
          (f.fileId === action.fileId || f.file.name === action.fileName) && f.status !== "completed"
            ? { ...f, progress: 100, status: "uploaded" as const }
            : f
        ),
        uploadSpeed: 0,
      };
    case "DOWNLOAD_CONFIRMED":
      return {
        ...state,
        fileUploads: state.fileUploads.map((f) =>
          f.fileId === action.fileId || f.file.name === action.fileName
            ? { ...f, progress: 100, status: "completed" as const }
            : f
        ),
      };
    case "FILE_TRANSFER_STARTED":
      return {
        ...state,
        currentDownloadFileName: action.fileName,
        downloadProgress: 0,
      };
    case "CHUNK_RECEIVED":
      return {
        ...state,
        downloadProgress: typeof action.progress === "number" ? action.progress : state.downloadProgress,
        downloadSpeed: action.speed > 0 ? action.speed : state.downloadSpeed,
      };
    case "DOWNLOAD_COMPLETE":
      return {
        ...state,
        downloadedFiles: [...state.downloadedFiles, action.fileName],
        downloadSpeed: 0,
        downloadProgress: 0,
        currentDownloadFileName: "",
      };
    case "DOWNLOAD_ERROR":
      return {
        ...state,
        downloadSpeed: 0,
      };
    case "CHUNK_ACKNOWLEDGED":
      return {
        ...state,
        retryingChunks: (() => {
          const newMap = new Map(state.retryingChunks);
          const chunks = newMap.get(action.fileId);
          if (chunks) {
            const remaining = chunks.filter((c) => c !== action.chunkIndex);
            if (remaining.length === 0) {
              newMap.delete(action.fileId);
            } else {
              newMap.set(action.fileId, remaining);
            }
          }
          return newMap;
        })(),
      };
    case "TRANSFER_FAILED":
      return {
        ...state,
        failedUploads: new Map(state.failedUploads).set(action.fileId, {
          reason: action.reason,
          failedChunks: action.failedChunks,
        }),
        fileUploads: state.fileUploads.map((f) =>
          f.fileId === action.fileId ? { ...f, status: "error" as const } : f
        ),
      };
    case "CHUNK_RETRY":
      return {
        ...state,
        retryingChunks: (() => {
          const chunks = state.retryingChunks.get(action.fileId) || [];
          if (!chunks.includes(action.chunkIndex)) {
            return new Map(state.retryingChunks).set(action.fileId, [...chunks, action.chunkIndex]);
          }
          return state.retryingChunks;
        })(),
      };
    case "MARK_FILE_UPLOADING":
      return {
        ...state,
        fileUploads: state.fileUploads.map((f, idx) =>
          idx === action.fileIndex ? { ...f, status: "uploading" as const, fileId: action.fileId } : f
        ),
      };
    case "SET_FILE_UPLOADS":
      return { ...state, fileUploads: action.fileUploads };
    case "DISMISS_ERROR": {
      const newFailedUploads = new Map(state.failedUploads);
      newFailedUploads.delete(action.fileId);
      return { ...state, failedUploads: newFailedUploads };
    }
    case "SET_UPLOAD_SPEED":
      return { ...state, uploadSpeed: action.speed };
    case "SET_DOWNLOAD_SPEED":
      return { ...state, downloadSpeed: action.speed };
    case "RESET":
      return initialTransferState;
    default:
      return state;
  }
}

export const useFileTransfer = (socket: Socket | null, clientId: string, shareId: string) => {
  const [state, dispatch] = useReducer(transferReducer, initialTransferState);

  const useCompression = true;

  const uploadFileRefs = useRef<Map<string, { offset: number; file: File }>>(null!);
  if (!uploadFileRefs.current) uploadFileRefs.current = new Map();
  const fileNamesRef = useRef<Map<string, string>>(null!);
  if (!fileNamesRef.current) fileNamesRef.current = new Map();

  useEffect(() => {
    if (!socket) return;

    const onChunkUploaded = (data: any) => {
      const speed = getTransferSpeed(data.fileId);
      dispatch({ type: "CHUNK_UPLOADED", fileId: data.fileId, progress: data.progress, speed });
    };

    const onUploadComplete = (data: any) => {
      console.log("Upload complete:", data.fileName);
      if (data.fileId) {
        uploadFileRefs.current.delete(data.fileId);
        endTransfer(data.fileId);
      }
      dispatch({ type: "UPLOAD_COMPLETE", fileId: data.fileId, fileName: data.fileName });
    };

    const onDownloadConfirmed = (data: any) => {
      console.log("Download confirmed:", data.fileName);
      dispatch({ type: "DOWNLOAD_CONFIRMED", fileId: data.fileId, fileName: data.fileName });
    };

    const onFileTransferStarted = (data: any) => {
      console.log("File transfer started:", data.fileName);
      fileNamesRef.current.set(data.fileId, data.fileName);

      dispatch({ type: "FILE_TRANSFER_STARTED", fileId: data.fileId, fileName: data.fileName });

      downloadManager.createDownload(
        data.fileId,
        data.fileName,
        data.totalChunks,
        {
          onProgress: (progress) => dispatch({ type: "CHUNK_RECEIVED", fileId: data.fileId, speed: 0, progress }),
          onComplete: () => {
            dispatch({ type: "DOWNLOAD_COMPLETE", fileName: data.fileName, fileId: data.fileId });
            endTransfer(data.fileId);
            fileNamesRef.current.delete(data.fileId);

            socket.emit("download-confirmed", {
              fileId: data.fileId,
              fileName: data.fileName,
              shareId: shareId,
            });
          },
          onError: (error) => {
            console.error("Download error:", error);
            dispatch({ type: "DOWNLOAD_ERROR" });
          },
        }
      );

      startTransfer(data.fileId);
    };

    const onChunkReceived = async (data: any) => {
      const download = downloadManager.getDownload(data.fileId);
      if (!download) return;

      let chunkData = data.chunk;
      if (chunkData && chunkData.type === "Buffer" && Array.isArray(chunkData.data)) {
        chunkData = new Uint8Array(chunkData.data).buffer;
      }

      const decompressedChunk = useCompression ? decompressChunk(chunkData) : chunkData;

      download.addChunk(data.chunkIndex, decompressedChunk);
      updateTransfer(data.fileId, decompressedChunk.byteLength);

      const speed = getTransferSpeed(data.fileId);
      dispatch({ type: "CHUNK_RECEIVED", fileId: data.fileId, speed });
    };

    const onChunkAcknowledged = (data: ChunkAcknowledgedEvent) => {
      console.log(`Chunk ${data.chunkIndex} acknowledged for ${data.fileId}`);
      dispatch({ type: "CHUNK_ACKNOWLEDGED", fileId: data.fileId, chunkIndex: data.chunkIndex });
    };

    const onTransferFailed = async (data: TransferFailedEvent) => {
      console.error(`Transfer failed for ${data.fileId}:`, data.reason);
      dispatch({ type: "TRANSFER_FAILED", fileId: data.fileId, reason: data.reason, failedChunks: data.failedChunks });
    };

    const onChunkRetry = (data: ChunkRetryEvent) => {
      console.warn(`Retrying chunk ${data.chunkIndex} for ${data.fileId} (attempt ${data.attempt})`);
      dispatch({ type: "CHUNK_RETRY", fileId: data.fileId, chunkIndex: data.chunkIndex });
    };

    socket.on("chunk-uploaded", onChunkUploaded);
    socket.on("upload-complete", onUploadComplete);
    socket.on("download-confirmed", onDownloadConfirmed);
    socket.on("file-transfer-started", onFileTransferStarted);
    socket.on("chunk-received", onChunkReceived);
    socket.on("chunk-acknowledged", onChunkAcknowledged);
    socket.on("transfer-failed", onTransferFailed);
    socket.on("chunk-retry", onChunkRetry);

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
      dispatch({ type: "MARK_FILE_UPLOADING", fileIndex, fileId });

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
          if (speed > 0) dispatch({ type: "SET_UPLOAD_SPEED", speed });

          sendChunk();
        });
      };

      for (let i = 0; i < concurrency; i++) sendChunk();
    });
  };

  const initiateUploads = () => {
    state.fileUploads.forEach((f, index) => {
      if (f.status === "pending") {
        uploadFile(f.file, index);
      }
    });
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (files) {
      const newUploads = Array.from(files).map((file) => ({
        file,
        progress: 0,
        status: "pending" as const,
      }));
      dispatch({ type: "SET_FILE_UPLOADS", fileUploads: newUploads });
    }
  };

  const resetState = () => {
    dispatch({ type: "RESET" });
  };

  const dismissError = (fileId: string) => {
    dispatch({ type: "DISMISS_ERROR", fileId });
  };

  return {
    fileUploads: state.fileUploads,
    downloadProgress: state.downloadProgress,
    currentDownloadFileName: state.currentDownloadFileName,
    downloadedFiles: state.downloadedFiles,
    uploadSpeed: state.uploadSpeed,
    downloadSpeed: state.downloadSpeed,
    handleFilesSelected,
    initiateUploads,
    resetState,
    useCompression,
    failedUploads: state.failedUploads,
    retryingChunks: state.retryingChunks,
    dismissError,
  };
};
