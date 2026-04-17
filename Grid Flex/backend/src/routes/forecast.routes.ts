import { Router } from "express";

import {
  getDailyForecastPredictionsController,
  getForecastDebugController,
  getForecast,
  getForecastProviders,
  getForecastProvidersHistoryController } from
"../controllers/forecast.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { dailyForecastPredictionsQuerySchema, forecastQuerySchema } from "../schemas/request.schemas.js";

const router = Router();

router.get("/", validateRequest({ query: forecastQuerySchema }), getForecast);
router.get("/providers/status", authenticate, getForecastProviders);
router.get("/providers/history", authenticate, getForecastProvidersHistoryController);
router.get("/debug", authenticate, getForecastDebugController);
router.get("/daily-predictions", authenticate, validateRequest({ query: dailyForecastPredictionsQuerySchema }), getDailyForecastPredictionsController);

export default router;
