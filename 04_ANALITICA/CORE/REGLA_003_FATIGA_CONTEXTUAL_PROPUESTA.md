# Regla 003 — Señales de fatiga contextual

## Estado

Aprobada para implementación gradual. La regla no diagnostica fatiga ni genera recomendaciones automáticas.

## Objetivo

Identificar si existe evidencia suficiente para que el entrenador revise una posible acumulación de fatiga en un atleta.

La regla no diagnostica fatiga, no sustituye una valoración profesional y no recomienda modificar el plan automáticamente.

## Preguntas que puede apoyar

- ¿Existe una actividad reciente que deba revisarse junto con la carga previa?
- ¿La respuesta observada de la actividad reciente difiere del contexto reciente?
- ¿Hay suficiente historial para formular una hipótesis de fatiga?

## Datos observados requeridos

Como mínimo:

- atleta;
- disciplina;
- tipo de elemento;
- fecha y hora de cada actividad;
- duración o tiempo activo;
- distancia cuando exista;
- frecuencia cardiaca media cuando exista;
- historial suficiente y continuo del atleta.

La regla debe mostrar explícitamente los campos ausentes.

## Cálculos permitidos

- tiempo transcurrido desde las actividades anteriores;
- duración acumulada en periodos definidos;
- número de actividades observadas en esos periodos;
- diferencias entre la actividad reciente y actividades previas comparables.

Los periodos y cualquier umbral deben ser aprobados y versionados antes de activar la regla. Esta propuesta no fija umbrales universales.

## Interpretación permitida

Solo puede indicar:

- evidencia suficiente para revisión;
- evidencia insuficiente;
- posible cambio respecto al contexto observado.

No puede afirmar “el atleta está fatigado”.

## Hipótesis permitida

Cuando exista historial suficiente, puede formularse:

> La actividad reciente podría estar influida por la acumulación de sesiones previas; esta hipótesis requiere revisión del entrenador.

La hipótesis debe incluir la evidencia utilizada y los datos faltantes.

## Recomendación

No genera recomendaciones automáticas. Cualquier ajuste de entrenamiento queda sujeto a decisión del entrenador.

## Fuera de esta regla

- diagnóstico médico;
- estado de recuperación clínico;
- cálculo de TSS, ATL, CTL o métricas equivalentes no observadas;
- umbrales universales de fatiga;
- mover sesiones o modificar planes automáticamente.

## Decisiones que requieren aprobación

1. Periodo de observación inicial.
2. Campos mínimos obligatorios.
3. Actividades consideradas comparables.
4. Umbrales, si fueran necesarios.
5. Texto exacto de la alerta para el entrenador.
6. Si la salida será solo un hallazgo pendiente o también una hipótesis.
