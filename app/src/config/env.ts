import dotenv from "dotenv";

dotenv.config();

export const env = {
  APP_PORT: Number(process.env.APP_PORT || 5010),

  NODE_NAME: process.env.NODE_NAME || "Edge V2",
  NODE_CODE: process.env.NODE_CODE || "EDGE-V2",

  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://localhost:5001",
  ORIGIN_BASE_URL: process.env.ORIGIN_BASE_URL || "http://localhost:4001",

  /**
   * Log especial generado por Nginx para que el panel pueda calcular:
   * - cantidad de fragmentos pedidos
   * - cache HIT / MISS
   * - clientes únicos
   * - pedidos que golpean al Origin
   */
  EDGE_ACCESS_LOG: process.env.EDGE_ACCESS_LOG || "/var/log/nginx/edge_access.log",

  /**
   * Cantidad máxima de bytes a leer desde el final del log.
   * Evita que el panel lea archivos gigantes completos.
   */
  EDGE_LOG_MAX_BYTES: Number(process.env.EDGE_LOG_MAX_BYTES || 2_000_000),
};