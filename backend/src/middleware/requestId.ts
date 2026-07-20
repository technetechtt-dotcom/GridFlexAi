import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { resolveTraceIds, runWithLogContext } from "../observability/log-context.js";

const REQUEST_ID_HEADER = "x-request-id";
const TRACEPARENT_HEADER = "traceparent";

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incomingRequestId = req.header(REQUEST_ID_HEADER)?.trim();
  const requestId = incomingRequestId && incomingRequestId.length > 0 ? incomingRequestId : randomUUID();
  const { traceId, spanId, traceparent } = resolveTraceIds(req.header(TRACEPARENT_HEADER));

  const deviceId = req.header("x-gridflex-device-id")?.trim();

  res.locals.requestId = requestId;
  res.locals.traceId = traceId;
  res.locals.spanId = spanId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.setHeader(TRACEPARENT_HEADER, traceparent);
  res.setHeader("x-trace-id", traceId);

  runWithLogContext(
    {
      requestId,
      traceId,
      spanId,
      route: `${req.method} ${req.path}`,
      ...(deviceId ? { deviceId } : {})
    },
    () => next()
  );
};
