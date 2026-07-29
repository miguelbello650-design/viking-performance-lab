# Backend

Reservado. No crear código hasta aprobar requisitos, contratos, arquitectura y stack.
## Primer vertical funcional

`server.js` levanta un servidor Node.js con SQLite para registrar importaciones reales. Sirve la interfaz y expone:

- `GET /api/activities`
- `GET /api/activities/:id`
- `POST /api/activities/:id/enrich`
- `GET /api/activities/:id/report`
- `GET /api/athletes/:name/profile`
- `GET /api/athletes/:name/patterns`
- `PATCH /api/athlete-learning-patterns/:id`
- `GET /api/activities/compare?athlete=Miguel%20Bello&limit=4`
- `POST /api/coach/query`
- `POST /api/import`
- `GET /api/integrations/strava/status`
- `GET /api/integrations/strava/connect`
- `GET /api/integrations/strava/callback`
- `POST /api/integrations/strava/sync`
- `DELETE /api/integrations/strava`

Ejecutar desde la raiz del proyecto:

```powershell
node 07_BACKEND/server.js
```


Abrir `http://127.0.0.1:8766`.

El archivo original se conserva en `09_DATOS_PRUEBA/importados/`.

## Integracion Strava

El piloto usa OAuth2 para conectar unicamente a Miguel Bello. Configura en `.env` las variables de `.env.example`, incluyendo `STRAVA_TOKEN_KEY` con un secreto largo y aleatorio. Los tokens se cifran antes de guardarse en SQLite.

Configura en Strava el callback exactamente como `STRAVA_REDIRECT_URI`. La primera sincronizacion usa los ultimos 12 meses; las siguientes son incrementales y se ejecutan desde el panel.

FIT/FIT.gz se descomprime y extrae automaticamente en mensajes observados. El copiloto inicial responde inventario, comparacion contextual y comprobacion condicionada de eficiencia aerobica. Las reglas separan datos observados, calculos, interpretacion e hipotesis; no generan recomendaciones automaticas.

## Asistente generativo

El endpoint POST /api/coach/query usa SQLite como contexto y puede conectar OpenAI mediante OPENAI_API_KEY. Si la clave no existe, mantiene el fallback local fundamentado. Copia .env.example a .env, configura la clave en el entorno y reinicia el servidor. La clave nunca se guarda en el repositorio ni se envia al navegador.
