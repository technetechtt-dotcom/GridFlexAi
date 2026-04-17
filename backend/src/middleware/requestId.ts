import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incomingRequestId = req.header(REQUEST_ID_HEADER)?.trim();
  const requestId = incomingRequestId && incomingRequestId.length > 0 ? incomingRequestId : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};
