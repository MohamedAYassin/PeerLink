import { config } from "../config/app.config";

export class ApiService {
  static async getHealth() {
    const response = await fetch(`${config.BACKEND_URL}/api/health`);
    return response.json();
  }

  static async getClusterStats() {
    const response = await fetch(`${config.BACKEND_URL}/api/cluster/stats`);
    return response.json();
  }

  static async getNodes() {
    const response = await fetch(`${config.BACKEND_URL}/api/cluster/nodes`);
    return response.json();
  }

  static async getMaster() {
    const response = await fetch(`${config.BACKEND_URL}/api/cluster/master`);
    return response.json();
  }

  static async createShare(clientId: string, shareId?: string) {
    const requestBody: { clientId: string; shareId?: string } = { clientId };
    if (shareId) {
      requestBody.shareId = shareId;
    }

    const response = await fetch(`${config.BACKEND_URL}/api/share/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    return response.json();
  }

  static async joinShare(shareId: string, clientId: string) {
    const response = await fetch(`${config.BACKEND_URL}/api/share/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, clientId }),
    });
    return response.json();
  }
}

