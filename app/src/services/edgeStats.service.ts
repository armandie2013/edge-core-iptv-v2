import { promises as fs } from "fs";
import { env } from "../config/env";

type ParsedLogLine = {
  time: string;
  clientIp: string;
  method: string;
  uri: string;
  status: number;
  bytes: number;
  requestTime: number;
  upstreamAddr: string;
  upstreamStatus: string;
  cacheStatus: string;
  userAgent: string;
};

export type EdgeStats = {
  ok: boolean;
  logFile: string;
  generatedAt: string;
  error?: string;

  totals: {
    totalRequests: number;
    fragmentRequests: number;
    healthRequests: number;
    panelRequests: number;
    uniqueClients: number;
    originRequests: number;
    servedFromCache: number;
    bytesSent: number;
  };

  cache: {
    HIT: number;
    MISS: number;
    BYPASS: number;
    EXPIRED: number;
    STALE: number;
    UPDATING: number;
    REVALIDATED: number;
    NONE: number;
    OTHER: number;
  };

  statusCodes: Record<string, number>;

  topClients: Array<{
    ip: string;
    requests: number;
    fragments: number;
    bytes: number;
  }>;

  topFragments: Array<{
    uri: string;
    requests: number;
    hit: number;
    miss: number;
    originRequests: number;
  }>;

  recentRequests: ParsedLogLine[];
};

function emptyStats(): EdgeStats {
  return {
    ok: true,
    logFile: env.EDGE_ACCESS_LOG,
    generatedAt: new Date().toISOString(),
    totals: {
      totalRequests: 0,
      fragmentRequests: 0,
      healthRequests: 0,
      panelRequests: 0,
      uniqueClients: 0,
      originRequests: 0,
      servedFromCache: 0,
      bytesSent: 0,
    },
    cache: {
      HIT: 0,
      MISS: 0,
      BYPASS: 0,
      EXPIRED: 0,
      STALE: 0,
      UPDATING: 0,
      REVALIDATED: 0,
      NONE: 0,
      OTHER: 0,
    },
    statusCodes: {},
    topClients: [],
    topFragments: [],
    recentRequests: [],
  };
}

async function readLastBytes(filePath: string, maxBytes: number): Promise<string> {
  const stat = await fs.stat(filePath);
  const start = Math.max(0, stat.size - maxBytes);
  const length = stat.size - start;

  const handle = await fs.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

/**
 * Formato esperado desde Nginx:
 *
 * $time_iso8601|$remote_addr|$request_method|$uri|$status|$body_bytes_sent|$request_time|$upstream_addr|$upstream_status|$upstream_cache_status|$http_user_agent
 */
function parseLine(line: string): ParsedLogLine | null {
  const parts = line.split("|");

  if (parts.length < 10) {
    return null;
  }

  const [
    time,
    clientIp,
    method,
    uri,
    statusRaw,
    bytesRaw,
    requestTimeRaw,
    upstreamAddr,
    upstreamStatus,
    cacheStatusRaw,
    ...userAgentParts
  ] = parts;

  const status = Number(statusRaw);
  const bytes = Number(bytesRaw);
  const requestTime = Number(requestTimeRaw);

  if (!time || !clientIp || !uri || Number.isNaN(status)) {
    return null;
  }

  const cacheStatus =
    cacheStatusRaw && cacheStatusRaw !== "-" ? cacheStatusRaw.toUpperCase() : "NONE";

  return {
    time,
    clientIp,
    method,
    uri,
    status,
    bytes: Number.isNaN(bytes) ? 0 : bytes,
    requestTime: Number.isNaN(requestTime) ? 0 : requestTime,
    upstreamAddr: upstreamAddr || "-",
    upstreamStatus: upstreamStatus || "-",
    cacheStatus,
    userAgent: userAgentParts.join("|") || "-",
  };
}

function isFragmentRequest(uri: string): boolean {
  return uri.endsWith(".ts") || uri.includes(".ts?");
}

function isHealthRequest(uri: string): boolean {
  return uri === "/health";
}

function isPanelRequest(uri: string): boolean {
  return uri === "/panel";
}

function shouldCountAsOriginRequest(line: ParsedLogLine): boolean {
  if (line.upstreamAddr === "-" || line.upstreamStatus === "-") {
    return false;
  }

  /**
   * En Nginx, HIT significa que salió desde caché.
   * MISS / EXPIRED / BYPASS / STALE / UPDATING pueden tener upstream.
   * Para nuestro panel, contamos como Origin todo lo que tuvo upstream
   * y no fue HIT.
   */
  return line.cacheStatus !== "HIT";
}

function incrementRecord(record: Record<string, number>, key: string, amount = 1) {
  record[key] = (record[key] || 0) + amount;
}

export async function getEdgeStats(): Promise<EdgeStats> {
  const stats = emptyStats();

  let raw = "";

  try {
    raw = await readLastBytes(env.EDGE_ACCESS_LOG, env.EDGE_LOG_MAX_BYTES);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el log";
    return {
      ...stats,
      ok: false,
      error: message,
    };
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((line): line is ParsedLogLine => Boolean(line));

  const uniqueClients = new Set<string>();

  const clientsMap = new Map<
    string,
    {
      ip: string;
      requests: number;
      fragments: number;
      bytes: number;
    }
  >();

  const fragmentsMap = new Map<
    string,
    {
      uri: string;
      requests: number;
      hit: number;
      miss: number;
      originRequests: number;
    }
  >();

  for (const line of lines) {
    stats.totals.totalRequests += 1;
    stats.totals.bytesSent += line.bytes;

    uniqueClients.add(line.clientIp);

    incrementRecord(stats.statusCodes, String(line.status));

    if (line.cacheStatus in stats.cache) {
      stats.cache[line.cacheStatus as keyof EdgeStats["cache"]] += 1;
    } else {
      stats.cache.OTHER += 1;
    }

    if (line.cacheStatus === "HIT") {
      stats.totals.servedFromCache += 1;
    }

    if (shouldCountAsOriginRequest(line)) {
      stats.totals.originRequests += 1;
    }

    if (isHealthRequest(line.uri)) {
      stats.totals.healthRequests += 1;
    }

    if (isPanelRequest(line.uri)) {
      stats.totals.panelRequests += 1;
    }

    const isFragment = isFragmentRequest(line.uri);

    if (isFragment) {
      stats.totals.fragmentRequests += 1;
    }

    const client = clientsMap.get(line.clientIp) || {
      ip: line.clientIp,
      requests: 0,
      fragments: 0,
      bytes: 0,
    };

    client.requests += 1;
    client.bytes += line.bytes;

    if (isFragment) {
      client.fragments += 1;
    }

    clientsMap.set(line.clientIp, client);

    if (isFragment) {
      const fragment = fragmentsMap.get(line.uri) || {
        uri: line.uri,
        requests: 0,
        hit: 0,
        miss: 0,
        originRequests: 0,
      };

      fragment.requests += 1;

      if (line.cacheStatus === "HIT") {
        fragment.hit += 1;
      } else {
        fragment.miss += 1;
      }

      if (shouldCountAsOriginRequest(line)) {
        fragment.originRequests += 1;
      }

      fragmentsMap.set(line.uri, fragment);
    }
  }

  stats.totals.uniqueClients = uniqueClients.size;

  stats.topClients = Array.from(clientsMap.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);

  stats.topFragments = Array.from(fragmentsMap.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);

  stats.recentRequests = lines.slice(-30).reverse();

  return stats;
}