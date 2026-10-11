import { Router } from "express";

import {
  acknowledgeMfaHandler,
  changePasswordHandler,
  forgotPasswordHandler,
  login,
  loginHistoryHandler,
  listSessionsHandler,
  logout,
  refresh,
  register,
  revokeSessionsHandler
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  changePasswordBodySchema,
  emptyBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema
} from "../schemas/request.schemas.js";

const router = Router();

router.post("/register", validateRequest({ body: registerBodySchema }), register);
router.post("/login", validateRequest({ body: loginBodySchema }), login);
router.post("/refresh", validateRequest({ body: emptyBodySchema }), refresh);
router.post("/logout", validateRequest({ body: emptyBodySchema }), logout);
router.post("/forgot-password", validateRequest({ body: forgotPasswordBodySchema }), forgotPasswordHandler);

router.post(
  "/change-password",
  authenticate,
  validateRequest({ body: changePasswordBodySchema }),
  changePasswordHandler
);
router.get("/sessions", authenticate, listSessionsHandler);
router.delete("/sessions", authenticate, revokeSessionsHandler);
router.get("/login-history", authenticate, loginHistoryHandler);
router.post("/mfa/acknowledge", authenticate, acknowledgeMfaHandler);

export default router;
