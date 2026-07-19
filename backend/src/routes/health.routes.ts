import { Router } from "express";
import { getHealth, getLiveness, getReadiness } from "../controllers/health.controller.js";
const router = Router();
router.get("/health/live", getLiveness);
router.get("/health/ready", getReadiness);
router.get("/health", getHealth);
export default router;
