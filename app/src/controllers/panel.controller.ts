import { Request, Response } from "express";
import { env } from "../config/env";
import { getEdgeStats } from "../services/edgeStats.service";
import { getRelayStats } from "../services/relayManager.service";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size = size / 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatDateTimeAR(value: string | Date | undefined): string {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function percent(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export async function panelController(_req: Request, res: Response) {
  const stats = await getEdgeStats();
  const relay = getRelayStats();

  const cacheTotal =
    stats.cache.HIT +
    stats.cache.MISS +
    stats.cache.BYPASS +
    stats.cache.EXPIRED +
    stats.cache.STALE +
    stats.cache.UPDATING +
    stats.cache.REVALIDATED +
    stats.cache.NONE +
    stats.cache.OTHER;

  const hitRate = percent(stats.cache.HIT, cacheTotal);

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  return res.status(200).send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="5" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(env.NODE_NAME)} - Panel</title>

  <style>
    :root {
      --bg: #020617;
      --card: rgba(15, 23, 42, 0.86);
      --border: rgba(51, 65, 85, 0.9);
      --text: #f1f5f9;
      --text-soft: #cbd5e1;
      --muted: #94a3b8;
      --cyan: #22d3ee;
      --emerald: #34d399;
      --yellow: #facc15;
      --red: #fb7185;
      --blue: #60a5fa;
      --shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(34, 211, 238, 0.12), transparent 36%),
        radial-gradient(circle at top right, rgba(52, 211, 153, 0.10), transparent 30%),
        var(--bg);
      color: var(--text);
      font-family: "Segoe UI", Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      line-height: 1.38;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    .page {
      width: min(1280px, calc(100% - 28px));
      margin: 0 auto;
      padding: 18px 0 28px;
    }

    .hero,
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }

    .hero {
      border-radius: 24px;
      padding: 18px 20px;
      margin-bottom: 14px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.68));
    }

    .hero-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .eyebrow {
      margin: 0 0 7px;
      color: var(--cyan);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }

    h1 {
      margin: 0;
      font-size: clamp(24px, 3vw, 36px);
      line-height: 1.08;
      font-weight: 650;
      letter-spacing: -0.025em;
      color: #f8fafc;
    }

    .subtitle {
      color: var(--text-soft);
      margin: 9px 0 0;
      font-size: 14px;
      font-weight: 400;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid rgba(52, 211, 153, 0.45);
      background: rgba(16, 185, 129, 0.10);
      color: var(--emerald);
      border-radius: 999px;
      padding: 7px 11px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--emerald);
      box-shadow: 0 0 16px rgba(52, 211, 153, 0.95);
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .meta {
      background: rgba(2, 6, 23, 0.28);
      border: 1px solid rgba(51, 65, 85, 0.65);
      border-radius: 16px;
      padding: 10px 12px;
      min-width: 0;
    }

    .meta span,
    .card-title,
    th {
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.055em;
      font-weight: 600;
    }

    .meta span {
      display: block;
      margin-bottom: 5px;
    }

    .meta strong {
      display: block;
      overflow-wrap: anywhere;
      font-size: 13px;
      font-weight: 500;
      color: var(--text);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }

    .card {
      border-radius: 20px;
      padding: 14px;
      min-width: 0;
    }

    .card-title {
      margin: 0 0 7px;
    }

    .value {
      font-size: 27px;
      line-height: 1.02;
      margin: 0;
      font-weight: 650;
      letter-spacing: -0.035em;
    }

    .value.small {
      font-size: 21px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .hint {
      margin: 7px 0 0;
      color: var(--text-soft);
      font-size: 12px;
      font-weight: 400;
    }

    .cyan { color: var(--cyan); }
    .emerald { color: var(--emerald); }
    .yellow { color: var(--yellow); }
    .red { color: var(--red); }
    .blue { color: var(--blue); }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }

    .section-title h2 {
      font-size: 16px;
      margin: 0;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #f8fafc;
    }

    .section-title span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 400;
      text-align: right;
    }

    .table-wrap {
      width: 100%;
      overflow-x: hidden;
      border-radius: 16px;
      border: 1px solid rgba(51, 65, 85, 0.7);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: rgba(2, 6, 23, 0.25);
    }

    th,
    td {
      padding: 7px 9px;
      border-bottom: 1px solid rgba(51, 65, 85, 0.55);
      text-align: left;
      font-size: 12px;
      line-height: 1.22;
      color: #e2e8f0;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: normal;
      font-weight: 400;
      vertical-align: middle;
    }

    th {
      color: #cbd5e1;
      background: rgba(15, 23, 42, 0.94);
      font-size: 10px;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    .uri {
      overflow-wrap: anywhere;
      word-break: break-all;
      font-family: "Consolas", "Courier New", monospace;
      font-size: 11px;
      line-height: 1.18;
      color: #dbeafe;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      border-radius: 999px;
      padding: 3px 6px;
      font-size: 10px;
      line-height: 1;
      font-weight: 600;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(148, 163, 184, 0.10);
      color: #cbd5e1;
      letter-spacing: 0;
      white-space: nowrap;
    }

    .badge.hit {
      color: var(--emerald);
      border-color: rgba(52, 211, 153, 0.45);
      background: rgba(52, 211, 153, 0.10);
    }

    .badge.miss {
      color: var(--yellow);
      border-color: rgba(250, 204, 21, 0.45);
      background: rgba(250, 204, 21, 0.10);
    }

    .badge.error {
      color: var(--red);
      border-color: rgba(251, 113, 133, 0.45);
      background: rgba(251, 113, 133, 0.10);
    }

    .table-compact th,
    .table-compact td {
      padding-top: 6px;
      padding-bottom: 6px;
    }

    .table-active-channels col.col-canal {
      width: 31%;
    }

    .table-active-channels col.col-clientes {
      width: 7%;
    }

    .table-active-channels col.col-origin {
      width: 7%;
    }

    .table-active-channels col.col-estado {
      width: 10%;
    }

    .table-active-channels col.col-uptime {
      width: 9%;
    }

    .table-active-channels col.col-chunk {
      width: 15%;
    }

    .table-active-channels col.col-recibido {
      width: 10%;
    }

    .table-active-channels col.col-enviado {
      width: 11%;
    }

    .table-top-streams col.col-uri {
      width: 70%;
    }

    .table-top-streams col.col-req {
      width: 10%;
    }

    .table-top-streams col.col-hit {
      width: 10%;
    }

    .table-top-streams col.col-miss {
      width: 10%;
    }

    .table-last-requests col.col-hora {
      width: 16%;
    }

    .table-last-requests col.col-ip {
      width: 13%;
    }

    .table-last-requests col.col-uri {
      width: 38%;
    }

    .table-last-requests col.col-status {
      width: 8%;
    }

    .table-last-requests col.col-cache {
      width: 8%;
    }

    .table-last-requests col.col-upstream {
      width: 10%;
    }

    .table-last-requests col.col-tiempo {
      width: 7%;
    }

    .error-box {
      border: 1px solid rgba(251, 113, 133, 0.45);
      background: rgba(251, 113, 133, 0.10);
      color: #fecdd3;
      border-radius: 16px;
      padding: 12px;
      margin-top: 14px;
      font-size: 13px;
      line-height: 1.38;
      font-weight: 400;
    }

    .footer {
      color: var(--muted);
      font-size: 12px;
      text-align: center;
      margin-top: 16px;
      font-weight: 400;
    }

    @media (max-width: 1100px) {
      .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid-2 { grid-template-columns: 1fr; }
    }

    @media (max-width: 760px) {
      .page {
        width: min(100% - 18px, 1280px);
        padding-top: 12px;
      }

      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .meta-grid { grid-template-columns: 1fr; }

      .card,
      .hero {
        padding: 13px;
      }

      .value { font-size: 24px; }

      .table-wrap {
        overflow-x: auto;
      }

      table {
        min-width: 760px;
      }

      th,
      td {
        font-size: 12px;
        padding: 7px 8px;
      }

      .section-title {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
      }

      .section-title span {
        text-align: left;
      }
    }
  </style>
</head>

<body>
  <main class="page">
    <section class="hero">
      <div class="hero-row">
        <div>
          <p class="eyebrow">Edge IPTV Panel</p>
          <h1>${escapeHtml(env.NODE_NAME)}</h1>
          <p class="subtitle">
            Relay local por canal: una conexión al Origin por canal activo y múltiples clientes colgados del Edge.
          </p>
        </div>

        <div class="status-pill">
          <span class="dot"></span>
          ONLINE
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta">
          <span>Código</span>
          <strong>${escapeHtml(env.NODE_CODE)}</strong>
        </div>
        <div class="meta">
          <span>URL pública</span>
          <strong>${escapeHtml(env.PUBLIC_BASE_URL)}</strong>
        </div>
        <div class="meta">
          <span>Origin</span>
          <strong>${escapeHtml(env.ORIGIN_BASE_URL)}</strong>
        </div>
        <div class="meta">
          <span>Actualizado</span>
          <strong>${escapeHtml(formatDateTimeAR(relay.generatedAt))}</strong>
        </div>
      </div>

      ${
        stats.ok
          ? ""
          : `<div class="error-box">
              No se pudo leer el log del Edge: <strong>${escapeHtml(stats.error)}</strong><br />
              Log esperado: <strong>${escapeHtml(stats.logFile)}</strong>
            </div>`
      }
    </section>

    <section class="cards">
      <div class="card">
        <p class="card-title">Requests</p>
        <p class="value cyan">${stats.totals.totalRequests}</p>
        <p class="hint">Última ventana de log</p>
      </div>

      <div class="card">
        <p class="card-title">Canales abiertos</p>
        <p class="value blue">${relay.totalChannels}</p>
        <p class="hint">Quedan calientes</p>
      </div>

      <div class="card">
        <p class="card-title">Clientes activos</p>
        <p class="value emerald">${relay.totalActiveClients}</p>
        <p class="hint">Conectados ahora</p>
      </div>

      <div class="card">
        <p class="card-title">Origin activos</p>
        <p class="value yellow">${relay.activeOriginConnections}</p>
        <p class="hint">1 por canal conectado</p>
      </div>

      <div class="card">
        <p class="card-title">Reconexiones</p>
        <p class="value red">${relay.totalReconnects}</p>
        <p class="hint">Streams reabiertos</p>
      </div>

      <div class="card">
        <p class="card-title">Tráfico Edge</p>
        <p class="value small red">${formatBytes(relay.totalBytesToClients || stats.totals.bytesSent)}</p>
        <p class="hint">Enviado a clientes</p>
      </div>
    </section>

    <section class="card" style="margin-bottom: 14px;">
      <div class="section-title">
        <h2>Canales activos / calientes</h2>
        <span>El canal queda abierto aunque no tenga clientes</span>
      </div>

      <div class="table-wrap">
        <table class="table-compact table-active-channels">
          <colgroup>
            <col class="col-canal" />
            <col class="col-clientes" />
            <col class="col-origin" />
            <col class="col-estado" />
            <col class="col-uptime" />
            <col class="col-chunk" />
            <col class="col-recibido" />
            <col class="col-enviado" />
          </colgroup>
          <thead>
            <tr>
              <th>Canal</th>
              <th>Clientes</th>
              <th>Origin</th>
              <th>Estado</th>
              <th>Uptime</th>
              <th>Último chunk</th>
              <th>Origen recibido</th>
              <th>Clientes enviado</th>
            </tr>
          </thead>
          <tbody>
            ${
              relay.channels.length
                ? relay.channels
                    .map((channel) => {
                      const statusClass = channel.upstreamConnected ? "hit" : channel.connecting ? "miss" : "error";
                      const statusText = channel.upstreamConnected
                        ? "CONECTADO"
                        : channel.connecting
                          ? "CONECTANDO"
                          : "SIN ORIGIN";

                      return `
                        <tr>
                          <td class="uri">/proxy/${escapeHtml(channel.channelId)}.ts</td>
                          <td>${channel.clientCount}</td>
                          <td>${channel.originConnections}</td>
                          <td><span class="badge ${statusClass}">${statusText}</span></td>
                          <td>${formatDuration(channel.uptimeSeconds)}</td>
                          <td>${escapeHtml(formatDateTimeAR(channel.lastChunkAt))}</td>
                          <td>${formatBytes(channel.bytesFromOrigin)}</td>
                          <td>${formatBytes(channel.bytesToClients)}</td>
                        </tr>
                      `;
                    })
                    .join("")
                : `<tr><td colspan="8">Todavía no hay canales abiertos</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="section-title">
          <h2>Top clientes</h2>
          <span>Según logs de Nginx</span>
        </div>

        <div class="table-wrap">
          <table class="table-compact">
            <thead>
              <tr>
                <th>IP</th>
                <th>Requests</th>
                <th>Streams</th>
                <th>Tráfico</th>
              </tr>
            </thead>
            <tbody>
              ${
                stats.topClients.length
                  ? stats.topClients
                      .map(
                        (client) => `
                          <tr>
                            <td>${escapeHtml(client.ip)}</td>
                            <td>${client.requests}</td>
                            <td>${client.fragments}</td>
                            <td>${formatBytes(client.bytes)}</td>
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="4">Sin datos</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="section-title">
          <h2>Top streams solicitados</h2>
          <span>Pedidos /proxy/*.ts</span>
        </div>

        <div class="table-wrap">
          <table class="table-compact table-top-streams">
            <colgroup>
              <col class="col-uri" />
              <col class="col-req" />
              <col class="col-hit" />
              <col class="col-miss" />
            </colgroup>
            <thead>
              <tr>
                <th>URI</th>
                <th>Req</th>
                <th>HIT</th>
                <th>MISS</th>
              </tr>
            </thead>
            <tbody>
              ${
                stats.topFragments.length
                  ? stats.topFragments
                      .map(
                        (fragment) => `
                          <tr>
                            <td class="uri" title="${escapeHtml(fragment.uri)}">${escapeHtml(fragment.uri)}</td>
                            <td>${fragment.requests}</td>
                            <td>${fragment.hit}</td>
                            <td>${fragment.miss}</td>
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="4">Sin datos</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="section-title">
          <h2>Cache Nginx</h2>
          <span>Reservado para uso posterior</span>
        </div>

        <div class="table-wrap">
          <table class="table-compact">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><span class="badge hit">HIT</span></td><td>${stats.cache.HIT}</td></tr>
              <tr><td><span class="badge miss">MISS</span></td><td>${stats.cache.MISS}</td></tr>
              <tr><td><span class="badge">NONE</span></td><td>${stats.cache.NONE}</td></tr>
              <tr><td><span class="badge">EXPIRED</span></td><td>${stats.cache.EXPIRED}</td></tr>
              <tr><td><span class="badge">STALE</span></td><td>${stats.cache.STALE}</td></tr>
              <tr><td><span class="badge">BYPASS</span></td><td>${stats.cache.BYPASS}</td></tr>
              <tr><td><span class="badge">HIT RATE</span></td><td>${hitRate}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="section-title">
          <h2>Códigos HTTP</h2>
          <span>Estado de respuestas Nginx</span>
        </div>

        <div class="table-wrap">
          <table class="table-compact">
            <thead>
              <tr>
                <th>Status</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${
                Object.entries(stats.statusCodes).length
                  ? Object.entries(stats.statusCodes)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([status, count]) => {
                        const badgeClass = status.startsWith("5") || status.startsWith("4") ? "error" : "hit";
                        return `<tr><td><span class="badge ${badgeClass}">${escapeHtml(status)}</span></td><td>${count}</td></tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="2">Sin datos</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="section-title">
        <h2>Últimos requests</h2>
        <span>Auto refresh cada 5 segundos</span>
      </div>

      <div class="table-wrap">
        <table class="table-compact table-last-requests">
          <colgroup>
            <col class="col-hora" />
            <col class="col-ip" />
            <col class="col-uri" />
            <col class="col-status" />
            <col class="col-cache" />
            <col class="col-upstream" />
            <col class="col-tiempo" />
          </colgroup>
          <thead>
            <tr>
              <th>Hora</th>
              <th>IP</th>
              <th>URI</th>
              <th>Status</th>
              <th>Cache</th>
              <th>Upstream</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>
            ${
              stats.recentRequests.length
                ? stats.recentRequests
                    .map((item) => {
                      const cacheClass =
                        item.cacheStatus === "HIT"
                          ? "hit"
                          : item.cacheStatus === "MISS"
                            ? "miss"
                            : "";

                      const statusClass = item.status >= 400 ? "error" : "hit";

                      return `
                        <tr>
                          <td>${escapeHtml(formatDateTimeAR(item.time))}</td>
                          <td>${escapeHtml(item.clientIp)}</td>
                          <td class="uri" title="${escapeHtml(item.uri)}">${escapeHtml(item.uri)}</td>
                          <td><span class="badge ${statusClass}">${item.status}</span></td>
                          <td><span class="badge ${cacheClass}">${escapeHtml(item.cacheStatus)}</span></td>
                          <td>${escapeHtml(item.upstreamAddr)}</td>
                          <td>${item.requestTime.toFixed(3)}s</td>
                        </tr>
                      `;
                    })
                    .join("")
                : `<tr><td colspan="7">Sin datos</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    <p class="footer">
      Log: ${escapeHtml(stats.logFile)} · Nodo: ${escapeHtml(env.NODE_CODE)} · Modo: Relay local por canal
    </p>
  </main>
</body>
</html>`);
}