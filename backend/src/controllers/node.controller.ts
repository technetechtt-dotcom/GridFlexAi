import type { Request, Response } from "express";

import { listNodesWithLastReading } from "../services/node.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type NodesResponse = {
  data: Awaited<ReturnType<typeof listNodesWithLastReading>>;
};

export const getNodes = asyncHandler(async (
  _req: Request<Record<string, never>, NodesResponse>,
  res: Response<NodesResponse>
) => {
  const nodes = await listNodesWithLastReading();
  res.status(200).json({ data: nodes });
});
