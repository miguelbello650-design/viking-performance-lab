# Integracion Strava para el MVP

## Decision de alcance

La fuente primaria de actividades del MVP sera Strava mediante API. La carga manual de FIT, GPX, TCX y CSV queda fuera del flujo principal y se conserva unicamente como capacidad futura o de contingencia.

El entrenador conectara la cuenta de Strava de cada atleta mediante OAuth2. Viking Performance Lab conservara una copia normalizada de los datos autorizados para analisis historico, comparaciones, rutas y asistente.

## Flujo aprobado para disenar

1. El entrenador inicia "Conectar Strava" para un atleta.
2. El backend inicia OAuth2 con el alcance minimo necesario.
3. Strava devuelve un codigo al callback del backend.
4. El backend intercambia el codigo, conserva los tokens de forma segura y registra la autorizacion.
5. El backend obtiene actividades autorizadas y las normaliza al modelo multideporte.
6. El asistente y las visualizaciones consultan la copia local normalizada, no Strava directamente.
7. Una sincronizacion posterior incorpora actividades nuevas, cambios y revocaciones.

## Datos y capas

- Dato observado: valores recibidos de Strava y su identificador de origen.
- Calculo: conversiones, agregaciones y comparaciones realizadas por Viking Performance Lab.
- Interpretacion: lectura analitica sustentada en datos disponibles.
- Hipotesis: explicacion posible, explicitamente marcada como tal.
- Recomendacion: propuesta sujeta a revision del entrenador.

El modelo debe conservar `strava_activity_id`, fecha de sincronizacion, atleta vinculado y origen de cada dato. El nucleo sigue siendo multideporte; las reglas especificas permanecen separadas para trail running, running de asfalto y ciclismo.

## Limites conocidos

- Strava exige OAuth2 y consentimiento del atleta.
- Los access tokens son temporales; el refresh token debe conservarse y actualizarse cuando Strava entregue uno nuevo.
- La aplicacion debe solicitar solo los alcances necesarios y comprobar cuales fueron concedidos.
- La API tiene limites de frecuencia; la sincronizacion no debe depender de consultas constantes.
- Para recibir cambios de actividades se debe disenar un webhook; no se implementa todavia.
- La aplicacion nueva comienza con capacidad de un atleta hasta que Strava habilite mayor acceso.

## Fuera del MVP de integracion

- TrainingPeaks, Garmin, Coros, Suunto y Polar.
- Escritura o edicion de actividades en Strava.
- Webhooks y sincronizacion automatica continua.
- Multi-entrenador, multi-tenant y autorizacion comercial masiva.
- Importacion manual como flujo visible principal.

## Decisiones aprobadas para el piloto

- Atleta unico: Miguel Bello.
- Alcance solicitado: `activity:read_all`.
- Historial inicial: ultimos 12 meses.
- Sincronizacion incremental manual desde el panel.

El contrato tecnico queda en `02_REQUISITOS/CONTRATO_STRAVA_MVP.md`.

## Decisiones pendientes

- Webhooks para una fase posterior.
- Estrategia de revocacion, eliminacion y retencion de datos.
- Proveedor de despliegue y almacenamiento seguro de tokens.

## Fuente oficial

- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/reference/
- https://developers.strava.com/docs/webhooks/
- https://developers.strava.com/docs/rate-limits/
