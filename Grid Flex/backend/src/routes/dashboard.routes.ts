import { Router } from "express";

import { getAdminDashboardSummary, getDashboardSummary } from "../controllers/dashboard.controller.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = Router();

router.get("/summary", authenticate, getDashboardSummary);
router.get("/admin", authenticate, authorizeRoles("admin", "developer"), getAdminDashboardSummary);

export default router;
