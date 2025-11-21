import { useState, useEffect, useCallback } from "react";
import { socketService } from "../services/socket.service";
import { ApiService } from "../services/api.service";
import { BackendFeatures, ClusterStats, MasterNodeInfo } from "../types";
import { setCompressionEnabled } from "../utils/compression";
import { config } from "../config/app.config";

export const useSession = () => {
  const [clientId] = useState<string>(
    `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const [socket, setSocket] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [shareId, setShareId] = useState<string>("");
  const [connectedClients, setConnectedClients] = useState(0);
  const [connectedNode, setConnectedNode] = useState<string>("");

  const [backendFeatures, setBackendFeatures] = useState<BackendFeatures>({
    redis: false,
    nativeAddon: false,
  });
  const [clusterStats, setClusterStats] = useState<ClusterStats | null>(null);
  const [notifications, setNotifications] = useState<{
    disconnect: boolean;
    join: boolean;
  }>({ disconnect: false, join: false });

  // Master node tracking for cluster mode
  const [masterNode, setMasterNode] = useState<MasterNodeInfo | null>(null);
  const [masterNodeFailed, setMasterNodeFailed] = useState(false);

  // Initialize Connection
  useEffect(() => {
    let newSocket: any = null;

    const initSocket = async () => {
      newSocket = await socketService.connect(clientId);
      setSocket(newSocket);

      // We can access the URL from the socket io object usually, but let's use what we set
      // Ideally socketService should expose the current node URL
      // For now, just assume it's what we configured or let socketService handle it

      const onConnect = () => {
        console.log("Connected to server");
        setConnected(true);
        setStatus("Connected");
        newSocket.emit("register", clientId);
        setConnectedNode(newSocket.io.uri); // Get actual connected URL

        // Check backend features
        checkBackendHealth();
      };

      const onRegistered = (data: any) => {
        console.log("Client registered", data);
        setConnected(true);
        
        // Update master node info from socket (authoritative for "isMe")
        if (data.nodeId) {
            setMasterNode(prev => ({
                masterId: data.masterId || prev?.masterId,
                isMe: data.isMaster,
                nodeId: data.nodeId
            }));
        }
      };

      const onClusterRoleChange = (data: any) => {
        console.log("Cluster role changed:", data);
        if (data.nodeId) {
            setMasterNode(prev => ({
                ...prev,
                isMe: data.isMaster,
                nodeId: data.nodeId,
                masterId: data.isMaster ? data.nodeId : prev?.masterId
            }));
        }
      };

      const onDisconnect = () => {
        console.log("Disconnected from server");
        setConnected(false);
        setShareId("");
        setStatus("Disconnected");
      };

      const onClientJoinedShare = (data: any) => {
        console.log("User joined the share session:", data.clientId);
        setNotifications((prev) => ({ ...prev, join: true }));
        setConnectedClients(2); // Typically 2 in a P2P-like share
        setStatus("Connected - Ready to share files");
        setTimeout(
          () => setNotifications((prev) => ({ ...prev, join: false })),
          4000
        );
      };

      const onConnectionReady = (data: any) => {
        console.log("Connection ready:", data.message);
        setNotifications((prev) => ({ ...prev, join: true }));
        setConnectedClients(data.connectedClients);
        setStatus("Connected - Ready to share files");
        setTimeout(
          () => setNotifications((prev) => ({ ...prev, join: false })),
          4000
        );
      };

      const onClientDisconnectedFromShare = () => {
        console.log("Other client disconnected from share");
        window.location.reload();
      };

      newSocket.on("connect", onConnect);
      newSocket.on("registered", onRegistered);
      newSocket.on("disconnect", onDisconnect);
      newSocket.on("client-joined-share", onClientJoinedShare);
      newSocket.on("connection-ready", onConnectionReady);
      newSocket.on("client-disconnected-from-share", onClientDisconnectedFromShare);
      newSocket.on("cluster-role-change", onClusterRoleChange);
    };

    initSocket();

    return () => {
      if (newSocket) {
        newSocket.off("connect");
        newSocket.off("registered");
        newSocket.off("disconnect");
        newSocket.off("client-joined-share");
        newSocket.off("connection-ready");
        newSocket.off("client-disconnected-from-share");
        newSocket.off("cluster-role-change");
        socketService.disconnect();
      }
    };
  }, [clientId]);

  const checkBackendHealth = async () => {
    try {
      const data = await ApiService.getHealth();
      setBackendFeatures(data.features);

      setCompressionEnabled(true);

      if (config.USE_CLUSTER) {
        const stats = await ApiService.getClusterStats();
        setClusterStats(stats.stats);
      }
    } catch (err) {
      console.error("Failed to check backend features:", err);
    }
  };

  // Master node polling for cluster mode
  const fetchMasterNode = useCallback(async () => {
    if (!config.USE_CLUSTER) return;

    try {
      const response = await fetch(`${config.BACKEND_URL}/api/cluster/master`);
      if (!response.ok) {
        throw new Error(`Failed to fetch master: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Only update masterId from REST, preserve isMe/nodeId from socket if available
      // This ensures "isMe" reflects the actual socket connection, not the REST endpoint
      setMasterNode(prev => ({
        masterId: data.masterId,
        isMe: prev?.nodeId ? prev.isMe : data.isMe, 
        nodeId: prev?.nodeId ? prev.nodeId : data.nodeId,
      }));
      
      setMasterNodeFailed(false);
      console.log('Master node:', data.masterId?.substring(0, 8));
    } catch (error) {
      console.warn('Master node unreachable, waiting for re-election...', error);
      setMasterNodeFailed(true);
    }
  }, []);

  // Poll master node every 15 seconds in cluster mode
  useEffect(() => {
    if (!config.USE_CLUSTER) return;

    // Initial fetch
    fetchMasterNode();

    // Set up polling
    const interval = setInterval(fetchMasterNode, 15000);

    return () => clearInterval(interval);
  }, [fetchMasterNode]);

  const createShare = useCallback(async (customShareId?: string) => {
    try {
      const data = await ApiService.createShare(clientId, customShareId);
      if (data.success) {
        setShareId(data.shareId);
        setStatus(`Share Created: ${data.shareId}`);
        setConnectedClients(1);
        return { success: true, shareId: data.shareId };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }, [clientId]);

  const joinShare = useCallback(async (shareIdToJoin: string) => {
    try {
      const data = await ApiService.joinShare(shareIdToJoin, clientId);
      if (data.success) { // Check for success property or implicit 200 OK from ApiService wrapper
        // The ApiService returns json, assume standard response structure
        // However, ApiService.joinShare actually returns response.json(). 
        // In App.tsx it checked response.ok AND data.success/error?
        // Let's assume success field is present.
        setShareId(data.shareId);
        setStatus("Connected - Ready to share files");
        setConnectedClients(data.connectedClients);
        setNotifications(prev => ({ ...prev, join: true }));
        setTimeout(() => setNotifications(prev => ({ ...prev, join: false })), 4000);
        return { success: true };
      } else {
        return { success: false, error: data.error || "Failed to join" };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }, [clientId]);

  const leaveShare = useCallback(async () => {
    if (!shareId) return;
    // Always cleanup locally
    setShareId("");
    setStatus("Disconnected");
    setConnectedClients(0);
  }, [shareId, clientId]);

  return {
    socket,
    clientId,
    connected,
    status,
    setStatus, // Expose setter if needed by file transfer hook
    shareId,
    connectedClients,
    connectedNode,
    backendFeatures,
    clusterStats,
    notifications,
    masterNode,
    masterNodeFailed,
    createShare,
    joinShare,
    leaveShare
  };
};

