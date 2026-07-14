import type { ServerResponse } from "node:http";
import type { Request, Response } from "express";

import type { AiChatBody } from "../schemas/request.schemas.js";
import { generateAiChatResponse, getAiStreamErrorMessage } from "../services/ai-chat.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const postAiChat = asyncHandler(async (
  req: Request<Record<string, never>, unknown, AiChatBody>,
  res: Response
) => {
  const result = await generateAiChatResponse(req.body);
  result.pipeUIMessageStreamToResponse(res as unknown as ServerResponse, {
    onError: getAiStreamErrorMessage
  });
});
