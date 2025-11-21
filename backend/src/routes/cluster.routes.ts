import { Router } from "express";
import { clusterController } from "../controllers/cluster.controller";
import { asyncHandler } from "../utils/error.utils";

const router = Router();

router.get("/cluster/nodes", asyncHandler(clusterController.getNodes.bind(clusterController)));
router.get("/cluster/stats", asyncHandler(clusterController.getStats.bind(clusterController)));
router.get("/cluster/master", asyncHandler(clusterController.getMaster.bind(clusterController)));

export default router;
