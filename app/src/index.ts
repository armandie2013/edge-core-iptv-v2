import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { env } from "./config/env";
import healthRoute from "./routes/health.route";
import panelRoute from "./routes/panel.route";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRoute);
app.use(panelRoute);

app.get("/", (_req, res) => {
  return res.status(200).json({
    ok: true,
    service: "edge-core-iptv-v2",
    message: "edge-core-iptv-v2 app online",
    nodeName: env.NODE_NAME,
    nodeCode: env.NODE_CODE,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    originBaseUrl: env.ORIGIN_BASE_URL,
    panelUrl: `${env.PUBLIC_BASE_URL}/panel`,
    timestamp: new Date().toISOString(),
  });
});

app.listen(env.APP_PORT, () => {
  console.log(`[edge-core-iptv-v2] app escuchando en puerto ${env.APP_PORT}`);
  console.log(`[edge-core-iptv-v2] nodo: ${env.NODE_NAME} (${env.NODE_CODE})`);
  console.log(`[edge-core-iptv-v2] publicBaseUrl: ${env.PUBLIC_BASE_URL}`);
  console.log(`[edge-core-iptv-v2] originBaseUrl: ${env.ORIGIN_BASE_URL}`);
  console.log(`[edge-core-iptv-v2] edgeAccessLog: ${env.EDGE_ACCESS_LOG}`);
});