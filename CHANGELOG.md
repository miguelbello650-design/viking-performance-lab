# Changelog

## 2026-07-29
- Implementados patrones aprendidos multiatleta por disciplina, con evidencia, confianza y estados candidato/confirmado/rechazado. Añadidos endpoints para consultar patrones y registrar la validación del entrenador; el asistente recibe estos patrones como contexto personal.

## 2026-07-29
- Añadida persistencia de informes IA por actividad en SQLite. El informe se reutiliza en consultas posteriores y se expone mediante `GET /api/activities/:id/report`, reduciendo consumo de OpenAI.

## 2026-07-29
- Ampliado el enriquecimiento de actividades Strava bajo demanda: detalle completo, esfuerzos, vueltas, mejores esfuerzos, splits, zonas y streams adicionales. Los resultados quedan cacheados en SQLite y se entregan al contexto de la IA.

## 2026-07-29
- Corregida la sincronizacion detallada de Strava: se solicitan y persisten streams de tiempo, distancia, altitud, velocidad, FC, cadencia y potencia cuando estan disponibles. Las actividades sin streams conservan su resumen y generan una advertencia trazable.

## 2026-07-29
- Creado el perfil de aprendizaje multiatleta en SQLite, con líneas base por disciplina, evidencia, periodo, estado de suficiencia y endpoint `GET /api/athletes/:name/profile`. El asistente incorpora el perfil del atleta seleccionado en su contexto.

## 2026-07-29
- Definido el autoaprendizaje progresivo del atleta: acumulacion de patrones trazables, confianza y validacion del entrenador, sin reentrenamiento automatico del modelo ni diagnosticos.

## 2026-07-29
- Ampliado el contexto analítico del informe IA con cambios entre el primer y último 20% de registros, velocidad, FC, cadencia y ascenso/descenso derivados de datos observados. Ajustado el prompt para priorizar hallazgos accionables y trazables, no una repetición de métricas.

## 2026-07-29
- Corregida la salida del informe generativo: interpretación, hipótesis y recomendación se normalizan a texto legible; `calculations` se entrega como arreglo de textos y se preservan las limitaciones cuando no hay datos suficientes.

## 2026-07-29
- Organizada la navegacion del frontend oficial en Lovable: las seis secciones laterales ahora tienen vistas funcionales, estados de carga/vacio/error y foco accesible; se conservaron API real, filtros y datos sincronizados. Publicacion actualizada en `https://vikingcoach.lovable.app`.
- Ajustada la sincronizacion Strava: nuevo modo manual `full` para recuperar todo el historial, solapamiento de 24 horas en incrementales y conservacion del nombre exacto de la actividad de Strava. Frontend pendiente de publicar junto con el backend.
- Verificado el redeploy en Render: la instancia gratuita no conserva SQLite entre despliegues y la conexion Strava publica quedo desconectada; se requiere una nueva autorizacion antes de sincronizar el historial completo.
- Definido `01_PRODUCTO/PLAN_IA_GENERATIVA_MVP.md`: la primera fase sera un informe generativo por actividad/carrera; el tablero de cumplimiento, carga y riesgo queda condicionado a contar con fuentes y reglas aprobadas.
- Cambio de arquitectura del MVP: Strava pasa a ser la fuente primaria via API/OAuth2; la carga FIT/GPX/TCX/CSV queda fuera del flujo principal. Se documento en `02_REQUISITOS/INTEGRACION_STRAVA_MVP.md`.
- Cerrado el contrato Strava del piloto: Miguel Bello como unico atleta, `activity:read_all`, historial inicial de 12 meses y sincronizacion incremental manual.
- Implementado el primer vertical backend Strava: OAuth2, tokens cifrados, sincronizacion idempotente por `strava_activity_id`, persistencia de rutas y desconexion segura. Falta conectar el frontend.
- Completada la primera sincronizacion real de Strava: 450 actividades de Miguel Bello creadas en SQLite, sin advertencias.
- Optimizado el listado de actividades con indices y agregaciones; backend reiniciado y verificado con 454 actividades totales.
- Transferidos al front local patrones visuales de Lovable: badge de SQLite local, jerarquía de copiloto y cadena Observado → Cálculo → Interpretación → Hipótesis → Recomendación. El resumen usa el conteo real del API local; no se trasladaron datos demo ni métricas ficticias.
- Adaptada la composición completa del laboratorio al front local: hero del copiloto, indicadores dinámicos de actividades/disciplinas, navegación hacia Análisis y disposición paralela de asistente y comparador.
- Creado `02_REQUISITOS/CONTRATO_API_FRONTEND.md` para separar el frontend construido en Lovable del backend Node/SQLite del producto.
- Enviada a Lovable la especificación para reconstruir el frontend oficial con mock adapter y conexión futura al contrato API.
- Lovable terminó la primera construcción del frontend oficial: adaptador API configurable, mock determinista, estados de carga/vacío/error, importación visual, listado de actividades, comparador, mapa, gráficas y asistente. Publicación visual: `https://vikingcoach.lovable.app`.
- Preparado CORS controlado en Node mediante `FRONTEND_ORIGINS`; no se habilita `*` ni se publica la SQLite.
- Actualizado el contrato frontend con las rutas Strava operativas, el flujo OAuth2/sincronizacion y la configuracion pendiente de `VITE_API_BASE_URL` para Lovable.
- Lovable implemento el adaptador API real, panel de sincronizacion Strava y refresco de actividades, comparaciones, rutas y asistente; mantiene mock solo cuando `VITE_API_BASE_URL` no esta configurada.
- Corregido el bind de red para Render: cuando existe `PORT`, el backend usa `0.0.0.0`; en local conserva `127.0.0.1`.
- Backend publicado en Render con commit `1ede1e3`; `/health` responde correctamente. Pendiente autorizar Strava en el entorno publico y configurar Lovable con `VITE_API_BASE_URL`.

