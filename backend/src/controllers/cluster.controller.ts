import { Request, Response } from "express";
import { ClusterManager } from "../services/cluster.service";
import { ErrorFactory } from "../utils/error.utils";
import { config } from "../config/app.config";

export class ClusterController {
  private clusterManager = ClusterManager.getInstance();

  async getNodes(req: Request, res: Response) {
    if (!config.useCluster) {
      throw ErrorFactory.notFound("Cluster mode disabled");
    }
    const nodes = await this.clusterManager.getNodeService().getActiveNodes();
    res.json({ success: true, nodes });
  }

  async getStats(req: Request, res: Response) {
    if (!config.useCluster) {
      throw ErrorFactory.notFound("Cluster mode disabled");
    }
    const stats = await this.clusterManager.getClusterStats();

    // Convert BigInt to string for JSON serialization
    const jsonStats = JSON.parse(
      JSON.stringify(stats, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    res.json({ success: true, stats: jsonStats });
  }

  async getMaster(req: Request, res: Response) {
    if (!config.useCluster) {
      throw ErrorFactory.notFound("Cluster mode disabled");
    }
    const masterId = await this.clusterManager.getCurrentMasterId();
    
    // Use internal state to determine if we are master
    // This prevents issues where ID comparison might be incorrect (e.g. both null)
    const isMe = this.clusterManager.getIsMaster();

    res.json({
      success: true,
      masterId,
      isMe,
      nodeId: this.clusterManager.getNodeId()
    });
  }
}

export const clusterController = new ClusterController();
