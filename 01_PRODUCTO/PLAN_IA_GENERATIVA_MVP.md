# Plan de IA generativa — MVP

## Objetivo

Usar la IA generativa como motor de lectura deportiva sobre la información observada de Strava y el historial normalizado de cada atleta. La IA no reemplaza al entrenador, no decide cambios de plan y no presenta hipótesis como hechos.

## Cadena obligatoria de respuesta

Toda salida debe separar:

1. **Datos observados:** valores presentes en la actividad, ruta, laps, registros o historial.
2. **Cálculos:** operaciones reproducibles sobre esos datos.
3. **Interpretación:** lectura deportiva sustentada por los datos disponibles.
4. **Hipótesis:** explicación posible, siempre identificada como no confirmada.
5. **Recomendación:** propuesta preliminar sujeta a revisión del entrenador.
6. **Limitaciones:** datos faltantes, comparabilidad insuficiente o cobertura incompleta.

## Primera fase permitida: informe de una actividad

La primera entrega analizará una actividad o carrera seleccionada y podrá producir, cuando existan los datos necesarios:

- estrategia de salida;
- comportamiento de frecuencia cardíaca al inicio;
- cambio de ritmo por distancia o segmentos;
- rendimiento en ascensos y descensos observados;
- gestión del esfuerzo;
- comportamiento de cadencia;
- puntos o segmentos donde se observa mayor pérdida relativa de ritmo;
- comparación con actividades anteriores comparables;
- recomendaciones preliminares para revisión del entrenador.

La IA solo podrá afirmar frases como “el ritmo cayó un 18 % después del km 14” si el cálculo se puede reconstruir con registros observados de distancia y ritmo/velocidad. Si falta alguno de esos campos, debe declararlo.

## Informe posterior a una carrera

El informe generativo tendrá estas secciones:

- resumen ejecutivo;
- estrategia de salida;
- ascensos;
- descensos;
- gestión del esfuerzo;
- comparación histórica;
- segmentos de mayor diferencia observada;
- hipótesis explicativas;
- propuestas para revisión de la próxima edición;
- evidencia y limitaciones.

## Capacidades futuras del entrenador

El tablero por atleta podrá incorporar:

- cumplimiento del plan;
- carga semanal;
- tendencia;
- evolución;
- alertas;
- recuperación;
- historial;
- riesgo de sobreentrenamiento.

Estas capacidades no se deben mostrar como métricas reales hasta disponer de una fuente aprobada para el plan de entrenamiento, la carga y las reglas de interpretación. Strava por sí sola no constituye el cumplimiento del plan ni autoriza un diagnóstico de sobreentrenamiento.

## Fases posteriores

### Fase 2 — comparación histórica de carreras

Comparar la actividad seleccionada con actividades comparables del mismo atleta, conservando disciplina, tipo de elemento, distancia, desnivel y fecha como contexto.

### Fase 3 — evolución y señales del atleta

Construir tendencias y alertas únicamente a partir de reglas aprobadas, con evidencia visible y sin diagnóstico médico.

### Fase 4 — tablero del entrenador

Agregar cumplimiento del plan, carga semanal y recuperación cuando exista una fuente de planificación y una definición aprobada para cada campo.

## Criterio de seguridad

La IA generativa no debe ocultar datos faltantes, inventar clima, nutrición, sensaciones, zonas, carga, lesiones o causas. Toda recomendación debe indicar: **Sujeta a revisión del entrenador**.

