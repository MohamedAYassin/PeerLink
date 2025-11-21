import express, { Express } from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";
import statsRoutes from "./routes/stats.routes";
import uploadRoutes from "./routes/upload.routes";    
import webhookRoutes from "./routes/webhook.routes";
import clusterRoutes from "./routes/cluster.routes";
import shareRoutes from "./routes/share.routes";
import { errorMiddleware } from "./middleware/error.middleware";

export const createApp = (): Express => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Routes
  app.use("/api", healthRoutes);
  app.use("/api", statsRoutes);
  app.use("/api", uploadRoutes);
  app.use("/api", webhookRoutes);
  app.use("/api", clusterRoutes);
  app.use("/api", shareRoutes);

  // Error handling middleware
  app.use(errorMiddleware);

  return app;
};

