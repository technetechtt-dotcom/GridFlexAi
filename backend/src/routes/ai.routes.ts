import { Router } from "express";

import { postAiChat } from "../controllers/ai.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { aiChatBodySchema } from "../schemas/request.schemas.js";

const router = Router();

router.post("/chat", authenticate, validateRequest({ body: aiChatBodySchema }), postAiChat);

export default router;
