import dotenv from "dotenv";

dotenv.config();

export const env = {
  APP_PORT: Number(process.env.APP_PORT || 5010),
  NODE_NAME: process.env.NODE_NAME || "Edge V2",
  NODE_CODE: process.env.NODE_CODE || "EDGE-V2",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://localhost:5001",
  ORIGIN_BASE_URL: process.env.ORIGIN_BASE_URL || "http://localhost:4001",
};