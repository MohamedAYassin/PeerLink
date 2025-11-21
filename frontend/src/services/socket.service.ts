import { io, Socket } from "socket.io-client";
import { getNextNode, config, updateClusterNodes } from "../config/app.config";
import { ApiService } from "./api.service";

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private discoveryInterval: any | null = null;

  private constructor() {
    if (config.USE_CLUSTER) {
      this.startNodeDiscovery();
    }
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  private startNodeDiscovery() {
    // Initial fetch
    this.fetchNodes();

    // Periodic fetch every 30 seconds
    this.discoveryInterval = setInterval(() => {
      this.fetchNodes();
    }, 30000);
  }

  private async fetchNodes() {
    try {
      const [nodesData, masterData] = await Promise.all([
        ApiService.getNodes(),
        ApiService.getMaster(),
      ]);

      if (nodesData.success && Array.isArray(nodesData.nodes)) {
        const masterId = masterData.success ? masterData.masterId : null;
        
        // Filter out master node
        const workerNodes = nodesData.nodes.filter((n: any) => n.id !== masterId);
        
        const protocol = window.location.protocol.replace(':', '');
        const nodeUrls = workerNodes.map((n: any) => `${protocol}://${n.hostname}:${n.port}`);
        
        if (nodeUrls.length > 0) {
            updateClusterNodes(nodeUrls);
            console.log("Updated cluster nodes list (workers only):", nodeUrls);
        }
      }
    } catch (error) {
      console.warn("Failed to refresh cluster nodes:", error);
    }
  }

  async connect(clientId: string): Promise<Socket> {
    if (this.socket?.connected) return this.socket;

    let nodeUrl = getNextNode();

    if (config.USE_CLUSTER) {
      try {
        const [nodesData, masterData] = await Promise.all([
          ApiService.getNodes(),
          ApiService.getMaster(),
        ]);

        if (nodesData.success && masterData.success) {
          const masterId = masterData.masterId;
          // Filter out master node
          const workerNodes = nodesData.nodes.filter(
            (n: any) => n.id !== masterId
          );

          if (workerNodes.length > 0) {
            // Update global config with fresh worker list
            const protocol = window.location.protocol.replace(':', '');
            const nodeUrls = workerNodes.map((n: any) => `${protocol}://${n.hostname}:${n.port}`);
            updateClusterNodes(nodeUrls);

            // Pick random worker
            const index = Math.floor(Math.random() * workerNodes.length);
            const worker = workerNodes[index];
            
            // Construct URL
            const hostname = worker.hostname; 
            nodeUrl = `${protocol}://${hostname}:${worker.port}`;
            console.log(
              `Selected worker node: ${nodeUrl} (Master is ${masterId})`
            );
          } else {
            console.warn("No worker nodes found, falling back to default node");
          }
        }
      } catch (e) {
        console.error(
          "Failed to fetch cluster nodes, falling back to default",
          e
        );
      }
    }

    console.log(`Connecting to node: ${nodeUrl}`);

    this.socket = io(nodeUrl, {
      reconnection: true,
      reconnectionDelay: config.SOCKET_RECONNECTION_DELAY,
      reconnectionDelayMax: config.SOCKET_RECONNECTION_DELAY_MAX,
      reconnectionAttempts: config.SOCKET_RECONNECTION_ATTEMPTS,
      query: { clientId }, // Pass clientId in query if backend supports it, or emit 'register' after connect
    });

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = SocketService.getInstance();

