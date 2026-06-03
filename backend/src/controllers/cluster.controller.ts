import { Request, Response } from "express";
import { ClusterManager } from "../services/cluster.service";
import { ErrorFactory } from "../utils/error.utils";
import { config } from "../config/app.config";

const clusterManager = ClusterManager.getInstance();

export const clusterController = {
  async getNodes(req: Request, res: Response) {
    if (!config.useCluster) {
      throw ErrorFactory.notFound("Cluster mode disabled");
    }
    const nodes = await clusterManager.getNodeService().getActiveNodes();
    res.json({ success: true, nodes });
  },

  async getStats(req: Request, res: Response) {
    if (!config.useCluster) {
      throw ErrorFactory.notFound("Cluster mode disabled");
    }
    const stats = await clusterManager.getClusterStats();
    const jsonStats = JSON.parse(
      JSON.stringify(stats, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );
    res.json({ success: true, stats: jsonStats });
  },

  async getMaster(req: Request, res: Response) {
    if (!config.useCluster) {
      throw ErrorFactory.notFound("Cluster mode disabled");
    }
    const masterId = await clusterManager.getCurrentMasterId();
    const isMe = clusterManager.getIsMaster();

    res.json({
      success: true,
      masterId,
      isMe,
      nodeId: clusterManager.getNodeId(),
    });
  },
};
