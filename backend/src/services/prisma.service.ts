import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config/app.config';

/**
 * PrismaService - Singleton service for database operations
 * Manages PostgreSQL connection through Prisma ORM
 */
export class PrismaService {
  private static instance: PrismaClient | null = null;
  private static isConnecting = false;

  /**
   * Get the Prisma client instance (singleton pattern)
   */
  static getInstance(): PrismaClient {
    if (!this.instance && !this.isConnecting) {
      this.isConnecting = true;

      const logLevels: Prisma.LogLevel[] = config.debugDb
        ? ['query', 'error', 'warn', 'info']
        : ['error', 'warn'];

      this.instance = new PrismaClient({
        log: logLevels,
        errorFormat: 'pretty',
      });

      this.isConnecting = false;
      console.log('Prisma client initialized');
    }

    return this.instance!;
  }

  /**
   * Connect to the database explicitly
   */
  static async connect(): Promise<void> {
    const client = this.getInstance();

    try {
      await client.$connect();
      console.log('Connected to PostgreSQL database');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  static async disconnect(): Promise<void> {
    if (this.instance) {
      try {
        await this.instance.$disconnect();
        this.instance = null;
        console.log('Disconnected from PostgreSQL database');
      } catch (error) {
        console.error('Error disconnecting from database:', error);
        throw error;
      }
    }
  }

  /**
   * Check database health
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const client = this.getInstance();
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions and inactive nodes
   */
  static async cleanup(): Promise<void> {
    const client = this.getInstance();

    try {
      // Clean up inactive sessions older than 24 hours
      const sessionCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deletedSessions = await client.session.deleteMany({
        where: {
          active: false,
          updatedAt: { lt: sessionCutoff },
        },
      });

      // Clean up expired shares
      // Share model is no longer in DB, managed via Redis/Memory
      const deletedShares = { count: 0 };

      // Mark dead nodes (no heartbeat in 30 seconds)
      const nodeCutoff = new Date(Date.now() - 30 * 1000);
      const updatedNodes = await client.node.updateMany({
        where: {
          lastHeartbeat: { lt: nodeCutoff },
          status: 'active',
        },
        data: { status: 'dead' },
      });

      console.log(`Cleanup completed: ${deletedSessions.count} sessions, ${deletedShares.count} shares, ${updatedNodes.count} dead nodes`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}
