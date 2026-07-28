# Asistente conversacional de entrenamiento

## Objetivo

Permitir que el entrenador pregunte en lenguaje natural sobre los entrenamientos y carreras almacenados de un atleta.

## Principio

El asistente debe consultar primero el historial interno y construir sus respuestas con evidencia trazable. No debe responder como si conociera datos que no están almacenados.

El chat es abierto: no depende de una lista cerrada de intenciones ni exige que exista una regla aprobada para responder. Las reglas analíticas controlan cálculos e interpretaciones específicas; no bloquean la conversación.

## Respuesta obligatoria

Cada respuesta debe separar:

1. respuesta breve;
2. actividades utilizadas;
3. datos observados;
4. cálculos realizados;
5. interpretación, si existe una regla aprobada;
6. hipótesis, si está sustentada;
7. datos faltantes y límites;
8. recomendación, únicamente como propuesta sujeta al entrenador.

## Alcance inicial

- comparar actividades;
- consultar actividades disponibles;
- revisar evidencia para eficiencia aeróbica;
- mostrar contexto temporal de duración;
- declarar insuficiencia de datos.

## Fuera de alcance inicial

- diagnóstico médico;
- decisiones automáticas sobre el plan;
- predicciones sin historial y validación;
- respuestas basadas en datos externos no importados;
- presentar una hipótesis como hecho.

## Evolución

La interfaz conversacional, el historial de mensajes y la capa de evidencia se implementan con un modelo generativo detrás del mismo contrato. El modelo no consulta SQLite directamente: el API prepara el contexto y conserva la trazabilidad.
