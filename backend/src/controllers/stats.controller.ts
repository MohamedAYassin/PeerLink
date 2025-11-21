import { Request, Response } from "express";
import { storageRepository } from "../repositories/storage.repository";
import { statsService } from "../services/stats.service";

export class StatsController {
  async getStats(req: Request, res: Response) {
    const [clients, shares, stats] = await Promise.all([
      storageRepository.getAllClientSessions(),
      storageRepository.getAllShareSessions(),
      statsService.getStats(),
    ]);

    const clientArray = Array.from(clients.values());

    res.json({
      filesSent: stats.filesSent,
      activeSessions: shares.size,
      usersJoined: clientArray.length,
    });
  }
}

export const statsController = new StatsController();
