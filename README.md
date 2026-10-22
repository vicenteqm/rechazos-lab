# Rechazos Lab

Tablero estático para cruzar BPI, records y agencia, analizar un mes a la vez y explicar cada indicador. HTML, CSS y JavaScript; no requiere servidor de datos ni npm.

## Uso

1. Abre la dirección publicada en GitHub Pages.
2. Selecciona uno o varios Excel/CSV de BPI, records y agencia. Debes cargar las tres fuentes. Usa BPI y records del mes que quieras analizar.
3. Revisa la hoja detectada y, si hace falta, ajusta las columnas en “Revisar columnas detectadas”.
4. Pulsa “Construir análisis”. Elige un mes, región, tienda y determinante. Los filtros se restringen entre sí; el último cambio tiene prioridad y limpia selecciones incompatibles. “Limpiar filtros del mes” conserva el mes y restablece las demás opciones. La tienda se obtiene de SEDE, TIENDA o SUCURSAL en BPI.
5. Descarga el resumen agregado o la revisión por folio de la vista filtrada. Vaciar sesión elimina los datos de memoria; recargar requiere volver a cargar las fuentes.

Puedes agregar archivos después del primer análisis; vuelve a construir para incorporarlos. El tablero no guarda archivos en GitHub, localStorage ni una base de datos. La lectura de Excel se ejecuta en un Web Worker para no bloquear la interfaz. Google Fonts es opcional para la tipografía y no recibe el contenido de los archivos.

## Exportar un Excel para compartir

Después de construir el análisis, usa **Exportar Excel con tablas dinámicas**. Puedes elegir todo el cruce cargado o solo las solicitudes de la vista filtrada o B. Se respeta el alcance de rechazos o rechazos y canceladas elegido en el tablero.

El archivo contiene:

- **Resumen:** solicitudes, casos, tasa, revisión y hasta diez causas por cada extremo de frecuencia.
- **TD_Mayor / TD_Menor:** tablas dinámicas nativas con todas las causas de mayor a menor y de menor a mayor.
- **TD_Regiones, TD_Determinantes, TD_Meses y TD_Estatus:** tablas dinámicas para analizar los casos desde diferentes dimensiones.
- **Cruce:** una tabla Excel con todos los folios BPI exportados, las coincidencias con records y agencia, el motivo agrupado y original, el archivo de agencia, el corte y las alertas. La columna INCLUIR marca los casos del alcance seleccionado.
- **Guia:** selección exportada, periodos, región, tienda y determinante, metodología y archivos de origen.

En Excel puedes reorganizar los campos de cada tabla dinámica. Después de editar Cruce, usa **Datos > Actualizar todo**. Las fórmulas del resumen se recalculan desde el cruce; para regenerar el orden de su ranking vuelve a exportar o vuelve a ordenarlo. Conserva el filtro INCLUIR = Sí para reproducir los casos del tablero. Cambiar el alcance entre rechazos y canceladas requiere volver a exportar desde el tablero.

La exportación se genera en tu navegador con una plantilla diseñada con Artifact Tool y piezas nativas de Open XML. No usa macros, conexiones externas ni servicios de subida. Incluye folios y estatus, pero no nombres de clientes o ejecutivos.

### Columnas de entrada

| Fuente | Obligatorias | Opcionales |
|---|---|---|
| BPI | FOLIO, FECHA DE CREACIÓN, REGION, DETERMINANTE, ESTATUS BANCO | — |
| Records | Folio FICO, Estatus FICO | Aprobación, Estatus del proceso, F. Creación |
| Agencia | FOLIO, Estatus_P | ESTATUS, Estatus_FICO, ARCHIVO_ULTIMO_CORTE o FECHA DE CORTE |

Se ignoran mayúsculas, acentos y espacios extra al detectar encabezados. Puedes asignar otros encabezados manualmente. Se admite XLSX, XLS y CSV en UTF-8 o Windows-1252. Las fechas BPI admiten ISO (año-mes-día), día/mes/año o número de serie Excel. La lectura numérica usa el calendario Excel 1900; archivos con calendario 1904 deben convertirse antes.

## Reglas de análisis

