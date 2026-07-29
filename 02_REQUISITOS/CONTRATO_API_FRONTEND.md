# Contrato API ↔ Frontend

Estado: contrato operativo para conectar el frontend oficial de Lovable.

> Cambio de arquitectura: Strava es ahora la fuente primaria de actividades del MVP. La carga manual queda fuera del flujo principal. Las secciones de importacion se conservan como compatibilidad futura hasta que exista un contrato especifico de Strava.

Este documento separa responsabilidades:

- Lovable construye la interfaz, navegación, estados, gráficas y mapas.
- Viking Performance Lab mantiene Node.js, SQLite, importaciones, normalización, análisis, asistente y seguridad.
- El frontend no accede directamente a SQLite ni recibe archivos personales en Lovable.

El frontend debera mostrar conexion, autorizacion y sincronizacion de Strava en lugar de presentar la carga manual como accion principal. No manejara `client_secret`, access tokens ni refresh tokens.

## Convenciones

- Base local actual: `http://localhost:8766`.
- Todas las respuestas son JSON salvo la carga de archivos.
- El frontend debe mostrar estados de carga, vacío y error.
- Los campos `observed` son datos observados.
- Los campos `calculated` son cálculos reproducibles.
- `interpretation`, `hypothesis` y `recommendation` nunca deben presentarse como hechos.
- Toda recomendación debe mostrar: `Sujeta a revisión del entrenador`.
- Los identificadores de actividad son enteros.

## 1. Listar actividades

`GET /api/activities`

Respuesta `200`:

```json
{
  "activities": [
    {
      "id": 4,
      "athlete": "Miguel Bello",
      "sport": "Trail running",
      "kind": "Entrenamiento",
      "original_filename": "actividad.FIT.gz",
      "file_size": 101476,
      "import_status": "accepted",
      "normalization_status": "normalized",
      "created_at": "2026-07-28T01:19:00.000Z",
      "message_count": 1200
    }
  ]
}
```

Estados de `normalization_status`: `pending`, `normalized`, `warning`, `rejected`.

## 2. Detalle de actividad

`GET /api/activities/:id`

Respuesta `200`:

```json
{
  "activity": {},
  "normalization": {
    "file_format": "FIT.gz",
    "validation_status": "normalized",
    "warnings_json": "[]",
    "observed_json": "{}"
  },
  "session": {
    "timestamp": "2026-07-28T01:19:00.000Z",
    "fields": {}
  },
  "laps": [],
  "events": [],
  "record_count": 1200
}
```

`404`: `{ "error": "Actividad no encontrada." }`.

## 3. Comparar actividades

`GET /api/activities/compare?athlete=Miguel%20Bello&limit=4`

Respuesta `200`:

```json
{
  "athlete": "Miguel Bello",
  "activities": [
    {
      "id": 4,
      "filename": "actividad.FIT.gz",
      "athlete": "Miguel Bello",
      "sport": "Trail running",
      "kind": "Entrenamiento",
      "normalization_status": "normalized",
      "observed": {
        "start_time": { "raw": 123, "value": "2026-07-28T01:19:00.000Z" },
        "duration_seconds": { "raw": 3600, "value": 3600 },
        "distance_m": { "raw": 10000, "value": 10000 },
        "average_heart_rate_bpm": { "raw": 150, "value": 150 },
        "ascent_m": { "raw": 500, "value": 500 }
      },
      "calculated": {
        "record_count": 1200,
        "lap_count": 4,
        "delta_from_previous": {}
      }
    }
  ]
}
```

El frontend debe mostrar solo los campos presentes. La ausencia de un campo es `dato no disponible`, no cero.

## 4. Ruta GPS

`GET /api/activities/:id/route`

Respuesta `200`:

```json
{
  "observed_point_count": 4200,
  "points": [
    {
      "timestamp": "2026-07-28T01:19:05.000Z",
      "latitude": 4.1234,
      "longitude": -74.1234,
      "altitude_m": 1800,
      "distance_m": 1250
    }
  ]
}
```

El mapa puede colorear segmentos por altitud observada y debe identificar inicio/final. No debe inventar nombres de terreno, umbrales ni conclusiones.

## 5. Integracion Strava

`GET /api/integrations/strava/status` devuelve el estado de la conexion del piloto. El frontend debe mostrar `connected`, `sync_status`, `granted_scopes` y `last_sync_at`, sin mostrar tokens.

`GET /api/integrations/strava/connect` inicia OAuth2 y redirige a Strava. El frontend solo debe abrir esta ruta.

`POST /api/integrations/strava/sync` acepta `{ "mode": "incremental" }` y devuelve `received`, `created`, `updated`, `warnings` y `synced_at`. El boton debe bloquearse mientras sincroniza y luego refrescar `GET /api/activities`.

`DELETE /api/integrations/strava` desconecta el piloto y revoca el token en backend.

## 6. Importar actividad (compatibilidad futura)

`POST /api/import` con `multipart/form-data`:

- `athlete`: `Miguel Bello`.
- `sport`: `Trail running`, `Running de asfalto` o `Ciclismo`.
- `kind`: `Entrenamiento` o `Carrera`.
- `file`: `.FIT`, `.FIT.gz`, `.GPX`, `.TCX` o `.CSV`.

Respuesta `201`:

```json
{
  "activity_id": 5,
  "filename": "actividad.FIT.gz",
  "status": "accepted",
  "normalization_status": "pending"
}
```

Errores esperados: `400` contexto o archivo inválido, `409` duplicado exacto.

## 7. Asistente del entrenador

`POST /api/coach/query` con JSON:

```json
{
  "query": "Compárame los últimos cuatro fondos largos",
  "history": [
    { "role": "user", "content": "Pregunta anterior" },
    { "role": "assistant", "content": "Respuesta anterior" }
  ]
}
```

Respuesta `200`:

```json
{
  "query": "Compárame los últimos cuatro fondos largos",
  "type": "observed_comparison",
  "answer": "Respuesta fundamentada en el historial local.",
  "evidence": [],
  "calculations": {},
  "interpretation": null,
  "hypothesis": null,
  "recommendation": null,
  "limitation": "Límite de los datos disponibles.",
  "coach_review_required": true
}
```

El frontend debe separar visualmente respuesta, evidencia, cálculo, interpretación, hipótesis, recomendación y límite.

## 8. Requisitos para Lovable

- Construir primero con datos mock que respeten exactamente estas formas.
- No crear Supabase, PostgreSQL ni otra base de datos.
- No incorporar archivos FIT personales ni credenciales.
- Centralizar la URL en una variable de entorno, por ejemplo `VITE_API_BASE_URL`.
- Mantener un adaptador pequeño para cambiar de mock a API real.
- No hardcodear actividades, métricas o nombres de atletas en los componentes finales.
- Preparar estados `loading`, `empty`, `error`, `accepted`, `warning` y `normalized`.

## 9. Antes de conectar el frontend publicado

- Añadir CORS controlado en Node para el dominio del frontend.
- Definir URL pública del backend.
- Mantener la API pública sin exponer SQLite, rutas de archivos ni credenciales.
- Probar la misma interfaz contra `localhost` y contra el backend publicado.
