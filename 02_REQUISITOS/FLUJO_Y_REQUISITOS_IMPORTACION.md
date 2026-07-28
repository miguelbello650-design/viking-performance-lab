# Flujo y requisitos minimos de importacion

## Alcance

Este documento define el flujo funcional, las reglas de duplicados, las plantillas CSV y las validaciones estructurales minimas para recibir actividades o rutas mediante FIT, GPX, TCX y CSV.

No define tecnologias, almacenamiento, metricas deportivas, umbrales ni reglas de analisis.

## Precondiciones

Antes de seleccionar un archivo, el entrenador debe tener:

- acceso al espacio de trabajo del entrenador;
- capacidad para seleccionar o confirmar un atleta;
- capacidad para seleccionar o confirmar una disciplina;
- capacidad para elegir el tipo de elemento: actividad o ruta;
- permiso para operar sobre ese espacio de trabajo.

## Flujo detallado

1. El entrenador entra al espacio del atleta.
2. Selecciona **Importar actividad o ruta**.
3. Selecciona o confirma la disciplina.
4. Indica si el archivo representa una actividad o una ruta.
5. Selecciona un archivo FIT, FIT.gz, GPX, TCX o CSV.
6. El producto identifica el formato declarado y comprueba que el contenido sea compatible.
7. El producto realiza una validacion estructural y muestra errores, advertencias, datos faltantes y un resumen de lo identificado.
8. El producto comprueba si existe una actividad o ruta duplicada o posiblemente duplicada.
9. El entrenador confirma, corrige la asignacion, resuelve el duplicado o cancela.
10. El archivo queda con un estado visible y relacionado con el atleta, la disciplina y el tipo elegido.

La validacion no debe convertir datos faltantes en valores inventados. La importacion tampoco debe iniciar analisis, comparacion, estrategia ni modificacion de planes automaticamente.

## Requisitos estructurales comunes

Un archivo solo puede pasar a revision de contexto si:

- no esta vacio;
- puede leerse sin corrupcion;
- su extension y contenido no se contradicen;
- representa una unica actividad o ruta, o declara de forma inequivoca como se separan varias;
- contiene informacion suficiente para identificar el elemento declarado;
- permite conservar el archivo original y sus advertencias;
- no requiere datos deportivos opcionales para ser recibido.

La recepcion no implica que todos los analisis posteriores sean posibles.

## Requisitos por formato

### FIT

- Debe ser legible como archivo FIT.
- Debe contener un registro identificable de actividad o un registro compatible con una ruta, segun el tipo seleccionado.
- Si contiene varias sesiones o elementos, deben poder distinguirse sin ambiguedad o el archivo queda en revision.

### FIT comprimido

Las muestras entregadas para el proyecto tienen extension `.FIT.gz`. La inspeccion confirma que el envoltorio es gzip y que su contenido interno tiene firma FIT valida.

El flujo debe:

- detectar que el archivo esta comprimido;
- validar el contenido FIT interno antes de aceptar la importacion;
- conservar el archivo original como fuente observada;
- mostrar que la entrada fue comprimida, sin tratar `.FIT.gz` como un formato deportivo distinto;
- no confiar en el nombre del archivo para identificar actividad, disciplina o atleta.

El tamaño del archivo no puede utilizarse como criterio de identidad, duplicado o completitud deportiva.

### GPX

- Debe ser legible como documento GPX.
- Para una actividad o ruta debe contener una geometria o secuencia de puntos reconocible.
- Si incluye varios tracks, routes o segmentos, debe poder determinarse cual corresponde al elemento seleccionado.

### TCX

- Debe ser legible como documento TCX.
- Debe contener una actividad o un recorrido identificable, segun el tipo seleccionado.
- Si contiene varias actividades, deben poder distinguirse sin ambiguedad o el archivo queda en revision.

### CSV

- Debe incluir encabezados.
- Debe tener al menos un registro.
- Debe declarar o permitir confirmar separador, codificacion y formato decimal cuando aplique.
- Cada columna usada debe tener un significado y una unidad cuando corresponda.
- Debe existir una asignacion clara entre las columnas y los campos que el producto reconoce.
- Si contiene varias actividades o rutas, debe incluir una forma inequivoca de separarlas.
- Un CSV sin asignacion de columnas no pasa a aceptacion.

## Plantillas CSV del MVP

El MVP admite tres formas funcionales de CSV. No se imponen nombres universales de columnas; cada archivo debe declarar un mapeo visible y trazable.

### CSV de resumen

Una fila representa una actividad o ruta.

Requiere:

- una fila identificable por elemento;
- fecha u hora de referencia, o un identificador inequívoco de la actividad/ruta;
- al menos un campo observado de la actividad o ruta que este incluido en el mapeo;
- unidades declaradas para los campos numericos.

Si hay varias filas, debe existir un identificador por elemento o una regla inequivoca de separacion.

### CSV de series

Una fila representa una observacion de una actividad.

Requiere:

- timestamp o indice de orden;
- al menos un campo observado de la serie incluido en el mapeo;
- identificador de actividad si el archivo contiene varias actividades;
- unidades declaradas para los campos numericos.

El orden de las filas debe conservarse o el archivo debe declarar el campo que lo determina.

### CSV de ruta

