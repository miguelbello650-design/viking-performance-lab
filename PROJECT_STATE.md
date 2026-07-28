# Estado del proyecto

La vista de actividades incorpora ruta GPS y perfil de altitud observados mediante `GET /api/activities/:id/route`, sin mapa externo ni interpretacion automatica del recorrido.
Se corrigio la sincronizacion de la vista de detalle: la ruta ahora se inserta despues de cargar la actividad, evitando que el contenido del detalle la reemplace.
El detalle individual ahora muestra un mapa OpenStreetMap con Leaflet, linea GPS observada y marcadores de inicio y final, sin API Key de Google.
La ruta GPS ahora se colorea por tramos segun la altitud observada, con leyenda del rango minimo y maximo; no representa zonas deportivas ni una interpretacion.
Los tramos de altitud del mapa muestran al pasar el cursor la diferencia entre altitud observada inicial y final del segmento.
La vista Actividades permite seleccionar dos actividades y superponer sus rutas GPS observadas en un mapa comparativo.

## Proyecto
Viking Performance Lab

## Fase actual
Fase 2 — Construccion del MVP

## Estado
El front ya incorpora una primera interfaz de copiloto del entrenador conectada al API; actualmente responde comparaciones basadas en evidencia y declara limites cuando no existe una regla analitica aprobada.
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

## Siguiente paso permitido
Continuar la iteración del chat, contexto, visualizaciones y respuestas locales; habilitar cuota API solo cuando el usuario lo decida.
