import type { Request, Response } from "express";
import type { RecoveryAnalysisStatus, RecoveryCauseCode } from "@prisma/client";

import {
  assembleRecoverySamplesFromPlant,
  buildRecoveryReportCsv,
  buildRecoveryReportHtml,
  getRecoveryAnalysis,
  listRecoveryAnalyses,
  persistRecoveryAnalysis,
  reviewRecoveryAnalysis,
  runRecoveryAnalysis
} from "../services/recovery.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const postRecoveryAnalyseHandler = asyncHandler(async (req: Request, res: Response) => {
  const samples = Array.isArray(req.body?.samples) ? req.body.samples : [];
  const assumptions =
    req.body?.assumptions && typeof req.body.assumptions === "object" ? req.body.assumptions : undefined;
  const persist = req.body?.persist === true;
  const organisationId =
    typeof req.body?.organisationId === "string" ? req.body.organisationId : undefined;
  const plantId = typeof req.body?.plantId === "string" ? req.body.plantId : undefined;
  const siteId = typeof req.body?.siteId === "string" ? req.body.siteId : undefined;
  const dataEnvironment =
    req.body?.dataEnvironment === "live" ||
    req.body?.dataEnvironment === "simulation" ||
    req.body?.dataEnvironment === "hil" ||
    req.body?.dataEnvironment === "synthetic_demo"
      ? req.body.dataEnvironment
      : undefined;
  const annualEventDays =
    typeof req.body?.annualEventDays === "number" ? req.body.annualEventDays : undefined;
  const estimatedCapexZar =
    typeof req.body?.estimatedCapexZar === "number" ? req.body.estimatedCapexZar : undefined;

  const analysis = runRecoveryAnalysis(samples, {
    assumptions,
    dataEnvironment,
    annualEventDays,
    estimatedCapexZar
  });

  if (!persist) {
    res.status(200).json({ data: analysis });
    return;
  }

  if (!organisationId) {
    throw new AppError("organisationId is required when persist=true.", 400);
  }
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  const saved = await persistRecoveryAnalysis({
    analysis,
    organisationId,
    actor: req.user,
    actorId: req.user.id,
    ...(siteId ? { siteId } : {}),
    ...(plantId ? { plantId } : {})
  });

  res.status(201).json({ data: analysis, persisted: { id: saved.id, status: saved.status } });
});

export const postRecoveryAnalysePlantHandler = asyncHandler(async (req: Request, res: Response) => {
  const plantId = typeof req.body?.plantId === "string" ? req.body.plantId : "";
  const from = typeof req.body?.from === "string" ? req.body.from : "";
  const to = typeof req.body?.to === "string" ? req.body.to : "";
  if (!plantId || !from || !to) {
    throw new AppError("plantId, from and to are required.", 400);
  }

  const assembled = await assembleRecoverySamplesFromPlant({
    plantId,
    from,
    to,
    ...(typeof req.body?.assumptions?.intervalMinutes === "number"
      ? { intervalMinutes: req.body.assumptions.intervalMinutes as number }
      : {}),
    ...(req.user ? { actor: req.user } : {})
  });

  const analysis = runRecoveryAnalysis(assembled.samples, {
    ...(req.body?.assumptions ? { assumptions: req.body.assumptions } : {}),
    dataEnvironment: assembled.dataEnvironment,
    ...(typeof req.body?.annualEventDays === "number"
      ? { annualEventDays: req.body.annualEventDays as number }
      : {}),
    ...(typeof req.body?.estimatedCapexZar === "number"
      ? { estimatedCapexZar: req.body.estimatedCapexZar as number }
      : {})
  });

  const persist = req.body?.persist === true;
  if (!persist) {
    res.status(200).json({
      data: analysis,
      assembly: {
        plantId: assembled.plant.id,
        sampleCount: assembled.samples.length,
        dataEnvironment: assembled.dataEnvironment
      }
    });
    return;
  }

  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }
  const saved = await persistRecoveryAnalysis({
    analysis,
    organisationId: assembled.plant.organisationId,
    siteId: assembled.plant.siteId,
    plantId: assembled.plant.id,
    actor: req.user,
    actorId: req.user.id
  });

  res.status(201).json({
    data: analysis,
    persisted: { id: saved.id, status: saved.status },
    assembly: {
      plantId: assembled.plant.id,
      sampleCount: assembled.samples.length,
      dataEnvironment: assembled.dataEnvironment
    }
  });
});

export const getRecoveryAnalysesHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: {
    plantId?: string;
    siteId?: string;
    status?: RecoveryAnalysisStatus;
    limit?: number;
  } = {};
  if (typeof req.query.plantId === "string") filters.plantId = req.query.plantId;
  if (typeof req.query.siteId === "string") filters.siteId = req.query.siteId;
  if (typeof req.query.status === "string") filters.status = req.query.status as RecoveryAnalysisStatus;
  if (typeof req.query.limit === "string") filters.limit = Number(req.query.limit);
  const data = await listRecoveryAnalyses(filters, req.user);
  res.status(200).json({ data });
});

export const getRecoveryAnalysisHandler = asyncHandler(async (req: Request, res: Response) => {
  const analysisId = req.params.analysisId;
  if (!analysisId) throw new AppError("analysisId is required.", 400);
  const data = await getRecoveryAnalysis(analysisId, req.user);
  res.status(200).json({ data });
});

export const patchRecoveryReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const analysisId = req.params.analysisId;
  if (!analysisId) throw new AppError("analysisId is required.", 400);
  const data = await reviewRecoveryAnalysis({
    analysisId,
    decision: req.body.decision as RecoveryAnalysisStatus,
    notes: String(req.body.notes ?? ""),
    actorId: req.user.id,
    actor: req.user,
    ...(req.body.correctedCause
      ? { correctedCause: req.body.correctedCause as RecoveryCauseCode }
      : {})
  });
  res.status(200).json({ data });
});

export const getRecoveryReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const analysisId = req.params.analysisId;
  if (!analysisId) throw new AppError("analysisId is required.", 400);
  const format = req.query.format === "csv" ? "csv" : "html";
  const row = await getRecoveryAnalysis(analysisId, req.user);
  const analysis = row.analysisJson as unknown as ReturnType<typeof runRecoveryAnalysis>;
  if (format === "csv") {
    const csv = buildRecoveryReportCsv(analysis);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="gridflex-recovery-${analysisId}.csv"`);
    res.status(200).send(csv);
    return;
  }
  const html = buildRecoveryReportHtml(analysis, `GridFlex AI Recovery Report · ${row.plant?.name ?? analysisId}`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
});
