import { PrismaService } from './prisma.service';

/**
 * SessionService - Manages user sessions across cluster nodes
 * Tracks which users are connected to which nodes
 */
export class SessionService {
  private prisma = PrismaService.getInstance();

  /**
   * Create a new session when a client connects
   */
  async createSession(
    clientId: string,
    nodeId: string,
    socketId: string,
    metadata?: any
  ): Promise<{ id: string; clientId: string; nodeId: string; socketId: string }> {
    try {
      const session = await this.prisma.session.create({
        data: {
          clientId,
          nodeId,
          socketId,
          active: true,
          metadata: metadata || {},
        },
      });

      console.log(`Session created: ${session.id} (Client: ${clientId}, Node: ${nodeId})`);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Remove session when user disconnects
   */
  async removeSession(socketId: string): Promise<void> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { socketId },
      });

      if (session) {
        // Delete the session to keep DB lean
        await this.prisma.session.delete({
          where: { id: session.id }
        });

        console.log(`Session removed: ${session.id} (Socket: ${socketId})`);
      }
    } catch (error) {
      console.error('Failed to remove session:', error);
    }
  }



  /**
   * Get session by socket ID
   */
  async getSessionBySocketId(socketId: string): Promise<{
    id: string;
    clientId: string;
    nodeId: string;
    socketId: string;
    active: boolean;
  } | null> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { socketId },
      });

      // @ts-ignore - Prisma types will be updated after generation
      return session;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Get all active sessions for a client
   */
  async getClientSessions(clientId: string): Promise<Array<{
    id: string;
    nodeId: string;
    socketId: string;
    createdAt: Date;
    node: { id: string; hostname: string; port: number };
  }>> {
    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          clientId: clientId,
          active: true,
        },
        include: {
          node: {
            select: {
              id: true,
              hostname: true,
              port: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return sessions;
    } catch (error) {
      console.error('Failed to get client sessions:', error);
      return [];
    }
  }



  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    uniqueActiveClients: number;
    sessionsPerNode: Array<{ nodeId: string; hostname: string; count: number }>;
  }> {
    try {
      const [totalActiveSessions, uniqueClientIds, sessionsPerNode] = await Promise.all([
        // Total active sessions
        this.prisma.session.count({
          where: { active: true },
        }),

        // Unique active clients
        this.prisma.session.findMany({
          where: { active: true },
          select: { clientId: true },
          distinct: ['clientId'],
        }),

        // Sessions per node
        this.prisma.session.groupBy({
          by: ['nodeId'],
          where: { active: true },
          _count: {
            id: true,
          },
        }),
      ]);

      // Fetch node details for sessions per node
      const nodeDetails = await this.prisma.node.findMany({
        where: {
          id: {
            in: sessionsPerNode.map((s: any) => s.nodeId),
          },
        },
        select: {
          id: true,
          hostname: true,
        },
      });

      const nodeMap = new Map(nodeDetails.map((n: any) => [n.id, n.hostname]));

      return {
        totalActiveSessions,
        uniqueActiveClients: uniqueClientIds.length,
        sessionsPerNode: sessionsPerNode.map((s: any) => ({
          nodeId: s.nodeId,
          hostname: nodeMap.get(s.nodeId) || 'unknown',
          count: s._count.id,
        })),
      };
    } catch (error) {
      console.error('Failed to get session stats:', error);
      return {
        totalActiveSessions: 0,
        uniqueActiveClients: 0,
        sessionsPerNode: [],
      };
    }
  }


}
