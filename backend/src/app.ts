import express, { Express, Router } from "express";
import cors from "cors";
import { healthController } from "./controllers/health.controller";
import { statsController } from "./controllers/stats.controller";
import { uploadController } from "./controllers/upload.controller";
import { webhookController } from "./controllers/webhook.controller";
import { clusterController } from "./controllers/cluster.controller";
import { shareController } from "./controllers/share.controller";
import { errorMiddleware } from "./middleware/error.middleware";
import { asyncHandler } from "./utils/error.utils";

export const createApp = (): Express => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Routes
  const api = Router();
  api.get("/health", asyncHandler(healthController.getHealth));
  api.get("/stats", asyncHandler(statsController.getStats));
  api.get("/uploads/:fileId", asyncHandler(uploadController.getUploadProgress));
  api.post("/webhooks", asyncHandler(webhookController.registerWebhook));
  api.get("/cluster/nodes", asyncHandler(clusterController.getNodes));
  api.get("/cluster/stats", asyncHandler(clusterController.getStats));
  api.get("/cluster/master", asyncHandler(clusterController.getMaster));
  api.post("/share/create", asyncHandler(shareController.createShare));
  api.post("/share/join", asyncHandler(shareController.joinShare));
  app.use("/api", api);

  // Error handling middleware
  app.use(errorMiddleware);

  return app;
};
