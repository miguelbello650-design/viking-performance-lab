# Contrato de integracion Strava - MVP

Estado: aprobado para diseno e implementacion del piloto de Miguel Bello.

## Alcance del piloto

- Unico atleta: Miguel Bello.
- Fuente primaria: Strava API v3.
- Autorizacion: OAuth2.
- Alcance solicitado: `activity:read_all`, porque el piloto debe poder consultar actividades privadas y rutas privadas autorizadas por Miguel.
- Escritura en Strava: no permitida.
- Webhooks: fuera de esta primera implementacion; la sincronizacion sera iniciada manualmente desde el panel.
- Historial inicial: ultimos 12 meses. Las actividades posteriores se incorporan mediante sincronizaciones incrementales.

El alcance `activity:read_all` debe solicitarse con explicacion clara y validarse contra los permisos realmente concedidos por Strava. Si Miguel concede un alcance menor, el sistema debe informar la limitacion y no simular que el historial esta completo.

## Rutas del backend

### Consultar estado

`GET /api/integrations/strava/status`

Respuesta minima:

```json
{
  "provider": "strava",
  "athlete": "Miguel Bello",
  "connected": false,
  "granted_scopes": [],
  "last_sync_at": null,
  "sync_status": "not_connected"
}
```

No devuelve access tokens ni refresh tokens.

### Iniciar conexion

`GET /api/integrations/strava/connect`

El backend genera y conserva temporalmente un `state` antifalsificacion y redirige a Strava. El navegador nunca recibe `client_secret`.

### Callback OAuth2

`GET /api/integrations/strava/callback?code=...&scope=...&state=...`

El backend valida `state`, intercambia el codigo en Strava, valida los scopes concedidos, registra a Miguel y conserva los tokens en almacenamiento protegido. El callback no expone tokens en la URL de retorno al frontend.

### Sincronizar

`POST /api/integrations/strava/sync`

```json
{
  "athlete": "Miguel Bello",
  "mode": "initial"
}
```

Valores de `mode`:

- `initial`: ultimos 12 meses.
- `incremental`: actividades nuevas o modificadas desde la ultima sincronizacion exitosa.

Respuesta minima:

```json
{
  "provider": "strava",
  "athlete": "Miguel Bello",
  "mode": "initial",
  "received": 0,
  "created": 0,
  "updated": 0,
  "skipped": 0,
  "warnings": [],
  "synced_at": "2026-01-01T00:00:00.000Z"
}
```

La operacion debe ser idempotente usando `strava_activity_id` como identificador externo unico.

### Desconectar

`DELETE /api/integrations/strava`

Revoca la autorizacion en Strava cuando corresponda, elimina los tokens locales y conserva un registro operativo minimo de la desconexion. La politica de eliminacion de actividades historicas debe ejecutarse segun la decision de privacidad del proyecto.

## Normalizacion

Cada actividad debe conservar:

- `strava_activity_id`;
- atleta vinculado: Miguel Bello;
- `sport_type` y `type` originales de Strava;
- fecha y zona horaria recibidas;
- valores observados disponibles;
- polilinea o ruta recibida, si existe;
- fecha de sincronizacion;
- origen: `strava_api`.

La asignacion a trail running, running de asfalto o ciclismo debe conservar el valor original de Strava y registrar cualquier mapeo aplicado. No se deben inferir metricas ausentes.

## Seguridad minima obligatoria

- `client_secret`, access tokens y refresh tokens solo en backend.
- Cifrado o almacenamiento protegido de refresh tokens antes del despliegue publico.
- `state` obligatorio en OAuth2.
- CORS limitado al frontend autorizado.
- No registrar tokens en logs.
- No enviar el payload completo de Strava al navegador si no es necesario.
- Registrar revocacion, errores de consentimiento y perdida de permisos.

## Fuera de este contrato

- Otros atletas.
- Otros proveedores.
- Escritura en Strava.
- Webhooks.
- Reglas deportivas nuevas.
- Recomendaciones automaticas sin revision del entrenador.
