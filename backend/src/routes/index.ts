import { Router } from "express";

import adminRoutes from "./admin.routes.js";
import activityRoutes from "./activity.routes.js";
import aiRoutes from "./ai.routes.js";
import alarmRoutes from "./alarm.routes.js";
import authRoutes from "./auth.routes.js";
import commandRoutes from "./command.routes.js";
import curtailmentRoutes from "./curtailment.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import forecastAccuracyRoutes from "./forecast-accuracy.routes.js";
import forecastRoutes from "./forecast.routes.js";
import gridConstraintRoutes from "./grid-constraint.routes.js";
import healthRoutes from "./health.routes.js";
import nodeRoutes from "./node.routes.js";
import plantAssetRoutes from "./plant-asset.routes.js";
import readingRoutes from "./reading.routes.js";
import simulationRoutes from "./simulation.routes.js";
import teamRoutes from "./team.routes.js";
import telemetryRoutes from "./telemetry.routes.js";
import optimisationRoutes from "./optimisation.routes.js";

const router = Router();

router.use("/", healthRoutes);
router.use("/auth", authRoutes);
router.use("/ai", aiRoutes);
router.use("/admin", adminRoutes);
router.use("/team", teamRoutes);
router.use("/activity", activityRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/forecast", forecastRoutes);
router.use("/forecast-accuracy", forecastAccuracyRoutes);
router.use("/curtailment", curtailmentRoutes);
router.use("/grid-constraints", gridConstraintRoutes);
router.use("/nodes", nodeRoutes);
router.use("/simulation", simulationRoutes);
router.use("/v2/telemetry", telemetryRoutes);
router.use("/", alarmRoutes);
router.use("/", readingRoutes);
router.use("/", plantAssetRoutes);
router.use("/", optimisationRoutes);
router.use("/", commandRoutes);

export default router;
