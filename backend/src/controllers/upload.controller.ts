import { Request, Response } from "express";
import { storageRepository } from "../repositories/storage.repository";
import { ErrorFactory } from "../utils/error.utils";
import { config } from "../config/app.config";

export class UploadController {
  async getUploadProgress(req: Request, res: Response) {
    const { fileId } = req.params;
    const upload = await storageRepository.getUploadState(fileId);

    if (!upload) {
      throw ErrorFactory.notFound("Upload");
    }

    const progress = (upload.uploadedChunks.size / upload.totalChunks) * 100;
    const missingChunks = [];

    for (let i = 0; i < upload.totalChunks; i++) {
      if (!upload.uploadedChunks.has(i)) {
        missingChunks.push(i);
      }
    }

    const elapsed = (Date.now() - upload.startTime) / 1000;
    const speed = elapsed > 0 ? upload.fileSize / elapsed : 0;

    res.json({
      fileId: upload.fileId,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      progress: Math.round(progress),
      uploadedChunks: upload.uploadedChunks.size,
      totalChunks: upload.totalChunks,
      missingChunks: missingChunks.slice(0, 10),
      missingCount: missingChunks.length,
      status: upload.status,
      speed: Math.round(speed),
      eta:
        missingChunks.length > 0
          ? Math.round((missingChunks.length * config.chunkSize) / speed)
          : 0,
    });
  }
}

export const uploadController = new UploadController();

