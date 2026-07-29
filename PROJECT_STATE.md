# Estado del proyecto

El perfil aprendido ahora genera patrones candidatos por disciplina a partir de relaciones observadas entre velocidad, frecuencia cardiaca y desnivel relativo. Cada patron conserva actividades de evidencia, metrica, confianza y estado candidate/confirmed/rejected; el entrenador puede validar o rechazarlo mediante API antes de que oriente recomendaciones.

Los informes generativos por actividad se guardan en SQLite mediante `ai_activity_reports`, asociados a la actividad y a la version del informe. El asistente devuelve el informe cacheado sin consumir OpenAI; la regeneracion queda como accion explicita del entrenador.

La actividad seleccionada puede enriquecerse bajo demanda con el detalle oficial de Strava, esfuerzos, vueltas, mejores esfuerzos, splits, zonas y streams detallados. El enriquecimiento queda cacheado en SQLite y se ejecuta al generar el informe para evitar agotar los limites de lectura durante una sincronizacion masiva.

La sincronizacion Strava ahora solicita streams detallados por actividad cuando no existen registros: tiempo, distancia, altitud, velocidad, frecuencia cardiaca, cadencia y potencia disponibles. Si Strava no entrega un stream, se conserva la actividad resumen y se declara la limitacion.

El backend incorpora un perfil de aprendizaje por atleta, aislado por la entidad `athletes`: guarda líneas base observadas por disciplina, cantidad de evidencias, periodo y estado de suficiencia. La IA recibe el perfil del atleta seleccionado; Miguel Bello es solo el primer registro y no está codificado como límite del modelo. Las actividades de Strava se agrupan como `TrailRun`, `Run`, `Ride` o `Fuerza y/o movilidad` cuando el tipo no corresponde a una disciplina deportiva inicial.

El contexto de comparación del motor de IA ahora se limita a la misma categoría de la actividad seleccionada; las conversaciones sin actividad seleccionada conservan el historial multideporte y lo declaran explícitamente al modelo.

Los patrones aprendidos enviados al modelo siguen el mismo alcance: una actividad seleccionada recibe únicamente patrones de su categoría, mientras que una conversación general puede consultar el perfil multideporte.

El contexto de una actividad incorpora cinco segmentos analíticos ordenados por distancia o, si la distancia no está disponible, por orden de registros. Cada segmento conserva promedios observados y rangos de altitud; no aplica umbrales clínicos ni interpreta por sí mismo.

Se incorpora como direccion aprobada el autoaprendizaje progresivo del atleta: perfil individual basado en patrones repetidos, confianza y validacion del entrenador. No se reentrena OpenAI automaticamente ni se presentan hipotesis como hechos.

El contexto de análisis de actividad ahora incluye señales derivadas verificables: comparación del primer y último 20% de registros, cambios de velocidad, frecuencia cardíaca y cadencia, además de ascenso y descenso calculados desde la altitud observada. La IA debe convertirlas en hallazgos y preguntas útiles para el entrenador, no repetir el tablero.

El informe generativo por actividad ya normaliza las capas devueltas por OpenAI para evitar `[object Object]`; el backend exige cálculos como textos verificables y declara cuando no son calculables. Pendiente publicar este ajuste y repetir una prueba real.

La vista de actividades incorpora ruta GPS y perfil de altitud observados mediante `GET /api/activities/:id/route`, sin mapa externo ni interpretacion automatica del recorrido.
Se corrigio la sincronizacion de la vista de detalle: la ruta ahora se inserta despues de cargar la actividad, evitando que el contenido del detalle la reemplace.
El detalle individual ahora muestra un mapa OpenStreetMap con Leaflet, linea GPS observada y marcadores de inicio y final, sin API Key de Google.
La ruta GPS ahora se colorea por tramos segun la altitud observada, con leyenda del rango minimo y maximo; no representa zonas deportivas ni una interpretacion.
El repositorio GitHub fue publicado sin la base SQLite ni los archivos FIT personales; `.gitignore` excluye bases, archivos de actividad y credenciales para proteger la informacion deportiva y de ubicacion.
Los tramos de altitud del mapa muestran al pasar el cursor la diferencia entre altitud observada inicial y final del segmento.
La vista Actividades permite seleccionar dos actividades y superponer sus rutas GPS observadas en un mapa comparativo.

## Proyecto
Viking Performance Lab

## Fase actual
Fase 2 — Construccion del MVP

