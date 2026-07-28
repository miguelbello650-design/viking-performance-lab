# Usuarios

## Entrenador

Usuario principal del MVP y autoridad final sobre los analisis y las estrategias.

Puede:

- gestionar sus atletas asociados;
- importar actividades y rutas;
- confirmar atleta, disciplina y tipo de elemento;
- revisar validaciones, advertencias y duplicados;
- consultar datos observados y calculos trazables;
- revisar, corregir o aprobar interpretaciones y recomendaciones.

## Atleta

Usuario secundario del MVP con acceso de lectura limitado a su propio espacio.

Puede consultar:

- actividades y rutas aceptadas que le pertenezcan;
- informacion y calculos que el producto marque como visibles;
- analisis, hipotesis o recomendaciones despues de la revision del entrenador.

No puede, por defecto:

- importar archivos;
- asignar o cambiar atleta, disciplina o tipo;
- resolver duplicados;
- consultar archivos originales o analisis internos no revisados;
- modificar planes automaticamente ni aprobar decisiones en nombre del entrenador.

## Administrador

Rol operativo interno para soporte, auditoria y gestion de importaciones.

Puede, con permisos y trazabilidad:

- revisar errores de importacion;
- consultar estados y eventos de auditoria;
- ayudar a corregir incidencias operativas;
- actuar sobre una importacion cuando exista autorizacion registrada.

No puede, por defecto:

- decidir interpretaciones deportivas;
- aprobar recomendaciones en nombre del entrenador;
- modificar planes;
- acceder a datos de atletas fuera del alcance autorizado;
- ocultar, eliminar o sobrescribir archivos y decisiones sin trazabilidad.

## Regla general de acceso

El acceso se limita al espacio de trabajo y a los atletas autorizados. La visibilidad para el atleta debe distinguir informacion aceptada y revisada de informacion interna o pendiente.
