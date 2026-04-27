import dotenv from "dotenv";

dotenv.config();

export const env = {
  APP_PORT: Number(process.env.APP_PORT || 5010),

  NODE_NAME: process.env.NODE_NAME || "Edge V2",
  NODE_CODE: process.env.NODE_CODE || "EDGE-V2",

  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://localhost:5001",
  ORIGIN_BASE_URL: process.env.ORIGIN_BASE_URL || "http://localhost:4001",

  EDGE_ACCESS_LOG: process.env.EDGE_ACCESS_LOG || "/var/log/nginx/edge_access.log",
  EDGE_LOG_MAX_BYTES: Number(process.env.EDGE_LOG_MAX_BYTES || 2_000_000),

  /**
   * Relay interno:
   * - El Edge abre una sola conexión al Origin por canal.
   * - Los clientes se cuelgan de ese flujo local.
   * - Por ahora, si un canal queda sin clientes, lo dejamos abierto.
   */
  RELAY_RECONNECT_MS: Number(process.env.RELAY_RECONNECT_MS || 3000),
};