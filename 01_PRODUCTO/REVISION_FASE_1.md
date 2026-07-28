# Revision documental de Fase 1

## Estado de la revision

Auditoria documental de la definicion de producto. No constituye aprobacion del alcance ni autoriza el inicio de desarrollo.

## 1. Coherencia general

La documentacion es coherente en estos puntos:

- La vision define una plataforma de inteligencia deportiva, no un sustituto del entrenador ni de TrainingPeaks.
- Las tres disciplinas iniciales son consistentes en vision, propuesta de valor, MVP y modulos deportivos.
- El entrenador aparece como usuario principal y conserva la decision final.
- El MVP parte de archivos FIT, GPX, TCX y CSV, manteniendo la integracion automatica con TrainingPeaks fuera de alcance.
- Se establece un nucleo comun multideporte con reglas especificas separadas por disciplina.
- La separacion entre dato observado, calculo, interpretacion, hipotesis y recomendacion aparece alineada entre producto, requisitos y marco analitico.
- La aprobacion, correccion y trazabilidad por parte del entrenador estan contempladas.

## 2. Contradicciones o tensiones

### 2.1 Propuesta de valor mas amplia que el MVP verificable

La propuesta de valor menciona alertas, analisis longitudinal y consulta en lenguaje natural. El MVP y los requisitos no los definen como capacidades verificables: no existen historias, criterios de aceptacion ni limites claros para esas funciones.

### 2.2 Estrategias especificas frente a datos de entrada insuficientemente definidos

La propuesta promete estrategias especificas para competencias y el MVP incluye estrategia preliminar, pero no se define que informacion de competencia, objetivo, ruta, atleta o plan debe estar disponible ni cual es la salida minima esperada.

### 2.3 Usuario atleta sin limites operativos

El atleta es usuario secundario y existe una historia para consultar, pero no se especifica que resultados puede ver, si puede aportar feedback, ni como se protege la revision interna del entrenador. El rol administrador aparece en producto y modelo conceptual, pero no tiene historia de usuario ni alcance explicito.

### 2.4 Exito del MVP no medible todavia

El criterio de exito depende de que el entrenador confirme ahorro de tiempo, tendencia util o mejora de estrategia, pero no define una linea base, una forma de medirlo ni el contexto del piloto. Esto impide comparar resultados de forma reproducible.

## 3. Vacios

- No hay prioridad ni corte minimo entre las capacidades del MVP; todas aparecen al mismo nivel.
- CSV no tiene contrato de columnas, unidades, zona horaria, identificador de actividad ni politica para datos faltantes.
- No se define el alcance de validacion, normalizacion, segmentacion basica, analisis automatico, comparacion o estrategia preliminar.
- No se define que significa una actividad duplicada ni que accion puede tomar el usuario ante el duplicado.
- No se define el catalogo inicial de metricas comunes ni cuales son solo candidatas. Algunas metricas listadas requieren datos o contexto que no estan garantizados por todos los formatos.
- No se define como se representa la confianza ni que diferencia existe entre confianza del calculo, evidencia disponible y revision del entrenador.
- No se define el conjunto minimo de datos para comparar actividades o rutas de forma valida entre disciplinas.
- No se explicita si la carga de rutas usa los mismos formatos de archivo ni que distingue una ruta de una actividad.
- No se define el alcance de exportar el informe basico, aunque existe un requisito funcional para hacerlo.
- Privacidad, consentimiento y separacion de datos aparecen como principios o requisitos generales, pero no como limites de producto visibles para la aprobacion del MVP.

## 4. Riesgos de producto

- **Alcance excesivo:** intentar resolver ingestion, normalizacion, visualizacion, analitica, comparacion, rutas y estrategia en una primera entrega puede dificultar validar el valor principal.
- **Expectativas infladas:** inteligencia, alertas, lenguaje natural y estrategias pueden interpretarse como automatizacion o certeza si no se muestran explicitamente como apoyo sujeto a revision.
- **Resultados incomparables:** datos faltantes, sensores distintos, formatos heterogeneos y disciplinas diferentes pueden producir comparaciones enganosas.
- **Dependencia de entradas no disponibles:** una estrategia o interpretacion puede quedar sin evidencia suficiente si el archivo carece de potencia, frecuencia cardiaca, altitud, series o contexto de competencia.
- **Ambiguedad de permisos:** la ausencia de limites para entrenador, atleta y administrador puede exponer informacion o revisiones que no corresponden a cada rol.
- **Criterio de exito subjetivo:** sin una medicion minima del ahorro de tiempo o utilidad, el piloto puede concluir sin evidencia comparable.
- **Confusion de posicionamiento:** capa sobre plataformas existentes y MVP por archivos son compatibles, pero debe comunicarse que el MVP no sincroniza ni reemplaza esas plataformas.

## 5. Decisiones que requieren aprobacion

1. ¿El MVP debe incluir todas las capacidades listadas o se aprueba un corte priorizado para la primera validacion con entrenadores?
2. ¿Alertas, analisis longitudinal y consulta en lenguaje natural forman parte del MVP o quedan explicitamente posteriores?
3. ¿El atleta tendra acceso en el MVP? Si lo tiene, ¿que puede consultar, aportar o no ver?
4. ¿El administrador forma parte del alcance de usuario del MVP o se documenta solo como rol operativo interno?
5. ¿Que entradas minimas y campos obligatorios se aceptan por FIT, GPX, TCX y CSV, especialmente para CSV?
6. ¿Que informacion minima se requiere para comparar actividades, analizar rutas y generar una estrategia preliminar?
7. ¿Que metricas se aprobaran para el MVP y cuales permaneceran como candidatas hasta validacion profesional y disponibilidad de datos?
8. ¿Como se medira el criterio de exito del piloto: tiempo de revision, utilidad percibida, decisiones revisadas u otra medida aprobada?
9. ¿La aprobacion del entrenador significa revision de un hallazgo, aprobacion de una estrategia, correccion del contenido o las tres cosas?
10. ¿Se aprueba mantener como regla de producto que toda interpretacion, hipotesis y recomendacion muestre evidencia, datos faltantes y revision del entrenador cuando corresponda?

## 6. Conclusion

La Fase 1 tiene una direccion de producto consistente y una frontera importante bien establecida: primero archivos, nucleo multideporte y entrenador como autoridad final. No esta lista para aprobacion definitiva porque el MVP es demasiado amplio y varias promesas no tienen criterios verificables ni condiciones minimas de entrada.

El siguiente paso debe ser resolver las decisiones anteriores y actualizar la definicion de producto. Hasta entonces no se recomienda avanzar a implementacion ni cerrar requisitos derivados.
