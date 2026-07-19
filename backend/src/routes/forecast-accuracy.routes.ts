import { Router } from "express";

import {
  getForecastAccuracyScoresHandler,
  getForecastRunsHandler,
  getPlantForecastConfigHandler,
  postForecastAccuracyScoreHandler,
  postForecastRunHandler,
  putPlantForecastConfigHandler
} from "../controllers/forecast-accuracy.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  forecastAccuracyQuerySchema,
  forecastAccuracyScoreBodySchema,
  forecastRunBodySchema,
  plantForecastConfigBodySchema
} from "../schemas/request.schemas.js";

const router = Router();

router.use(authenticate);

router.get("/scores", validateRequest({ query: forecastAccuracyQuerySchema }), getForecastAccuracyScoresHandler);
router.post(
  "/scores",
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: forecastAccuracyScoreBodySchema }),
  postForecastAccuracyScoreHandler
);
router.get("/runs", validateRequest({ query: forecastAccuracyQuerySchema }), getForecastRunsHandler);
router.post(
  "/runs",
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: forecastRunBodySchema }),
  postForecastRunHandler
);
router.get("/plants/:plantId/config", getPlantForecastConfigHandler);
router.put(
  "/plants/:plantId/config",
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: plantForecastConfigBodySchema }),
  putPlantForecastConfigHandler
);

export default router;
