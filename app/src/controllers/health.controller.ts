    import { Request, Response } from "express";
import { env } from "../config/env";

export function healthController(_req: Request, res: Response) {
  return res.status(200).json({
    ok: true,
    service: "edge-core-iptv-v2",
    nodeName: env.NODE_NAME,
    nodeCode: env.NODE_CODE,
    status: "online",
    originBaseUrl: env.ORIGIN_BASE_URL,
    timestamp: new Date().toISOString(),
  });
}