## Estado
El front ya incorpora una primera interfaz de copiloto del entrenador conectada al API; actualmente responde comparaciones basadas en evidencia y declara limites cuando no existe una regla analitica aprobada.
El backend local esta operativo con Strava conectado para Miguel Bello y 454 actividades disponibles. El siguiente trabajo es conectar el frontend oficial de Lovable al contrato API mediante `VITE_API_BASE_URL`; la publicacion requiere primero un backend seguro y una URL publica definida.
Lovable ya incorporo el adaptador API, panel de Strava, estados de carga/vacio/error y prioridad de `VITE_API_BASE_URL` sobre el mock. La interfaz publicada aun no puede leer la SQLite local hasta desplegar el backend con una URL publica segura.
Backend publicado en Render y verificado: `GET https://viking-performance-lab.onrender.com/health` responde `{"status":"ok"}`. La instancia publica aun no tiene la conexion Strava local; debe autorizarse nuevamente mediante el callback publico.
La regla comparison-context-v1 agrega una interpretacion contextual limitada y una hipotesis explicita; no genera recomendaciones automaticas.
La regla aerobic-efficiency-v1 queda implementada de forma condicionada: con los archivos actuales declara insuficiencia porque no hay velocidad media observada en ambas actividades.
La Regla 003 de señales de fatiga contextual fue aprobada y se visualizará primero mediante gráficas de evidencia; su interpretación seguirá sujeta a revisión del entrenador.
El asistente conversacional funciona como chat abierto con historial de mensajes; el API prepara el contexto desde SQLite y las reglas no bloquean preguntas.
El prompt assistant-coach-v1 define el rol de analista deportivo experto, la conversación profesional con el entrenador y la separación obligatoria entre evidencia, cálculos, interpretaciones, hipótesis y recomendaciones.
El adaptador OpenAI quedó implementado en el API con OPENAI_API_KEY y OPENAI_MODEL; mientras no exista la clave, opera con fallback local.
La clave fue cargada y la llamada llegó al proveedor, pero la cuenta respondió cuota agotada; el fallback local permanece activo.
El fallback local incorpora consultas descriptivas de actividad más larga para seguir probando el asistente sin cuota generativa.
El Centro de análisis incorpora selección de métrica y drill-down interactivo sobre cada actividad graficada.
El perfil visual permite filtrar las gráficas por disciplina, tipo de elemento y periodo.
El Centro de análisis permite seleccionar hasta cuatro actividades y compararlas visualmente con diferencias calculadas.
La vista Atletas incorpora un perfil evolutivo dinámico con periodo observado, disciplinas registradas y línea temporal seleccionable.
La vista Actividades incorpora inspección individual de datos observados, laps, eventos y registros mediante el API de detalle.
Por decisión del usuario, el proyecto continuará temporalmente en modo gratuito/local; la generación OpenAI queda pausada hasta habilitar cuota API.
Se corrigio un error de sintaxis del front que bloqueaba la navegacion y los botones.
La construccion del MVP esta autorizada. SQLite queda definido como persistencia inicial. El primer vertical tecnico funciona con el patron frontend → API Node.js → SQLite, utilizable en local y preparado para publico con el mismo contrato. Registra cargas reales, conserva archivos originales, valida FIT/FIT.gz automaticamente, extrae mensajes FIT observados y expone detalle y comparacion reproducible de las cuatro actividades de Miguel Bello. Las interpretaciones deportivas aun estan pendientes. La publicacion web persistente aun no esta configurada.

## Aprobado
- Vision multideporte
- Trail running, running de asfalto y ciclismo
- Enfoque orientado primero al entrenador
- MVP desacoplado de TrainingPeaks
- Importacion inicial mediante FIT, GPX, TCX y CSV
- Aceptacion de `.FIT.gz` como variante comprimida de FIT
- Flujo base y requisitos estructurales de importacion
- Reglas de duplicado exacto y posible duplicado
- Plantillas CSV de resumen, series y ruta
- Validaciones obligatorias de archivo, contexto, estructura, consistencia y duplicados
- Paso a normalizacion de archivos aceptados con advertencias
- Arquitectura de nucleo comun mas modulos deportivos
- Acceso de lectura del atleta y alcance operativo del administrador
- Prototipo visual inicial del panel de entrenador
- Direccion de producto centrada en copiloto de entrenamiento para el entrenador
- SQLite como persistencia inicial
- Primer vertical tecnico de importacion y registro de actividades
- Validacion estructural automatica de FIT/FIT.gz al importar
- Extraccion automatica de mensajes FIT y campos observados
- Detalle individual y comparacion reproducible de actividades
- Patron de comunicacion API/SQLite de IPM adoptado como referencia tecnica
- Regla comparison-context-v1 aprobada para el copiloto
- Regla aerobic-efficiency-v1 implementada de forma condicionada
- Regla aerobic-efficiency-v1 aprobada para el copiloto
- Regla 003 de señales de fatiga contextual aprobada
- Asistente conversacional fundamentado sobre historial almacenado
- Adaptador generativo OpenAI detrás del contrato del asistente
- Prompt assistant-coach-v1 aprobado como base de comportamiento del asistente
- Gráficas dinámicas con selección y detalle de actividad
- Filtros dinámicos de periodo, disciplina y tipo
- Comparación visual multi-selección
- Perfil evolutivo dinámico del atleta
- Detalle individual de actividad conectado al API

