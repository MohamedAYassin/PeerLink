export const config = {
  USE_CLUSTER: import.meta.env.VITE_USE_CLUSTER === "true",
  CLUSTER_NODES: (import.meta.env.VITE_CLUSTER_NODES || "http://localhost:5000").split(","),
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000",
  WS_URL: import.meta.env.VITE_WS_URL || "http://localhost:5000",
  
  // File Transfer
  CHUNK_SIZE: parseInt(import.meta.env.VITE_CHUNK_SIZE || "65536"), // 64KB
  UPLOAD_CONCURRENCY: parseInt(import.meta.env.VITE_UPLOAD_CONCURRENCY || "6"),
  
  // Socket
  SOCKET_RECONNECTION_DELAY: parseInt(import.meta.env.VITE_SOCKET_RECONNECTION_DELAY || "1000"),
  SOCKET_RECONNECTION_DELAY_MAX: parseInt(import.meta.env.VITE_SOCKET_RECONNECTION_DELAY_MAX || "5000"),
  SOCKET_RECONNECTION_ATTEMPTS: parseInt(import.meta.env.VITE_SOCKET_RECONNECTION_ATTEMPTS || "5"),
};

export const updateClusterNodes = (nodes: string[]) => {
  config.CLUSTER_NODES = nodes;
};

export const getNextNode = () => {
  if (!config.USE_CLUSTER || config.CLUSTER_NODES.length === 0) {
    return config.WS_URL;
  }
  // Simple random load balancing for now, or round-robin if state preserved
  const index = Math.floor(Math.random() * config.CLUSTER_NODES.length);
  return config.CLUSTER_NODES[index];
};

