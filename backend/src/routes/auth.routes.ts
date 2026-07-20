import { Router } from "express";

import { login, logout, refresh, register } from "../controllers/auth.controller.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema
} from "../schemas/request.schemas.js";

const router = Router();

router.post("/register", validateRequest({ body: registerBodySchema }), register);
router.post("/login", validateRequest({ body: loginBodySchema }), login);
router.post("/refresh", validateRequest({ body: refreshBodySchema }), refresh);
router.post("/logout", validateRequest({ body: refreshBodySchema }), logout);

export default router;