## Pendiente
- Resolver hallazgos y decisiones de `01_PRODUCTO/REVISION_FASE_1.md`
- Cerrar `01_PRODUCTO/ESPACIO_FUNCIONAL_IMPORTACION.md`
- Priorizar y delimitar el MVP
- Aprobar la adaptacion visual inicial basada en https://vikingsport.pro/
- Convertir la direccion del copiloto en una prioridad verificable del MVP sin ampliar alcance
- Modelo comercial
- Integracion con TrainingPeaks
- Metricas y umbrales definitivos
- Automatizaciones externas

## Nota de la transferencia visual Lovable → local

- Se trasladaron patrones visuales al front local sin sustituir Node, SQLite ni Leaflet: fuente local, jerarquía de copiloto y cadena de lectura en cinco capas.
- Se conservaron fuera del producto los datos demo y las métricas ficticias de Lovable.
- Se adaptó la composición completa del laboratorio: hero del copiloto, contexto de atleta, estados locales, navegación al análisis y disposición paralela de asistente/comparador.

## Nueva división de trabajo aprobada

- Lovable será el constructor del frontend completo.
- El repositorio local mantendrá Node.js, SQLite, importaciones, normalización, análisis, asistente y seguridad.
- El contrato oficial de integración queda en `02_REQUISITOS/CONTRATO_API_FRONTEND.md`.
- Lovable trabajará con mock data compatible; los FIT y la SQLite permanecerán fuera de Lovable.
- Enviada a Lovable la instrucción de reconstruir el frontend oficial con adaptador `VITE_API_BASE_URL`, estados completos y mock data compatible con el contrato. Mensaje: `umsg_01kypzp1j1fndajctcvgc7jb08`.
- Lovable terminó la construcción del frontend oficial. Commit `5b4fe4a8d4e7ed787b897699088c195dc0a9fe66`; creó `src/lib/api/` con cliente, tipos, queries y mock, además de paneles de importación/listado y estados de interfaz.
- Publicación visual disponible en `https://vikingcoach.lovable.app`; contiene datos mock y no tiene conexión con la SQLite local.
- Añadido CORS controlado por `FRONTEND_ORIGINS`; por defecto solo permite los orígenes locales y requiere configurar explícitamente el dominio público antes de conectar Lovable.
- Preparación mínima para despliegue: `HOST`, `VPL_DATA_DIR` y endpoint `GET /health`; la SQLite y los archivos importados pueden vivir en un volumen persistente fuera del repositorio.
- No se publica todavía la base personal: falta definir autenticación antes de conectar una API pública con datos reales.

## Siguiente paso permitido

Cambio de arquitectura solicitado: definir y aprobar el contrato Strava y el alcance de sincronizacion antes de programar; despues adaptar el frontend de Lovable para conexion/sincronizacion en lugar de carga manual. Ver `02_REQUISITOS/INTEGRACION_STRAVA_MVP.md`.
Piloto aprobado: unico atleta Miguel Bello, alcance solicitado `activity:read_all`, historial inicial de 12 meses y sincronizacion incremental manual. Contrato en `02_REQUISITOS/CONTRATO_STRAVA_MVP.md`.
Implementacion inicial del backend Strava completada: OAuth2, estado, callback, tokens cifrados, sincronizacion idempotente, desconexion y rutas desde polyline. El frontend aun no esta conectado.
Primera sincronizacion real completada el 2026-07-29: 450 actividades recibidas y 450 creadas para Miguel Bello, sin advertencias reportadas.
Backend reiniciado y verificado: `/health` responde correctamente, Strava permanece conectado y el listado devuelve 454 actividades totales (450 Strava + 4 archivos historicos). Se optimizo la consulta agregada de mensajes para evitar bloqueos con historiales grandes.
Fase de organizacion visual iniciada y completada en Lovable: la navegacion lateral y movil ahora cambia entre Resumen, Atletas, Actividades, Rutas, Comparaciones y Asistente, reutilizando los datos reales de la API y conservando filtros. Backend, SQLite, contratos y analitica no fueron modificados. Publicacion actualizada en `https://vikingcoach.lovable.app`.
La sincronizacion Strava se corrigio para permitir recuperacion manual de todo el historial (`mode: full`), solapar 24 horas en incrementales y conservar el nombre exacto de Strava en `original_filename`. Pendiente desplegar backend y ejecutar la recuperacion completa.
El commit `4c668d9` fue publicado en GitHub y Render esta operativo. La instancia gratuita perdio la SQLite efimera durante el redeploy, por lo que la conexion Strava publica debe autorizarse nuevamente antes de ejecutar `mode: full`.
La IA generativa queda definida como motor de lectura deportiva por fases. La primera fase sera el informe de una actividad/carrera con evidencia, calculos, interpretaciones, hipotesis, recomendaciones preliminares y limitaciones. Cumplimiento del plan, carga semanal y riesgo de sobreentrenamiento quedan pendientes de una fuente y reglas aprobadas.
