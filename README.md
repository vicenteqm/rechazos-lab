# Rechazos Lab

Tablero estático para cruzar BPI, records y agencia, comparar dos selecciones y explicar cada indicador. HTML, CSS y JavaScript; no requiere servidor de datos ni npm.

## Uso

1. Abre la dirección publicada en GitHub Pages.
2. Selecciona uno o varios Excel/CSV de BPI, records y agencia. Debes cargar las tres fuentes. Usa BPI de los periodos que quieras comparar y records de esos mismos periodos.
3. Revisa la hoja detectada y, si hace falta, ajusta las columnas en “Revisar columnas detectadas”.
4. Pulsa “Construir análisis”. Elige mes, región y determinante por separado para A y B.
5. Descarga el resumen agregado o la revisión por folio de la selección A. Vaciar sesión elimina los datos de memoria; recargar requiere volver a cargar las fuentes.

Puedes agregar archivos después del primer análisis; vuelve a construir para incorporarlos. El tablero no guarda archivos en GitHub, localStorage ni una base de datos. La lectura de Excel se ejecuta en un Web Worker para no bloquear la interfaz. Google Fonts es opcional para la tipografía y no recibe el contenido de los archivos.

## Columnas

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
