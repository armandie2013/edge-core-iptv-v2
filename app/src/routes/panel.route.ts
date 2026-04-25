import { Router } from "express";
import { panelController } from "../controllers/panel.controller";

const router = Router();

router.get("/panel", panelController);

export default router;