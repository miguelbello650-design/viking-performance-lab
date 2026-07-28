# Espacio funcional de importacion

## Proposito

Definir donde vive una importacion dentro del producto antes de especificar el archivo, sus formatos o su procesamiento.

Este documento describe el contexto funcional. No define almacenamiento, tecnologias ni implementacion.

## Jerarquia funcional

La importacion se ubica dentro de este recorrido:

**Entrenador → Atleta → Disciplina → Actividad o ruta → Archivo importado**

### Entrenador

Es el propietario operativo del espacio de trabajo del MVP. Puede consultar los atletas asociados, iniciar importaciones y revisar sus resultados.

### Atleta

Es la persona a la que pertenece la actividad o ruta. Una importacion no debe quedar sin atleta asignado, salvo que se marque expresamente como pendiente de asignacion y no entre todavia en analisis.

### Disciplina

Cada actividad o ruta debe asociarse a una disciplina inicial: trail running, running de asfalto o ciclismo.

La disciplina determina que reglas podran aplicarse despues. No cambia el nucleo comun de la actividad.

### Actividad o ruta

La actividad representa lo que ocurrio en una sesion deportiva. La ruta representa un recorrido que puede estudiarse o utilizarse como referencia. El producto debe distinguir ambos conceptos antes de procesar el archivo.

### Archivo importado

El archivo original es la fuente observada. Debe conservarse como referencia de la importacion, junto con su origen declarado y el resultado de la validacion.

## Punto de entrada del MVP

La accion **Importar actividad o ruta** estara disponible dentro del espacio de un entrenador, con un atleta seleccionado y una disciplina seleccionada o confirmada a partir del archivo.

El flujo funcional minimo sera:

1. Seleccionar atleta.
2. Seleccionar o confirmar disciplina.
3. Elegir si se importa una actividad o una ruta.
4. Seleccionar el archivo.
5. Revisar el resultado de la validacion.
6. Confirmar la incorporacion al espacio del atleta o corregir la asignacion.

La importacion no debe iniciar analisis ni generar recomendaciones antes de que el archivo haya sido validado y asignado al contexto correcto.

## Visibilidad por rol

### Entrenador

- Ve sus atletas asociados.
- Ve las actividades, rutas, archivos y estados de importacion de esos atletas.
- Inicia importaciones.
- Revisa errores, duplicados, datos faltantes y resultados posteriores.
- Revisa, corrige o aprueba interpretaciones y recomendaciones.

### Atleta

Tiene acceso de lectura limitado a sus propias actividades y rutas aceptadas, y a los resultados que el entrenador haya revisado y marcado como visibles.

No puede importar, cambiar asignaciones, resolver duplicados, ver archivos originales o consultar analisis internos no revisados por defecto.

### Administrador

Es un rol operativo interno para soporte, auditoria y gestion de importaciones. Puede revisar errores, estados y eventos de auditoria dentro del alcance autorizado.

No puede decidir interpretaciones deportivas, aprobar recomendaciones, modificar planes ni ocultar o sobrescribir informacion sin autorizacion y trazabilidad.

## Regla general de acceso

El acceso se limita al espacio de trabajo y a los atletas autorizados. La visibilidad del atleta debe distinguir informacion aceptada y revisada de informacion interna o pendiente.

## Estados funcionales de una importacion

- **Pendiente de revision:** el archivo fue recibido, pero todavia no se confirmo su contexto.
- **Aceptada:** el archivo fue asignado a atleta y disciplina, y supero la validacion minima.
- **Con advertencias:** puede conservarse, pero presenta datos faltantes o condiciones que deben quedar visibles.
- **Duplicada:** coincide con una actividad o ruta ya registrada y requiere decision del usuario.
- **Rechazada:** no puede incorporarse por un error de formato, integridad o contexto.

Estos estados describen el estado del archivo y la importacion. No equivalen a una interpretacion deportiva ni a una recomendacion.

## Trazabilidad minima

Para cada importacion, el producto debe poder mostrar:

- entrenador que la inicio;
- atleta asignado;
- disciplina asignada;
- tipo: actividad o ruta;
- archivo original y formato declarado;
- fecha de importacion;
- estado de la importacion;
- advertencias y datos faltantes;
- relacion con la actividad o ruta resultante, si fue aceptada;
- decisiones operativas tomadas por administrador, si existieran.

## Limites de esta definicion

- No define base de datos, almacenamiento de archivos, colas ni tecnologias.
- No define metricas deportivas ni umbrales.
- No autoriza analisis automatico, comparacion o estrategia antes de aprobar sus requisitos.
- No permite que el producto modifique automaticamente un plan.

## Decisiones pendientes

1. Aprobar la jerarquia entrenador–atleta–disciplina–actividad/ruta–archivo.
2. Confirmar si una importacion puede quedar temporalmente sin atleta o disciplina.
3. Confirmar si actividad y ruta comparten el mismo punto de entrada.
4. Aprobar los estados funcionales de la importacion.
5. Aprobar el acceso de lectura del atleta y el alcance operativo del administrador.
