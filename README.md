# Edge Core IPTV V2

Edge Core IPTV V2 es una aplicación Node.js/TypeScript pensada para funcionar como **servidor Edge** dentro de una arquitectura IPTV distribuida.

Su función principal es recibir solicitudes de clientes IPTV, consumir el stream desde un servidor **Origin**, y distribuirlo localmente desde el Edge evitando que cada cliente abra una conexión directa contra el Origin.

El Edge mantiene una lógica de **relay por canal**, donde varios clientes mirando el mismo canal comparten una única conexión hacia el Origin.

---

## 1. Descripción general

Este proyecto cumple el rol de **nodo Edge** dentro del sistema IPTV.

Permite:

- Recibir conexiones de clientes IPTV.
- Consumir canales desde un servidor Origin.
- Servir streams mediante proxy `.ts`.
- Mantener una sola conexión al Origin por canal activo.
- Distribuir el mismo canal a múltiples clientes locales.
- Reducir consumo de ancho de banda entre Edge y Origin.
- Mostrar un panel web básico del estado del nodo.
- Exponer endpoint `/health` para monitoreo.
- Ver clientes conectados por canal.
- Ver estadísticas de relays activos.
- Configurar cierre automático de canales sin clientes.
- Usar Nginx como proxy frontal.
- Ejecutarse en producción con `systemd`.

---

## 2. Arquitectura esperada

```txt
Clientes IPTV / App Android / STB
        |
        |  http://EDGE_IP:5001/proxy/ID.ts
        |
Edge Core IPTV V2
        |
        |  Una sola conexión por canal activo
        |
Origin Core IPTV V2
        |
        |  http://ORIGIN_IP:4001/proxy/ID.ts
        |
Fuente IPTV / Tvheadend
```

Ejemplo:

```txt
Origin: http://10.254.1.11:4001
Edge:   http://10.254.1.15:5001
Panel:  http://10.254.1.15:5001/panel
Health: http://10.254.1.15:5001/health
Stream: http://10.254.1.15:5001/proxy/123.ts
```

---

## 3. Objetivo del Edge

El objetivo principal del Edge es evitar que muchos clientes consuman directamente desde el Origin.

Ejemplo:

```txt
10 clientes mirando Canal 123
        |
        | 10 conexiones locales al Edge
        |
Edge abre solo 1 conexión al Origin
        |
Origin recibe 1 conexión para Canal 123
```

Esto mejora:

- Rendimiento.
- Estabilidad.
- Uso de ancho de banda.
- Escalabilidad.
- Control por localidad.
- Administración por ISP o zona.

---

## 4. Tecnologías utilizadas

- Node.js
- TypeScript
- Express
- CORS
- Dotenv
- Nginx
- Ubuntu Server 24.04 LTS
- systemd
- Relay Manager interno
- Proxy HTTP para streams `.ts`

---

## 5. Requisitos previos

Servidor recomendado:

- Ubuntu Server 24.04 LTS.
- CPU Intel i5/i7 o superior para producción.
- RAM mínima: 4 GB.
- Red cableada estable.
- IP fija.
- Acceso SSH.
- Conectividad hacia el Origin.
- Conectividad hacia los clientes locales.
- Nginx instalado.
- Node.js LTS instalado.

Paquetes necesarios:

```bash
sudo apt update
sudo apt install -y git curl nano nginx htop
```

Instalar Node.js LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

Verificar instalación:

```bash
node -v
npm -v
```

---

## 6. Clonar el proyecto

Ubicación recomendada:

```bash
sudo mkdir -p /opt/edge-core-iptv-v2
sudo chown -R $USER:$USER /opt/edge-core-iptv-v2
cd /opt/edge-core-iptv-v2
```

Clonar repositorio:

```bash
git clone https://github.com/armandie2013/edge-core-iptv-v2.git app
cd app
```

---

## 7. Instalar dependencias

```bash
npm install
```

---

## 8. Variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```bash
nano .env
```

Ejemplo para un Edge:

```env
APP_PORT=5010

NODE_NAME=Edge Ancasti V2
NODE_CODE=EDGE-ANCASTI-V2

PUBLIC_BASE_URL=http://10.254.1.15:5001
ORIGIN_BASE_URL=http://10.254.1.11:4001

EDGE_ACCESS_LOG=/var/log/nginx/edge_access.log
EDGE_LOG_MAX_BYTES=2000000