- **Universo:** folios numéricos únicos en BPI. El mes es el de creación BPI. Las fuentes de records/agencia se cruzan por folio, sin incorporar folios externos al universo.
- **Rechazos:** ESTATUS BANCO empieza con RECHAZO; incluye PF y CE. La opción de canceladas incorpora estatus que empiezan con CANCELADA/CANCELADO.
- **Región y determinante:** provienen de BPI. Vacíos se conservan como “Sin dato”.
- **Motivo:** Estatus_P de agencia, con normalización de variantes conocidas. Valores desconocidos se conservan; no se inventan causas. Aprobaciones, casos en proceso, ausencias y conflictos son categorías de revisión.
- **Records:** contrasta el proceso. “Aprobada Cancelada” no se traduce a un motivo crediticio. Diferentes combinaciones de estatus/aprobación/proceso generan una alerta por folio.
- **Duplicados BPI:** repeticiones idénticas en campos analíticos se consolidan. Si cambian fecha, estatus, región o determinante del mismo folio se bloquea el cruce: el usuario debe resolver o elegir un solo corte.
- **Duplicados agencia:** se usa la fila con la fecha de corte más reciente si todas tienen fecha reconocida. La fecha puede ser explícita o leerse del nombre de corte (incluye variante SEPTEIMBRE); si falta el año se infiere solo cuando BPI contiene un único año. Conflictos en la misma fecha o con fechas desconocidas se marcan y no reciben un motivo arbitrario.
- **Tasa:** casos / solicitudes BPI con los mismos filtros. **Participación:** casos del motivo / casos de la selección. Una base vacía se muestra como “—”. **Δ pp:** tasa o participación A menos B, en puntos porcentuales.
- **Cobertura:** coincidencias por folio / casos seleccionados. Tener coincidencia no implica que el motivo esté disponible.
- **Revisión:** número de folios con al menos una alerta. Las alertas individuales pueden superponerse.

El consolidado representa el último corte disponible. Una cohorte de septiembre con agencia de octubre no reconstruye el cierre al 30 de septiembre. Compara cortes y periodos equivalentes antes de interpretar cambios. Las visualizaciones describen asociación y volumen; no prueban causalidad.

El CSV de revisión contiene folios y estatus. Se descarga únicamente a petición del usuario y no se sube al repositorio. Los nombres de clientes y ejecutivos no se incluyen en el modelo analítico. Los CSV exportados neutralizan valores que podrían interpretarse como fórmulas.

## Desarrollo y pruebas

```sh
python -m http.server 8794 --bind 127.0.0.1
# Abrir http://127.0.0.1:8794
node tests/core.test.cjs
# Opcional: requiere los archivos originales, solo en tu equipo
node tests/real-files.cjs "C:/Users/plantilla.r3/Downloads"
```

Abre la página mediante HTTP; los Web Workers no funcionan de forma fiable con doble clic en `index.html` (`file://`).

## Publicación

Sube los archivos de este proyecto a un repositorio nuevo y activa GitHub Pages desde la rama principal, carpeta raíz. No incluyas los Excel ni CSV originales. No se necesita compilar. El proyecto empieza sin datos: cada persona carga sus propias fuentes en su navegador.

## Dependencia

SheetJS CE 0.20.3, distribuida en `vendor/xlsx.full.min.js`; licencia Apache-2.0 incluida en `vendor/LICENSE-SheetJS.txt`. Fuente oficial: https://docs.sheetjs.com/docs/getting-started/installation/standalone/ y https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js. SHA256 del archivo: `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`.

fflate 0.8.2 se usa para empaquetar el archivo Excel. Licencia MIT incluida en `vendor/LICENSE-fflate.txt`. Fuente: https://github.com/101arrowz/fflate .

## Compartir un HTML sin conexión

Pulsa **Exportar tablero HTML** después de construir el análisis. El archivo incluye solo las solicitudes de los filtros actuales, gráficos interactivos, detalle de motivos, filtros vinculados y CSV de resumen/revisión. No muestra ni permite cargar archivos. Se abre directamente en un navegador sin internet; no requiere los Excel originales, bibliotecas externas ni servidor. Los nombres de clientes y ejecutivos no forman parte del modelo, pero sí se incluyen folios, estatus, motivos y referencias de los archivos utilizados. Comparte el informe con quienes deban consultar esa información.

El botón Limpiar filtros del mes solo amplía la consulta dentro de los datos exportados. Las cifras de calidad de archivos describen la carga original, como indica la nota del informe.
