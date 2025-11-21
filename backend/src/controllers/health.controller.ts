import { Request, Response } from "express";
import { config } from "../config/app.config";
import { isNativeAddonAvailable } from "../native";
import { ClusterManager } from "../services/cluster.service";

export class HealthController {
  async getHealth(req: Request, res: Response) {
    const clusterManager = ClusterManager.getInstance();

    res.json({
      status: "ok",
      message: "PeerLink Backend API",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      features: {
        redis: config.useRedis,
        nativeAddon: config.useNativeAddon && isNativeAddonAvailable(),
        cluster: config.useCluster,
      },
      cluster: config.useCluster
        ? {
            role: clusterManager.getIsMaster() ? "master" : "worker",
            nodeId: clusterManager.getNodeId(),
          }
        : undefined,
    });
  }
}

export const healthController = new HealthController();
