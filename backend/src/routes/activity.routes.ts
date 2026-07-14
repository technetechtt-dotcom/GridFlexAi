import { Router } from "express";

import { postActivityHandler } from "../controllers/team.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { recordActivityBodySchema } from "../schemas/request.schemas.js";

const router = Router();

router.post("/", authenticate, validateRequest({ body: recordActivityBodySchema }), postActivityHandler);

export default router;
