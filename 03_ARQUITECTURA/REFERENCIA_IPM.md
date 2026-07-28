# Referencia tecnica: comunicacion IPM con SQLite

## Elementos tecnicos observados en IPM

- Frontend en HTML, CSS y JavaScript vanilla.
- Servidor Node.js con API HTTP explicita.
- SQLite en el servidor mediante `better-sqlite3`.
- El frontend se comunica con endpoints `/api/...`; nunca abre la base directamente.
- La misma ruta relativa de API funciona en local y en el despliegue publico.
- La base y los archivos internos permanecen fuera de los recursos publicos.
- El servidor restringe los archivos que puede exponer.
- El estado canonico vive en SQLite; `localStorage` solo puede apoyar preferencias de interfaz.
- Scripts de arranque y tareas operativas quedan separados del frontend.

## Traduccion tecnica a Viking Performance Lab

| Patron IPM | Aplicacion en VPL |
|---|---|
| API REST IPM | API REST VPL para importaciones, actividades, atletas y analisis |
| `better-sqlite3` | Persistencia inicial de VPL en servidor |
| `database.db` | `viking.db`, fuera del frontend y de los archivos publicos |
| `start.ps1` | Arranque operativo del entorno local, sin cambiar el contrato API |
| `/api/data` | Endpoints VPL separados por recurso y responsabilidad |

## Estructura funcional inicial de VPL

1. **Resumen**: preguntas pendientes, hallazgos revisables, atletas activos y ultima actividad.
2. **Atletas**: listado y acceso al historial individual. Miguel Bello sera el primer registro de trabajo.
3. **Importaciones**: archivos recibidos, contexto, estado, advertencias y duplicados.
4. **Actividades**: entrenamientos y carreras aceptados, con acceso al archivo original.
5. **Analisis**: comparaciones y respuestas del copiloto con evidencia trazable.
6. **Rutas y carreras**: recorridos, contexto de competencia y estrategias preliminares.

## Contrato local y publico

```text
Navegador → HTTP /api/import → Servidor Node.js → SQLite + archivos originales
Navegador ← JSON de estado ← Servidor Node.js
```

En local y en produccion deben mantenerse:

- los mismos endpoints;
- las mismas estructuras JSON;
- la misma politica de validacion;
- la misma separacion entre archivos publicos y persistencia;
- la misma regla de que una recomendacion requiere revision del entrenador.

La diferencia entre local y publico debe ser el entorno de ejecucion, no la logica de comunicacion.

## Principios de adaptacion

- Se reutiliza el patron de comunicacion API/SQLite de IPM, no su dominio, datos ni interfaz visual.
- La importacion no debe iniciar analisis automaticamente.
- SQLite guarda el estado operativo; el archivo original permanece conservado.
- Las respuestas del copiloto deben distinguir observaciones, calculos, interpretaciones, hipotesis y recomendaciones.
- La identidad visual de VPL sigue la marca Viking Sport y no la de IPM.
