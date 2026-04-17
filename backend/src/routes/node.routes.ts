import { Router } from "express";

import { getNodes } from "../controllers/node.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, getNodes);

export default router;
