import { Router } from "express";
import { relayController } from "../controllers/relay.controller";

const router = Router();

router.get("/proxy/:channelId.ts", relayController);

export default router;