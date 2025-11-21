import { PrismaService } from './prisma.service';

/**
 * NodeService - Manages node registration, heartbeat, and cluster coordination
 * Each backend instance is a "node" in the cluster
 */
export class NodeService {
  private prisma = PrismaService.getInstance();
  private nodeId: string | null = null;
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Register this node in the cluster
   */
  async register(hostname: string, port: number): Promise<string> {
    try {
      // Check if this node already exists (based on hostname:port)
      const existingNode = await this.prisma.node.findFirst({
        where: { hostname, port },
      });

      if (existingNode) {
        // Reactivate existing node
        const node = await this.prisma.node.update({
          where: { id: existingNode.id },
          data: {
            status: 'active',
            lastHeartbeat: new Date(),
          },
        });
        this.nodeId = node.id;
        console.log(`Reactivated existing node: ${node.id} (${hostname}:${port})`);
      } else {
        // Create new node
        const node = await this.prisma.node.create({
          data: {
            hostname,
            port,
            status: 'active',
            lastHeartbeat: new Date(),
          },
        });
        this.nodeId = node.id;
        console.log(`Registered new node: ${node.id} (${hostname}:${port})`);
      }

      // Start heartbeat
      this.startHeartbeat();

      // Start cleanup routine (only one node should do this, but safe for all)
      this.startCleanup();

      return this.nodeId!;
    } catch (error) {
      console.error('Failed to register node:', error);
      throw error;
    }
  }

  /**
   * Update node role (master/worker)
   */
  async updateRole(nodeId: string, role: string): Promise<void> {
    try {
      await this.prisma.node.update({
        where: { id: nodeId },
        data: { role },
      });
      console.log(`Node ${nodeId} role updated to: ${role}`);
    } catch (error) {
      console.error('Failed to update node role:', error);
    }
  }

  /**
   * Start heartbeat to keep node alive in cluster
   */
  private startHeartbeat(): void {
    const interval = parseInt(process.env.HEARTBEAT_INTERVAL || '10000'); // 10 seconds default

    this.heartbeatInterval = setInterval(async () => {
      if (!this.nodeId) return;

      try {
        await this.prisma.node.update({
          where: { id: this.nodeId },
          data: { lastHeartbeat: new Date() },
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, interval);

    console.log(`Heartbeat started (interval: ${interval}ms)`);
  }

  /**
   * Start periodic cleanup of dead nodes and expired data
   */
  private startCleanup(): void {
    const interval = 60000; // 1 minute

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupDeadNodes();
      await PrismaService.cleanup();
    }, interval);

    console.log('Cleanup routine started');
  }

  /**
   * Mark nodes as dead if they haven't sent heartbeat
   */
  async cleanupDeadNodes(): Promise<void> {
    const threshold = new Date(Date.now() - 30000); // 30 seconds

    try {
      const result = await this.prisma.node.updateMany({
        where: {
          lastHeartbeat: { lt: threshold },
          status: 'active',
        },
        data: { status: 'dead' },
      });

      if (result.count > 0) {
        console.log(`Marked ${result.count} nodes as dead`);

        // Deactivate sessions on dead nodes
        const deadNodes = await this.prisma.node.findMany({
          where: { status: 'dead' },
          select: { id: true },
        });

        const deadNodeIds = deadNodes.map((n: { id: string }) => n.id);

        if (deadNodeIds.length > 0) {
          await this.prisma.session.updateMany({
            where: {
              nodeId: { in: deadNodeIds },
              active: true,
            },
            data: { active: false },
          });
        }
      }
    } catch (error) {
      console.error('Cleanup dead nodes failed:', error);
    }
  }

  /**
   * Deregister this node from the cluster (graceful shutdown)
   */
  async deregister(): Promise<void> {
    if (!this.nodeId) return;

    try {
      // Stop intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Mark all sessions on this node as inactive
      await this.prisma.session.updateMany({
        where: {
          nodeId: this.nodeId,
          active: true,
        },
        data: { active: false },
      });

      // Mark node as inactive
      await this.prisma.node.update({
        where: { id: this.nodeId },
        data: { status: 'inactive' },
      });

      console.log(`Node deregistered: ${this.nodeId}`);
      this.nodeId = null;
    } catch (error) {
      console.error('Failed to deregister node:', error);
    }
  }

  /**
   * Get current node ID
   */
  getNodeId(): string | null {
    return this.nodeId;
  }

  /**
   * Get all active nodes in the cluster
   */
  async getActiveNodes(): Promise<Array<{ id: string; hostname: string; port: number }>> {
    try {
      const nodes = await this.prisma.node.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          hostname: true,
          port: true,
          lastHeartbeat: true,
        },
        orderBy: { lastHeartbeat: 'desc' },
      });

      return nodes;
    } catch (error) {
      console.error('Failed to get active nodes:', error);
      return [];
    }
  }


}