Una fila representa un punto de una ruta.

Requiere:

- latitud;
- longitud;
- orden del punto o timestamp;
- identificador de ruta si el archivo contiene varias rutas;
- unidades y sistema de coordenadas declarados.

Una ruta sin una secuencia de puntos valida queda rechazada o pendiente de revision, no se convierte en una geometria inventada.

## Reglas de duplicados

### Duplicado exacto

Se considera duplicado exacto cuando el contenido original del archivo coincide con un archivo ya registrado dentro del mismo espacio de trabajo.

Resultado obligatorio:

- no se crea una segunda actividad o ruta automaticamente;
- se muestra la referencia del registro existente;
- el entrenador puede cancelar, conservar una referencia adicional o revisar el registro existente;
- nunca se sobrescribe ni se elimina el registro existente automaticamente.

### Posible duplicado

Se considera posible duplicado cuando coinciden de forma relevante el atleta, la disciplina, el tipo y la identidad temporal o espacial de la actividad/ruta, aunque el archivo original sea distinto.

Resultado obligatorio:

- se muestra como advertencia y no como certeza;
- el entrenador puede aceptar como nuevo, relacionar con el existente o cancelar;
- no se aplican umbrales deportivos universales para decidirlo;
- el nombre y el tamaño del archivo no son evidencia suficiente por si solos.

### Resolucion

La decision del entrenador debe quedar trazable junto con el archivo y el registro relacionado. Resolver un duplicado no modifica automaticamente ningun plan ni ningun analisis previo.

## Validaciones obligatorias

### Nivel 1: archivo

- archivo no vacio;
- lectura sin corrupcion;
- extension y contenido compatibles;
- descompresion valida cuando sea `.FIT.gz`;
- formato identificable.

### Nivel 2: contexto

- entrenador con permiso;
- atleta seleccionado o asignacion pendiente visible;
- disciplina seleccionada o confirmacion pendiente visible;
- tipo actividad/ruta seleccionado o confirmacion pendiente visible.

### Nivel 3: estructura

- actividad o ruta identificable;
- una sola entidad o separacion inequivoca de varias;
- campos requeridos por el formato y la plantilla;
- contenido original conservable y trazable.

### Nivel 4: consistencia minima

- valores que deben ser fechas, horas, coordenadas, indices o numeros pueden interpretarse sin ambiguedad;
- los puntos de una ruta forman una secuencia identificable;
- las filas de una serie tienen orden temporal o declaracion de orden;
- no se aceptan columnas CSV usadas sin mapeo o unidad cuando la unidad sea necesaria.

### Nivel 5: duplicados

- comprobacion de duplicado exacto;
- advertencia de posible duplicado cuando exista evidencia suficiente;
- decision explicita del entrenador antes de crear un nuevo registro en caso de conflicto.

## Diferencia entre recepcion y analisis

- **Dato observado:** archivo original, campos presentes, puntos, timestamps y valores recibidos.
- **Calculo:** conversiones o normalizaciones reproducibles que se documenten después de aceptar el archivo.
- **Interpretacion:** lectura deportiva posterior, fuera del alcance de esta validacion.
- **Hipotesis:** explicacion posible posterior, nunca resultado de la recepcion.
- **Recomendacion:** propuesta posterior sujeta a revision del entrenador.

La ausencia de frecuencia cardiaca, potencia, cadencia, altitud, ritmo, velocidad, percepcion de esfuerzo u otros campos deportivos se muestra como dato faltante. No se completa ni se infiere automaticamente.

## Resultados posibles

- **Pendiente de revision:** falta confirmar contexto o resolver una advertencia.
- **Aceptada:** supera las validaciones obligatorias y queda asignada.
- **Con advertencias:** puede conservarse, pero presenta datos faltantes o condiciones visibles.
- **Duplicada:** coincide con un registro existente y requiere decision.
- **Rechazada:** no supera una validacion obligatoria.

## Paso a normalizacion en esta fase

En esta fase, una actividad o ruta con advertencias puede pasar a normalizacion si supera todas las validaciones obligatorias.

Condiciones:

- las advertencias permanecen visibles y trazables;
- los datos faltantes no se completan automaticamente;
- el archivo original se conserva como fuente observada;
- una importacion pendiente de contexto, un duplicado sin resolver o un archivo rechazado no pasa a normalizacion;
- la normalizacion no equivale a analisis, interpretacion, hipotesis ni recomendacion.

## Criterios de aceptacion funcional

- El entrenador conoce atleta, disciplina y tipo antes de confirmar.
- El producto identifica el formato y reporta incompatibilidades.
- El producto muestra errores, advertencias y datos faltantes antes de aceptar.
- El entrenador puede cancelar o corregir el contexto.
- Un duplicado exacto no crea un segundo registro automaticamente.
- Un posible duplicado requiere una decision explicita.
- Un CSV requiere plantilla y mapeo trazable.
- Una actividad o ruta no se acepta si carece de la estructura minima de su tipo.
- El archivo original queda trazable junto con estado, contexto y decisiones.
- La recepcion de un archivo no se presenta como analisis ni recomendacion.

## Decisiones pendientes de aprobacion

1. Confirmar el acceso del atleta y el alcance del administrador en el espacio funcional general.