## 2026-07-28
- Publicado el repositorio en GitHub sin SQLite ni archivos FIT personales; reforzado `.gitignore` para excluir datos deportivos, GPS y credenciales.
- Agregada superposicion dinamica de dos rutas GPS observadas con colores diferenciados.
- Agregados tooltips interactivos por segmento con altitud GPS observada inicial y final.
- Agregada colorizacion dinamica de la ruta por altitud GPS observada y leyenda del rango de elevacion.
- Integrado mapa gratuito OpenStreetMap + Leaflet en el detalle individual, usando las coordenadas GPS almacenadas en SQLite.
- Corregida la sincronizacion del detalle individual que impedia mostrar la ruta GPS aunque el endpoint respondiera correctamente.
- Agregada visualizacion dinamica de ruta GPS y perfil de altitud observados en el detalle de actividad.
- Agregado endpoint `GET /api/activities/:id/route`, reutilizando mensajes FIT persistidos.
- Corregido el mapeo de campos FIT del mensaje `record` para conservar coordenadas en nuevas importaciones.

## 2026-07-27
- Agregado detalle individual de actividad con datos observados, laps, eventos y registros.
- Agregado perfil evolutivo dinámico del atleta con línea temporal seleccionable.
- Agregada comparación visual multi-selección de hasta cuatro actividades con diferencias calculadas.
- Agregados filtros dinámicos de periodo, disciplina y tipo al Centro de análisis.
- Agregado drill-down interactivo en gráficas: selección de actividad para inspeccionar evidencia contextual.
- Decidido trabajar temporalmente con cuenta gratuita y mantener el asistente en modo local hasta habilitar cuota API.
- Creado e integrado el prompt assistant-coach-v1 para el analista deportivo que conversa con el entrenador.
- Cambiado el asistente a chat abierto: envía pregunta e historial al modelo junto con el contexto de SQLite; las reglas ya no bloquean preguntas.
- Agregada respuesta local para consultar la actividad más larga cuando el proveedor generativo no está disponible.
- Verificada la conexión al proveedor: la cuenta responde cuota agotada; se mantiene fallback local para no bloquear el uso del tablero.
- Agregado adaptador OpenAI Responses API con contexto de actividades desde SQLite, modelo configurable y fallback local sin clave.
- Definido el asistente conversacional fundamentado sobre el historial SQLite, con separación explícita del futuro modelo generativo.
- Aprobada la Regla 003 de señales de fatiga contextual.
- Definida la prioridad de gráficas dinámicas para facilitar la revisión del entrenador.
- Definida la propuesta de Regla 003 para señales de fatiga contextual, sin activarla ni fijar umbrales.
- Aprobada por el usuario la regla aerobic-efficiency-v1.
- Implementada la regla aerobic-efficiency-v1, condicionada a velocidad media y frecuencia cardiaca observadas.
- La regla declara insuficiencia con los archivos actuales cuando falta velocidad media; no inventa una conclusion.
- Aprobada por el usuario la regla comparison-context-v1.
- Activada la regla comparison-context-v1 para comparar contexto entre las dos actividades mas recientes.
- La respuesta del copiloto ahora separa calculos, interpretacion limitada e hipotesis, sin recomendar acciones automaticamente.
- Agregado primer copiloto del entrenador en el front y endpoint POST /api/coach/query.
- El copiloto responde comparaciones observadas y declara limites; no genera interpretaciones ni recomendaciones sin reglas aprobadas.
- Corregido error de sintaxis en el render de comparacion que impedia registrar los eventos de los botones del front.
- Agregados `GET /api/activities/:id` y `GET /api/activities/compare` para detalle y comparación reproducible.
- La comparación ordena las actividades por timestamp FIT observado y calcula diferencias consecutivas sin generar interpretaciones.
- Añadida vista inicial de comparación en el dashboard para Miguel Bello.
- Implementado extractor FIT basado en definiciones de mensajes y campos del protocolo FIT.
- Persistidos en SQLite mensajes `record`, `lap`, `session`, `event`, `activity`, `file_id` y `device_info`, con valores raw y representaciones normalizadas trazables.
- Los cuatro archivos de Miguel Bello fueron reprocesados automaticamente; quedaron registrados miles de mensajes observados por actividad.
- Agregada validacion estructural automatica al importar FIT/FIT.gz: descompresion gzip, firma `.FIT`, encabezado, tamaño del payload y consistencia del archivo.
- Los cuatro archivos de Miguel Bello fueron reprocesados automaticamente y quedaron en estado `validated`, sin advertencias estructurales.
- Persistidos en SQLite el formato, tamaños observados, estado de validacion, advertencias y metadatos estructurales.
- Migrado el backend provisional a Node.js + API HTTP + better-sqlite3, siguiendo la arquitectura de comunicación del IPM.
- Conservado el contrato `GET /api/activities` y `POST /api/import` para que el frontend no dependa de si corre en local o público.
- Verificado el flujo completo con carga multipart sintética, persistencia SQLite, respuesta JSON y retiro del registro de prueba.
- Revisada la referencia IPM y documentado el patron tecnico que se reutilizara en VPL: frontend → API Node.js → SQLite, con el mismo contrato en local y publico.
- Se aclaro que IPM no es referencia visual; la logica deportiva, datos, interfaz y marca de VPL permanecen independientes.
- Iniciada la Fase 2 de construccion del MVP con SQLite autorizado.
- Creado `07_BACKEND/server.py`: servidor local, esquema SQLite, carga multipart, hash SHA-256, deteccion de duplicado exacto y conservacion del archivo original.
- Conectado el modal visual al endpoint real de importacion; el registro queda aceptado con normalizacion pendiente.
- Verificada la persistencia con una carga sintetica y retirado el registro de prueba para no contaminar la base.
- Corregida la respuesta visible del modal de importacion: ahora muestra el archivo seleccionado, exige un archivo antes de continuar y confirma cuando queda listo para revision.
- Modal de importacion actualizado con el atleta Miguel Bello y los tipos de elemento Entrenamiento y Carrera.
- Registrada la direccion de producto del copiloto de entrenamiento: el valor esta en responder preguntas sobre historial y contexto, no en volver a mostrar datos de plataformas existentes.
- Registrada la hipotesis de un modelo individual del atleta ("gemelo digital"), fuera de las promesas comprometidas del MVP.
- Primer prototipo visual del panel de entrenador creado en `08_FRONTEND/index.html`.
- Direccion visual inicial adaptada a la referencia de Viking Sport: naranja, charcoal, alto rendimiento y lenguaje de ciencia aplicada al terreno. No se copiaron activos externos.
- Se acepto como marco funcional inicial el acceso de lectura del atleta y el alcance operativo del administrador.
- Acceso de lectura del atleta y alcance operativo del administrador confirmados como marco funcional inicial.
- Aprobadas las reglas de duplicados, las tres plantillas CSV y las validaciones obligatorias.
- Aprobado el paso a normalizacion de archivos aceptados con advertencias, manteniendo visibles advertencias y datos faltantes.
- Reglas consolidadas de duplicados, plantillas CSV y validaciones obligatorias documentadas.
- Se definieron tres plantillas CSV: resumen, series y ruta.
- Se separaron duplicado exacto y posible duplicado, ambos sin sobrescritura automatica.
- Se definieron validaciones por niveles: archivo, contexto, estructura, consistencia y duplicados.
- Aprobados el flujo base y los requisitos estructurales de importacion.
- Aprobada la aceptacion de `.FIT.gz` como variante comprimida de FIT.
- Se incorporo la observacion de tres muestras `.FIT.gz` al requisito de importacion.
- Se documento que `.FIT.gz` es un envoltorio comprimido de FIT y que la validacion debe inspeccionar el contenido interno.
- Flujo base y requisitos estructurales de importacion documentados en `02_REQUISITOS/FLUJO_Y_REQUISITOS_IMPORTACION.md`.
- Se definieron condiciones comunes para FIT, GPX, TCX y CSV sin seleccionar tecnologia ni metricas deportivas.
- Espacio funcional de importacion documentado en `01_PRODUCTO/ESPACIO_FUNCIONAL_IMPORTACION.md`.
- Se definio la jerarquia funcional entrenador–atleta–disciplina–actividad/ruta–archivo y estados iniciales de importacion.
- Auditoria documental de Fase 1 creada en `01_PRODUCTO/REVISION_FASE_1.md`.
- Estado actualizado: Fase 1 en revision documental, pendiente de aprobacion.
- Estructura inicial creada.
- Vision ampliada a deportes de resistencia.
- Modulos iniciales: trail running, running de asfalto y ciclismo.
- Arquitectura conceptual: nucleo comun mas modulos deportivos.
- El MVP no dependera de TrainingPeaks.
- Preparado el backend para despliegue mediante `HOST`, `VPL_DATA_DIR` y `GET /health`, sin incluir datos personales.
- Ajustada la agrupación de actividades de Strava: `TrailRun`, `Run`, `Ride` y `Fuerza y/o movilidad` para tipos no reconocidos; las actividades históricas se remapean al iniciar el backend.
