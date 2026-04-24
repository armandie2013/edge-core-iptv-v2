import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRoute from "./routes/health.route";
import { env } from "./config/env";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRoute);

app.get("/", (_req, res) => {
  return res.status(200).json({
    ok: true,
    message: "edge-core-iptv-v2 app online",
    nodeName: env.NODE_NAME,
    nodeCode: env.NODE_CODE,
    originBaseUrl: env.ORIGIN_BASE_URL,
    timestamp: new Date().toISOString(),
  });
});

app.listen(env.APP_PORT, () => {
  console.log(`[edge-core-iptv-v2] app escuchando en puerto ${env.APP_PORT}`);
});