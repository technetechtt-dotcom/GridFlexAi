import { Router } from "express";
import { z } from "zod";

import {
  getRecoveryCasesHandler,
  patchRecoveryCaseHandler,
  postRecoveryCaseHandler
} from "../controllers/recovery-case.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";

const createBodySchema = z.object({
  title: z.string().min(2).max(240),
  plantLabel: z.string().min(1).max(160),
  predictedSavingsZar: z.coerce.number().finite().nullable().optional(),
  engineeringReviewer: z.string().max(160).nullable().optional(),
  organisationId: z.string().optional(),
  siteId: z.string().optional()
});

const patchBodySchema = z.object({
  note: z.string().max(1000).optional(),
  status: z.string().max(40).optional(),
  ownerName: z.string().max(160).optional(),
  engineeringReviewer: z.string().max(160).nullable().optional(),
  selectedOption: z.string().max(160).nullable().optional(),
  evidenceNotes: z.string().max(5000).optional(),
  evidenceAttachments: z.array(z.string().max(240)).max(50).optional(),
  predictedSavingsZar: z.coerce.number().finite().nullable().optional(),
  realisedSavingsZar: z.coerce.number().finite().nullable().optional(),
  actualRecoveredEnergyKwh: z.coerce.number().finite().nullable().optional(),
  realisationRevenueZar: z.coerce.number().finite().nullable().optional(),
  implementationDate: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  verificationNotes: z.string().max(5000).optional()
});

const router = Router();

router.use(authenticate);
router.get("/", getRecoveryCasesHandler);
router.post("/", validateRequest({ body: createBodySchema }), postRecoveryCaseHandler);
router.patch(
  "/:id",
  validateRequest({ params: z.object({ id: z.string().min(1) }), body: patchBodySchema }),
  patchRecoveryCaseHandler
);

export default router;
