import { Router } from "express";

import { getHealth, getLiveness } from "../controllers/health.controller.js";

const router = Router();

router.get("/health/live", getLiveness);
router.get("/health", getHealth);

export default router;
