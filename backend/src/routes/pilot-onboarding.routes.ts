import { Router } from "express";
import { z } from "zod";

import { getOnboardingHandler, putOnboardingStepHandler } from "../controllers/pilot-onboarding.controller.js";
import { ONBOARDING_STEPS } from "../services/pilot-onboarding.service.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";

const stepIds = ONBOARDING_STEPS.map((s) => s.id) as [string, ...string[]];

const router = Router();

router.use(authenticate);
router.get("/", getOnboardingHandler);
router.put(
  "/steps",
  validateRequest({
    body: z.object({
      organisationId: z.string().optional(),
      siteId: z.string().optional(),
      stepId: z.enum(stepIds),
      status: z.enum(["open", "complete", "blocked"]),
      notes: z.string().max(5000).optional(),
      evidence: z.record(z.unknown()).optional()
    })
  }),
  putOnboardingStepHandler
);

export default router;
