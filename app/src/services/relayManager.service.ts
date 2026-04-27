import http from "http";
import https from "https";
import { Request, Response } from "express";
import { ClientRequest, IncomingMessage } from "http";
import { env } from "../config/env";

type RelayClient = {
  id: string;
  ip: string;
  userAgent: string;
  connectedAt: Date;
  res: Response;
  bytesSent: number;
};

type RelayChannel = {
  channelId: string;
  originUrl: string;
  createdAt: Date;
  lastClientAt?: Date;
  lastChunkAt?: Date;
  lastReconnectAt?: Date;
  lastError?: string;
  lastStatusCode?: number;

  clients: Map<string, RelayClient>;

  upstreamReq?: ClientRequest;
  upstreamRes?: IncomingMessage;
  reconnectTimer?: NodeJS.Timeout;

  started: boolean;
  connecting: boolean;
  upstreamConnected: boolean;
  stopped: boolean;

  originConnections: number;
  reconnects: number;
  chunksFromOrigin: number;
  bytesFromOrigin: number;
  bytesToClients: number;
};

export type RelayChannelStats = {
  channelId: string;
  originUrl: string;
  createdAt: string;
  uptimeSeconds: number;
  lastClientAt?: string;
  lastChunkAt?: string;
  lastReconnectAt?: string;
  lastError?: string;
  lastStatusCode?: number;

  clientCount: number;
  clients: Array<{
    id: string;
    ip: string;
    userAgent: string;
    connectedAt: string;
    secondsConnected: number;
    bytesSent: number;
  }>;

  started: boolean;
  connecting: boolean;
  upstreamConnected: boolean;
  originConnections: number;
  reconnects: number;
  chunksFromOrigin: number;
  bytesFromOrigin: number;
  bytesToClients: number;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildOriginUrl(channelId: string): string {
  return `${normalizeBaseUrl(env.ORIGIN_BASE_URL)}/proxy/${channelId}.ts`;
}

function nowIso(date?: Date): string | undefined {
  return date ? date.toISOString() : undefined;
}

function secondsSince(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket.remoteAddress || "unknown";
}

function getUserAgent(req: Request): string {
  const userAgent = req.headers["user-agent"];

  if (typeof userAgent === "string" && userAgent.trim()) {
    return userAgent;
  }

  return "-";
}

function createClientId(channelId: string): string {
  return `${channelId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

class RelayManager {
  private channels = new Map<string, RelayChannel>();

  attachClient(channelId: string, req: Request, res: Response) {
    const channel = this.getOrCreateChannel(channelId);

    this.ensureStarted(channel);

    const clientId = createClientId(channelId);

    const client: RelayClient = {
      id: clientId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      connectedAt: new Date(),
      res,
      bytesSent: 0,
    };

    channel.clients.set(clientId, client);
    channel.lastClientAt = new Date();

    res.statusCode = 200;
    res.setHeader("Content-Type", "video/mp2t");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("X-Edge-Node", env.NODE_CODE);
    res.setHeader("X-Edge-Relay", "active");
    res.setHeader("X-Edge-Channel", channelId);
    res.setHeader("X-Origin-Url", channel.originUrl);

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const removeClient = () => {
      channel.clients.delete(clientId);
    };

    req.on("close", removeClient);
    req.on("aborted", removeClient);
    res.on("close", removeClient);
    res.on("finish", removeClient);

    return;
  }

  getStats(): {
    generatedAt: string;
    totalChannels: number;
    activeChannels: number;
    totalActiveClients: number;
    activeOriginConnections: number;
    totalOriginConnections: number;
    totalReconnects: number;
    totalBytesFromOrigin: number;
    totalBytesToClients: number;
    channels: RelayChannelStats[];
  } {
    const channels = Array.from(this.channels.values()).map((channel) => {
      const clients = Array.from(channel.clients.values()).map((client) => ({
        id: client.id,
        ip: client.ip,
        userAgent: client.userAgent,
        connectedAt: client.connectedAt.toISOString(),
        secondsConnected: secondsSince(client.connectedAt),
        bytesSent: client.bytesSent,
      }));

      const stats: RelayChannelStats = {
        channelId: channel.channelId,
        originUrl: channel.originUrl,
        createdAt: channel.createdAt.toISOString(),
        uptimeSeconds: secondsSince(channel.createdAt),
        lastClientAt: nowIso(channel.lastClientAt),
        lastChunkAt: nowIso(channel.lastChunkAt),
        lastReconnectAt: nowIso(channel.lastReconnectAt),
        lastError: channel.lastError,
        lastStatusCode: channel.lastStatusCode,

        clientCount: channel.clients.size,
        clients,

        started: channel.started,
        connecting: channel.connecting,
        upstreamConnected: channel.upstreamConnected,
        originConnections: channel.originConnections,
        reconnects: channel.reconnects,
        chunksFromOrigin: channel.chunksFromOrigin,
        bytesFromOrigin: channel.bytesFromOrigin,
        bytesToClients: channel.bytesToClients,
      };

      return stats;
    });

    return {
      generatedAt: new Date().toISOString(),
      totalChannels: channels.length,
      activeChannels: channels.filter((channel) => channel.started).length,
      totalActiveClients: channels.reduce((sum, channel) => sum + channel.clientCount, 0),
      activeOriginConnections: channels.filter((channel) => channel.upstreamConnected).length,
      totalOriginConnections: channels.reduce((sum, channel) => sum + channel.originConnections, 0),
      totalReconnects: channels.reduce((sum, channel) => sum + channel.reconnects, 0),
      totalBytesFromOrigin: channels.reduce((sum, channel) => sum + channel.bytesFromOrigin, 0),
      totalBytesToClients: channels.reduce((sum, channel) => sum + channel.bytesToClients, 0),
      channels: channels.sort((a, b) => b.clientCount - a.clientCount || a.channelId.localeCompare(b.channelId)),
    };
  }

  private getOrCreateChannel(channelId: string): RelayChannel {
    const existing = this.channels.get(channelId);

    if (existing) {
      return existing;
    }

    const channel: RelayChannel = {
      channelId,
      originUrl: buildOriginUrl(channelId),
      createdAt: new Date(),
      clients: new Map(),

      started: false,
      connecting: false,
      upstreamConnected: false,
      stopped: false,

      originConnections: 0,
      reconnects: 0,
      chunksFromOrigin: 0,
      bytesFromOrigin: 0,
      bytesToClients: 0,
    };

    this.channels.set(channelId, channel);

    return channel;
  }

  private ensureStarted(channel: RelayChannel) {
    if (channel.started || channel.connecting) {
      return;
    }

    channel.started = true;
    channel.stopped = false;

    this.connectToOrigin(channel);
  }

  private connectToOrigin(channel: RelayChannel) {
    if (channel.connecting || channel.upstreamConnected) {
      return;
    }

    channel.connecting = true;
    channel.lastError = undefined;
    channel.lastReconnectAt = new Date();

    const originUrl = new URL(channel.originUrl);
    const client = originUrl.protocol === "https:" ? https : http;

    const request = client.request(
      originUrl,
      {
        method: "GET",
        headers: {
          Accept: "*/*",
          "User-Agent": `${env.NODE_CODE}/relay`,
          Connection: "keep-alive",
        },
      },
      (originResponse) => {
        channel.upstreamRes = originResponse;
        channel.connecting = false;
        channel.lastStatusCode = originResponse.statusCode;
        channel.originConnections += 1;

        if (!originResponse.statusCode || originResponse.statusCode >= 400) {
          channel.upstreamConnected = false;
          channel.lastError = `Origin respondió HTTP ${originResponse.statusCode || "desconocido"}`;

          originResponse.resume();

          this.endClientsWithError(channel, channel.lastError);
          this.clearUpstream(channel);

          /**
           * Si el canal fue inválido, no lo dejamos reconectando infinito.
           * Si un cliente lo vuelve a pedir, se intenta de nuevo.
           */
          channel.started = false;
          return;
        }

        channel.upstreamConnected = true;

        originResponse.on("data", (chunk: Buffer) => {
          channel.lastChunkAt = new Date();
          channel.chunksFromOrigin += 1;
          channel.bytesFromOrigin += chunk.length;

          for (const clientStream of channel.clients.values()) {
            if (clientStream.res.destroyed || clientStream.res.writableEnded) {
              channel.clients.delete(clientStream.id);
              continue;
            }

            try {
              clientStream.res.write(chunk);
              clientStream.bytesSent += chunk.length;
              channel.bytesToClients += chunk.length;
            } catch {
              channel.clients.delete(clientStream.id);
            }
          }

          /**
           * Importante:
           * Si no hay clientes, descartamos los chunks, pero NO cerramos
           * la conexión al Origin. Esto mantiene el canal caliente en el Edge.
           */
        });

        originResponse.on("end", () => {
          channel.lastError = "Origin cerró el stream";
          this.clearUpstream(channel);
          this.scheduleReconnect(channel);
        });

        originResponse.on("close", () => {
          if (!channel.stopped) {
            channel.lastError = "Conexión al Origin cerrada";
            this.clearUpstream(channel);
            this.scheduleReconnect(channel);
          }
        });

        originResponse.on("error", (error) => {
          channel.lastError = error.message;
          this.clearUpstream(channel);
          this.scheduleReconnect(channel);
        });
      }
    );

    channel.upstreamReq = request;

    request.on("error", (error) => {
      channel.lastError = error.message;
      this.clearUpstream(channel);
      this.scheduleReconnect(channel);
    });

    request.setTimeout(15000, () => {
      channel.lastError = "Timeout conectando al Origin";
      request.destroy(new Error(channel.lastError));
    });

    request.end();
  }

  private clearUpstream(channel: RelayChannel) {
    channel.connecting = false;
    channel.upstreamConnected = false;

    if (channel.upstreamReq) {
      channel.upstreamReq.removeAllListeners();
      channel.upstreamReq.destroy();
      channel.upstreamReq = undefined;
    }

    if (channel.upstreamRes) {
      channel.upstreamRes.removeAllListeners();
      channel.upstreamRes.destroy();
      channel.upstreamRes = undefined;
    }
  }

  private scheduleReconnect(channel: RelayChannel) {
    if (channel.stopped) {
      return;
    }

    if (channel.reconnectTimer) {
      return;
    }

    channel.reconnects += 1;

    channel.reconnectTimer = setTimeout(() => {
      channel.reconnectTimer = undefined;
      this.connectToOrigin(channel);
    }, env.RELAY_RECONNECT_MS);
  }

  private endClientsWithError(channel: RelayChannel, message: string) {
    for (const client of channel.clients.values()) {
      try {
        if (!client.res.destroyed && !client.res.writableEnded) {
          client.res.end();
        }
      } catch {
        // ignoramos errores al cerrar clientes
      }
    }

    channel.clients.clear();
    channel.lastError = message;
  }
}

export const relayManager = new RelayManager();

export function getRelayStats() {
  return relayManager.getStats();
}