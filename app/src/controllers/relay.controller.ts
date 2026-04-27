import { Request, Response } from "express";
import { relayManager } from "../services/relayManager.service";

function isValidChannelId(channelId: string): boolean {
  return /^[0-9]+$/.test(channelId);
}

export async function relayController(req: Request, res: Response) {
  const rawChannelId = req.params.channelId;
  const channelId = Array.isArray(rawChannelId) ? rawChannelId[0] : rawChannelId;

  if (!channelId || !isValidChannelId(channelId)) {
    return res.status(400).json({
      ok: false,
      message: "channelId inválido",
    });
  }

  return relayManager.attachClient(channelId, req, res);
}