RELAY_RECONNECT_MS=3000
RELAY_IDLE_CLOSE_MS=0
```

Ejemplo para otro Edge, como Villa Vil:

```env
APP_PORT=5010

NODE_NAME=Edge Villa Vil 1
NODE_CODE=EDGE-VILLA-VIL-1

PUBLIC_BASE_URL=http://10.254.1.20:5001
ORIGIN_BASE_URL=http://10.254.1.11:4001

EDGE_ACCESS_LOG=/var/log/nginx/edge_access.log
EDGE_LOG_MAX_BYTES=2000000

RELAY_RECONNECT_MS=3000
RELAY_IDLE_CLOSE_MS=0
```

---

## 9. Descripción de variables `.env`

### `APP_PORT`

Puerto interno donde escucha la aplicación Node.js.

Ejemplo:

```env
APP_PORT=5010
```

Normalmente Nginx escucha en el puerto público `5001` y reenvía al puerto interno `5010`.

---

### `NODE_NAME`

Nombre descriptivo del Edge.

Ejemplo:

```env
NODE_NAME=Edge Ancasti V2
```

---

### `NODE_CODE`

Código único del nodo Edge.

Ejemplo:

```env
NODE_CODE=EDGE-ANCASTI-V2
```

Este código sirve para identificar el nodo en respuestas, paneles, logs y headers.

---

### `PUBLIC_BASE_URL`

URL pública o interna por la cual los clientes acceden al Edge.

Ejemplo:

```env
PUBLIC_BASE_URL=http://10.254.1.15:5001
```

Esta URL normalmente apunta al puerto de Nginx.

---

### `ORIGIN_BASE_URL`

URL del servidor Origin desde donde el Edge toma los canales.

Ejemplo:

```env
ORIGIN_BASE_URL=http://10.254.1.11:4001
```

El Edge arma las URLs hacia el Origin así:

```txt
http://ORIGIN_BASE_URL/proxy/ID.ts
```

Ejemplo real:

```txt
http://10.254.1.11:4001/proxy/123.ts
```

---

### `EDGE_ACCESS_LOG`

Ruta del log de acceso de Nginx usado por el panel del Edge para mostrar estadísticas.

Ejemplo:

```env
EDGE_ACCESS_LOG=/var/log/nginx/edge_access.log
```

---

### `EDGE_LOG_MAX_BYTES`

Cantidad máxima de bytes a leer del log para generar estadísticas del panel.

Ejemplo:

```env
EDGE_LOG_MAX_BYTES=2000000
```

---

### `RELAY_RECONNECT_MS`

Tiempo en milisegundos para intentar reconectar el relay si se corta la conexión con el Origin.

Ejemplo:

```env
RELAY_RECONNECT_MS=3000
```

Significa que intentará reconectar cada 3 segundos.

---

### `RELAY_IDLE_CLOSE_MS`

Tiempo en milisegundos para cerrar un canal que no tiene clientes conectados.

Ejemplo:

```env
RELAY_IDLE_CLOSE_MS=0
```

Significa que el Edge no cierra automáticamente los canales aunque queden sin clientes.

Ejemplo:

```env
RELAY_IDLE_CLOSE_MS=10800000
```

Significa que el Edge cierra canales sin clientes luego de 3 horas.

---

## 10. Ejecutar en modo desarrollo

```bash
npm run dev
```

Probar health local:

```bash
curl http://localhost:5010/health
```

Probar raíz:

```bash
curl http://localhost:5010/
```

---

## 11. Compilar para producción

```bash
npm run build
```

Esto genera la carpeta:

```txt
dist/
```

---

## 12. Ejecutar en producción manualmente

```bash
npm run start
```

---

## 13. Scripts disponibles

El proyecto incluye estos scripts en `package.json`:

```json
{
  "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

Uso:

```bash
npm run dev
npm run build
npm run start
```

---

## 14. Endpoints principales

### Health check

```http
GET /health
```

Ejemplo:

```bash
curl http://10.254.1.15:5001/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "service": "edge-core-iptv-v2",
  "nodeName": "Edge Ancasti V2",
  "nodeCode": "EDGE-ANCASTI-V2",
  "status": "online",
  "publicBaseUrl": "http://10.254.1.15:5001",
  "originBaseUrl": "http://10.254.1.11:4001",
  "panelUrl": "http://10.254.1.15:5001/panel",
  "timestamp": "2026-05-04T00:00:00.000Z"
}
```

---

### Panel web

```http
GET /panel
```

Ejemplo:

```txt
http://10.254.1.15:5001/panel
```

El panel muestra:

- Estado del Edge.
- Nombre del nodo.
- Código del nodo.
- URL pública.
- URL del Origin.
- Estadísticas de requests.
- Relays activos.
- Clientes conectados.
- Canales activos.
- Bytes transferidos.
- Reconexiones.
- Últimas solicitudes.
- Estado general del relay manager.

---

### Proxy TS

```http
GET /proxy/:channelId.ts
```

Ejemplo:

```txt
http://10.254.1.15:5001/proxy/123.ts
```

El Edge toma el canal desde el Origin usando:

```txt
http://ORIGIN_BASE_URL/proxy/123.ts
```

Ejemplo:

```txt
http://10.254.1.11:4001/proxy/123.ts
```

---

### Raíz del servicio

```http
GET /
```

Ejemplo:

```bash
curl http://10.254.1.15:5001/
```

Respuesta esperada:

```json
{
  "ok": true,
  "service": "edge-core-iptv-v2",
  "message": "edge-core-iptv-v2 app online",
  "nodeName": "Edge Ancasti V2",
  "nodeCode": "EDGE-ANCASTI-V2",
  "publicBaseUrl": "http://10.254.1.15:5001",
  "originBaseUrl": "http://10.254.1.11:4001",
  "panelUrl": "http://10.254.1.15:5001/panel",
  "relayMode": "one-origin-connection-per-active-channel",
  "timestamp": "2026-05-04T00:00:00.000Z"
}
```

---

## 15. Configurar Nginx

Crear archivo de configuración:

```bash
sudo nano /etc/nginx/sites-available/edge-core-iptv-v2
```

Contenido recomendado:

```nginx
log_format edge_iptv '$time_iso8601|$remote_addr|$request_method|$uri|$status|$body_bytes_sent|$request_time|$upstream_addr|$upstream_status|$upstream_cache_status|$http_user_agent';

server {
    listen 5001;
    server_name _;

    charset utf-8;

    access_log /var/log/nginx/edge_access.log edge_iptv;
    error_log /var/log/nginx/edge_error.log warn;

    location = /health {
        proxy_pass http://127.0.0.1:5010/health;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location = /panel {
        proxy_pass http://127.0.0.1:5010/panel;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location = / {
        proxy_pass http://127.0.0.1:5010/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location ~ ^/proxy/([0-9]+)\.ts$ {
        proxy_pass http://127.0.0.1:5010/proxy/$1.ts;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Connection "";
        proxy_connect_timeout 10s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;

        proxy_buffering off;
        proxy_request_buffering off;

        default_type video/mp2t;

        add_header X-Edge-Mode "relay" always;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
```

Habilitar sitio:

```bash
sudo ln -s /etc/nginx/sites-available/edge-core-iptv-v2 /etc/nginx/sites-enabled/edge-core-iptv-v2
```

Verificar configuración:

```bash
sudo nginx -t
```

Reiniciar Nginx:

```bash
sudo systemctl restart nginx
```

Ver estado:

```bash
sudo systemctl status nginx
```

---

## 16. Crear servicio systemd

Crear archivo:

```bash
sudo nano /etc/systemd/system/edge-core-iptv-v2.service
```

Contenido:

```ini
[Unit]
Description=Edge Core IPTV V2 App
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/edge-core-iptv-v2/app
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

StandardOutput=append:/var/log/iptv/edge-app.log
StandardError=append:/var/log/iptv/edge-app-error.log

[Install]
WantedBy=multi-user.target
```

Crear carpeta de logs:

```bash
sudo mkdir -p /var/log/iptv
sudo chown -R $USER:$USER /var/log/iptv
```

Recargar systemd:

```bash
sudo systemctl daemon-reload
```

Habilitar servicio:

```bash
sudo systemctl enable edge-core-iptv-v2
```

Iniciar servicio:

```bash
sudo systemctl start edge-core-iptv-v2
```

Ver estado:

```bash
sudo systemctl status edge-core-iptv-v2
```

---

## 17. Verificar servicio en producción

Probar health local:

```bash
curl http://127.0.0.1:5010/health
```

Probar health vía Nginx:

```bash
curl http://10.254.1.15:5001/health
```

Probar panel:

```txt
http://10.254.1.15:5001/panel
```

Probar stream:

```txt
http://10.254.1.15:5001/proxy/ID_DEL_CANAL.ts
```

Ejemplo:

```txt
http://10.254.1.15:5001/proxy/123.ts
```

---

## 18. Comandos útiles

Ver estado del servicio:

```bash
sudo systemctl status edge-core-iptv-v2
```

Reiniciar servicio:

```bash
sudo systemctl restart edge-core-iptv-v2
```

Detener servicio:

```bash
sudo systemctl stop edge-core-iptv-v2
```

Ver logs en vivo:

```bash
sudo journalctl -u edge-core-iptv-v2 -f
```

Ver log principal:

```bash
tail -f /var/log/iptv/edge-app.log
```

Ver log de errores:

```bash
tail -f /var/log/iptv/edge-app-error.log
```

Ver log de acceso de Nginx:

```bash
tail -f /var/log/nginx/edge_access.log
```

Ver log de errores de Nginx:

```bash
tail -f /var/log/nginx/edge_error.log
```

Ver procesos Node:

```bash
ps aux | grep node
```

Ver puertos abiertos:

```bash
sudo ss -ltnp
```

Ver recursos del servidor:

```bash
htop
```

---

## 19. Proceso de actualización en producción

Entrar al proyecto:

```bash
cd /opt/edge-core-iptv-v2/app
```

Verificar rama y estado:

```bash
git status
git branch
```

Traer últimos cambios:

```bash
git pull
```

Instalar dependencias nuevas si las hubiera:

```bash
npm install
```

Eliminar build anterior:

```bash
rm -rf dist
```

Compilar nuevamente:

```bash
npm run build
```

Reiniciar servicio:

```bash
sudo systemctl restart edge-core-iptv-v2
```

Verificar estado:

```bash
sudo systemctl status edge-core-iptv-v2
```

Ver logs:

```bash
sudo journalctl -u edge-core-iptv-v2 -f
```

Probar health:

```bash
curl http://127.0.0.1:5010/health
```

Probar health vía Nginx:

```bash
curl http://127.0.0.1:5001/health
```

---

## 20. Verificar qué `.env` usa el servicio

Ver configuración real del servicio:

```bash
sudo systemctl cat edge-core-iptv-v2
```

Ver carpeta de trabajo:

```bash
sudo systemctl status edge-core-iptv-v2
```

Buscar archivos `.env`:

```bash
sudo find /opt/edge-core-iptv-v2 -name ".env" -type f
```

Editar el `.env` correcto:

```bash
nano /opt/edge-core-iptv-v2/app/.env
```

Después de modificar `.env`, reiniciar:

```bash
sudo systemctl restart edge-core-iptv-v2
```

---

## 21. Flujo recomendado para instalar desde cero

```bash
sudo apt update
sudo apt install -y git curl nano nginx htop

curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

sudo mkdir -p /opt/edge-core-iptv-v2
sudo chown -R $USER:$USER /opt/edge-core-iptv-v2

cd /opt/edge-core-iptv-v2
git clone https://github.com/armandie2013/edge-core-iptv-v2.git app

cd app
npm install
nano .env

npm run build
npm run start
```

Luego configurar Nginx y systemd según las secciones anteriores.

---

## 22. Ejemplo de instalación para Edge Ancasti

Archivo `.env`:

```env
APP_PORT=5010

NODE_NAME=Edge Ancasti V2
NODE_CODE=EDGE-ANCASTI-V2

PUBLIC_BASE_URL=http://10.254.1.15:5001
ORIGIN_BASE_URL=http://10.254.1.11:4001

EDGE_ACCESS_LOG=/var/log/nginx/edge_access.log
EDGE_LOG_MAX_BYTES=2000000

RELAY_RECONNECT_MS=3000
RELAY_IDLE_CLOSE_MS=0
```

URLs finales:

```txt
Health:
http://10.254.1.15:5001/health

Panel:
http://10.254.1.15:5001/panel

Stream:
http://10.254.1.15:5001/proxy/123.ts
```

---

## 23. Ejemplo de instalación para Edge Villa Vil

Archivo `.env`:

```env
APP_PORT=5010

NODE_NAME=Edge Villa Vil 1
NODE_CODE=EDGE-VILLA-VIL-1

PUBLIC_BASE_URL=http://10.254.1.20:5001
ORIGIN_BASE_URL=http://10.254.1.11:4001

EDGE_ACCESS_LOG=/var/log/nginx/edge_access.log
EDGE_LOG_MAX_BYTES=2000000

RELAY_RECONNECT_MS=3000
RELAY_IDLE_CLOSE_MS=0
```

URLs finales:

```txt
Health:
http://10.254.1.20:5001/health

Panel:
http://10.254.1.20:5001/panel

Stream:
http://10.254.1.20:5001/proxy/123.ts
```

---

## 24. Estructura recomendada del proyecto

La estructura general esperada del proyecto es similar a:

```txt
edge-core-iptv-v2/
├── app/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.ts
│   ├── dist/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env
│   └── README.md
├── nginx/
└── logs/
```

La carpeta `dist/` se genera al ejecutar:

```bash
npm run build
```

---

## 25. Dependencias principales del proyecto

Las dependencias se instalan automáticamente con:

```bash
npm install
```

Las más importantes son:

- `express`: servidor HTTP.
- `cors`: configuración de acceso entre servicios.
- `dotenv`: carga de variables de entorno desde `.env`.
- `typescript`: compilación del proyecto.
- `ts-node-dev`: ejecución en desarrollo.
- `@types/*`: tipos necesarios para TypeScript.

---

## 26. Funcionamiento del Relay Manager

El Edge tiene un Relay Manager interno.

Cuando un cliente solicita:

```txt
http://EDGE_IP:5001/proxy/123.ts
```

El Edge busca o crea un relay para el canal `123`.

Luego abre una conexión hacia:

```txt
http://ORIGIN_IP:4001/proxy/123.ts
```

Si otro cliente solicita el mismo canal, el Edge no abre otra conexión nueva al Origin. Ese cliente se suma al relay existente.

Ejemplo:

```txt
Cliente 1 -> Edge -> Canal 123
Cliente 2 -> Edge -> Canal 123
Cliente 3 -> Edge -> Canal 123

Edge -> Origin -> solo 1 conexión para Canal 123
```

---

## 27. Política de cierre de relays

La variable:

```env
RELAY_IDLE_CLOSE_MS=0
```

hace que los relays no se cierren automáticamente cuando quedan sin clientes.

Esto es útil para mejorar la experiencia de zapping o primera carga, porque el canal puede quedar listo para nuevos clientes.

La variable:

```env
RELAY_IDLE_CLOSE_MS=10800000
```

cierra el canal cuando queda sin clientes durante 3 horas.

Otros ejemplos:

```env
RELAY_IDLE_CLOSE_MS=60000
```

Cierra después de 1 minuto sin clientes.

```env
RELAY_IDLE_CLOSE_MS=300000
```

Cierra después de 5 minutos sin clientes.

```env
RELAY_IDLE_CLOSE_MS=1800000
```

Cierra después de 30 minutos sin clientes.

---

## 28. Uso con Origin

El Edge debe tener conectividad hacia el Origin.

Ejemplo:

```env
ORIGIN_BASE_URL=http://10.254.1.11:4001
```

Entonces, cuando un cliente pide:

```txt
http://10.254.1.15:5001/proxy/123.ts
```

El Edge consume:

```txt
http://10.254.1.11:4001/proxy/123.ts
```

---

## 29. Uso con clientes IPTV

Los clientes deben consumir desde el Edge, no directamente desde el Origin.

Ejemplo:

```txt
http://10.254.1.15:5001/proxy/123.ts
```

Para otro Edge:

```txt
http://10.254.1.20:5001/proxy/123.ts
```

Esto permite que cada localidad o ISP tenga su propio Edge.

---

## 30. Consideraciones de producción

Para producción se recomienda:

- Ejecutar la app con `systemd`.
- Usar Nginx como proxy frontal.
- Mantener el Edge cerca de los clientes.
- Mantener conectividad estable entre Edge y Origin.
- Usar IP fija.
- Monitorear `/health`.
- Monitorear `/panel`.
- Revisar logs periódicamente.
- No exponer el Origin directamente a los clientes finales.
- Usar túnel, VPN, EoIP, WireGuard o red privada entre Edge y Origin.
- Configurar `RELAY_IDLE_CLOSE_MS` según la política deseada.
- Mantener actualizado Ubuntu Server.

---

## 31. Troubleshooting

### El servicio no inicia

Ver estado:

```bash
sudo systemctl status edge-core-iptv-v2
```

Ver logs:

```bash
sudo journalctl -u edge-core-iptv-v2 -f
```

Verificar si existe `dist/`:

```bash
ls -la dist
```

Si no existe, compilar:

```bash
npm run build
```

---

### El `.env` no toma los cambios

Confirmar carpeta real del servicio:

```bash
sudo systemctl cat edge-core-iptv-v2
```

Buscar archivos `.env`:

```bash
sudo find /opt/edge-core-iptv-v2 -name ".env" -type f
```

Editar el correcto:

```bash
nano /opt/edge-core-iptv-v2/app/.env
```

Reiniciar:

```bash
sudo systemctl restart edge-core-iptv-v2
```

---

### Nginx no responde

Verificar configuración:

```bash
sudo nginx -t
```

Reiniciar:

```bash
sudo systemctl restart nginx
```

Ver estado:

```bash
sudo systemctl status nginx
```

Ver puertos:

```bash
sudo ss -ltnp
```

---

### El panel no muestra estadísticas

Verificar que exista el log configurado:

```bash
ls -lh /var/log/nginx/edge_access.log
```

Verificar que Nginx esté escribiendo logs:

```bash
tail -f /var/log/nginx/edge_access.log
```

Confirmar variable:

```bash
cat /opt/edge-core-iptv-v2/app/.env
```

Debe existir:

```env
EDGE_ACCESS_LOG=/var/log/nginx/edge_access.log
```

---

### El stream queda cargando

Verificar que el Edge responda:

```bash
curl http://127.0.0.1:5010/health
```

Verificar que Nginx responda:

```bash
curl http://127.0.0.1:5001/health
```

Verificar que el Origin responda desde el Edge:

```bash
curl http://10.254.1.11:4001/health
```

Probar un stream directo contra el Origin desde el Edge:

```bash
curl -I http://10.254.1.11:4001/proxy/123.ts
```

Probar el stream desde el Edge:

```bash
curl -I http://127.0.0.1:5001/proxy/123.ts
```

Ver logs:

```bash
sudo journalctl -u edge-core-iptv-v2 -f
```

---

### El Edge no llega al Origin

Probar ping:

```bash
ping 10.254.1.11
```

Probar puerto del Origin:

```bash
curl http://10.254.1.11:4001/health
```

Ver rutas:

```bash
ip route
```

Ver IP del servidor:

```bash
ip a
```

---

## 32. Seguridad recomendada

Se recomienda:

- Limitar acceso SSH.
- Permitir acceso al Edge solo desde la red de clientes correspondiente.
- Permitir acceso al Origin solo desde Edges autorizados.
- No publicar credenciales en GitHub.
- No subir `.env` al repositorio.
- Usar redes privadas, túneles o VPN para enlazar Edge y Origin.
- Mantener actualizado Ubuntu Server.
- Revisar logs periódicamente.

---

## 33. Archivos que no deberían subirse

No subir al repositorio:

```txt
.env
node_modules/
dist/
logs/
*.log
```

Se recomienda tener un `.gitignore` con:

```gitignore
node_modules/
dist/
.env
logs/
*.log
npm-debug.log*
```

---

## 34. Notas importantes

- No subir el archivo `.env` al repositorio.
- No subir la carpeta `node_modules`.
- No subir la carpeta `dist`, salvo que se decida versionar builds.
- Siempre ejecutar `npm install` después de un `git pull` si cambiaron dependencias.
- Siempre reconstruir con `npm run build` antes de reiniciar producción.
- Usar `systemctl cat` para confirmar el `WorkingDirectory` real del servicio.
- Usar `find` para confirmar qué `.env` está leyendo la app.
- El puerto interno de Node normalmente es `5010`.
- El puerto público de Nginx normalmente es `5001`.
- Los clientes deben consumir desde el Edge.
- El Edge debe consumir desde el Origin.
- Para pruebas usar `/health`, `/panel` y `/proxy/:id.ts`.

---

## 35. Ejemplo de URLs finales

```txt
Health Node:
http://10.254.1.15:5010/health

Panel Node:
http://10.254.1.15:5010/panel

Health vía Nginx:
http://10.254.1.15:5001/health

Panel vía Nginx:
http://10.254.1.15:5001/panel

Stream:
http://10.254.1.15:5001/proxy/123.ts
```

Para Villa Vil:

```txt
Health vía Nginx:
http://10.254.1.20:5001/health

Panel vía Nginx:
http://10.254.1.20:5001/panel

Stream:
http://10.254.1.20:5001/proxy/123.ts
```

---

## 36. Licencia y uso

Este proyecto forma parte de una solución IPTV privada.

El uso, copia, distribución o modificación queda sujeto a la autorización del propietario del repositorio.

---