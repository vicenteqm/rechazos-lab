# Rechazos Lab

Tablero local para analizar BPI, Records y Agencia, con responsables de la base de tiendas y capturistas validados mediante asistencias. Conserva el diseño Halloween pixel. **El tablero y su modelo procesado se publican en GitHub Pages por autorización del propietario. Los Excel originales, la configuración, las credenciales y la caché permanecen en la computadora.**

## Abrir el tablero compartido

Abre https://vicenteqm.github.io/rechazos-lab/ para consultar los datos y compartir el enlace. Los usuarios no necesitan Excel, Python ni acceso a las carpetas del equipo actualizador. El modelo publicado contiene folios, nombres de responsables y capturistas, estatus y motivos.

## Equipo actualizador

En este equipo ya está configurado. Ejecuta **ABRIR_RECHAZOS_LOCAL.bat** y abre `http://127.0.0.1:8798/`. No hay carga manual de Excel en la página. Se mantienen las exportaciones de Excel con seis tablas dinámicas nativas, CSV y HTML autónomo.

- **ACTUALIZAR_RECHAZOS.bat** revisa las carpetas en ese momento.
- **CONFIGURAR_ACTUALIZACION.bat** instala o reemplaza la tarea `RechazosLab-ActualizarLocal`, cada cinco minutos y al iniciar sesión. Requiere el equipo encendido y sesión iniciada; publica solo el modelo procesado y no modifica ni sube los Excel originales.
- El servidor local también revisa las fuentes cada cinco minutos mientras está abierto. Un bloqueo impide dos actualizaciones simultáneas.
- La página consulta una nueva versión cada treinta segundos y conserva filtros compatibles. Si se detecta un archivo inválido, muestra el error y conserva la última versión válida.

## Carpetas de entrada

Las rutas reales se guardan en **automation/config.json**, que no se publica. Para configurar otro equipo, copia **automation/config.example.json**, ajusta las cinco carpetas y el directorio de salida. Python necesita `openpyxl`; el runtime de este equipo ya lo incluye. Node.js ejecuta el motor de cruce sin instalar paquetes.

| Fuente | Contenido y selección |
| --- | --- |
| Base de tiendas | Un solo Excel vigente. Se reconocen región, determinante, tienda, team líder, líder SWAT, nombre de sublíder y ejecutivas RH, CPRO y enlace banco. Si hay dos archivos se detiene la actualización para retirar la copia anterior. |
| Asistencias | Archivos por mes, por ejemplo ASISTENCIA_INVEX_09.xlsx y ASISTENCIA_INVEX_10.xlsx, dentro del año correspondiente. |
| BPI | Archivos BPI_SEPTIEMBRE.xlsx, BPI_OCTUBRE.xlsx y los meses posteriores. El mes de cada solicitud lo determina FECHA DE CREACIÓN. |
| Consolidados | Un solo Excel de Agencia con folio, Estatus_P y, cuando existe, fecha/archivo del último corte. |
| Records | CSV o Excel mensual. Puede reemplazarse el archivo del mes o agregarse una versión posterior. También se reconocen nombres records_report_20261001_20261022.csv. |

En carpetas mensuales se toma una única instantánea por mes: la de modificación más reciente, con nombre como desempate. No se suman versiones viejas del mismo mes. Septiembre permanece cuando se reemplaza octubre. Los archivos temporales de Excel (~$) se ignoran. Los originales solo se leen: el sistema no descarga reportes de otras plataformas ni modifica las fuentes.

La fecha de modificación identifica la versión del archivo, pero **no prueba que el mes esté completo**. La pantalla muestra por separado la última fecha disponible de BPI y Records y el corte de Agencia. Si BPI llega al 21 y Records al 22, el universo de solicitudes sigue siendo el BPI hasta el 21.

## Reglas del cruce

1. **Universo:** un folio numérico único de BPI es una solicitud. Las fuentes adicionales no aumentan ese universo. Rechazo significa ESTATUS BANCO que comienza con RECHAZO; incluye PF y CE. El alcance puede incluir canceladas.
2. **Motivo:** Estatus_P de Agencia, normalizado por el motor. Se usa el último corte reconocido por folio. Un motivo vacío, conflicto, aprobación o falta de coincidencia se conserva como categoría de revisión. Records contrasta el estatus.
3. **Tiendas y responsables:** determinante exacto contra la base vigente. Las dos columnas SUBLIDER se distinguen: la primera representa cantidad autorizada; la segunda, la persona responsable. Si el determinante no es único, no se escoge la primera tienda ni se duplican folios. Región y responsables son asignaciones actuales, también al consultar meses anteriores; no reconstruyen una estructura histórica.
4. **Capturista:** determinante + mes + identificadores exactos de BPI y asistencia: ID/nómina, USUARIO FICO/USUARIO y EJ USUARIO o EJECUTIVO P/USUARIO BPI. Los identificadores disponibles deben coincidir en una sola persona, con fechas de ingreso a PDV y baja compatibles con la solicitud. NOMBRE de BPI es el cliente y no se utiliza para identificar al promotor.
5. **Sin validar:** una identidad ausente o ambigua se conserva con el alias de BPI y la marca correspondiente. No se hacen coincidencias aproximadas de nombres ni se atribuye a quien simplemente trabaja en la misma tienda. El puesto y la captura del día se incluyen cuando existe coincidencia. Un código de asistencia no demuestra quién utilizó físicamente la cuenta.
6. **Sublíder:** procede del nombre en base de tiendas. Cuando está pendiente, puede completarse con el único sublíder de la asistencia del día con captura A/R y fechas laborales compatibles. Se conserva el origen en el modelo.

## Filtros y exportaciones

Selecciona un mes. Región, tienda, determinante, team leader, líder SWAT, sublíder, promotor/capturista, puesto, ejecutivas RH/CPRO/enlace banco y validación de identidad se restringen entre sí. El último filtro cambiado tiene prioridad; los incompatibles se limpian. **Limpiar filtros** conserva el mes y restablece los demás.

El Excel exporta solo las solicitudes de la vista actual. Incluye Cruce con 33 campos, Resumen, Guia y seis tablas dinámicas reales: causas de mayor y menor frecuencia, regiones, determinantes, meses y estatus. En Excel usa **Datos > Actualizar todo** después de editar el cruce. Conserva INCLUIR = Sí para reproducir los casos.

El HTML autónomo incluye únicamente los folios de la selección actual, con gráficos, detalle de motivos y filtros. Funciona sin internet y no permite cargar archivos. Puede contener nombres de responsables y capturistas y sus estatus; se comparte manualmente con los destinatarios que correspondan. El código de publicación nunca incluye ese HTML descargado.

## Archivos locales y recuperación

**.private/** contiene caché de lectura, generaciones del modelo, registros y el sitio local. Se excluye de Git. **automation/config.json** también se excluye. Cada fuente se comprueba con SHA-256 y se vuelve a verificar antes de hacer visible una generación. El puntero de versión se reemplaza solo después de guardar el modelo completo.

- `.private/ultima_actualizacion.json`: última generación válida, cortes y fuentes.
- `.private/ultimo_error.json`: último error registrado; puede ser anterior a una recuperación posterior.
- `.private/sitio/data/status.json`: resultado de la revisión más reciente.
- `.private/actualizacion.log` y `.private/servicio.log`: ejecución del actualizador y del servidor.

El servidor escucha únicamente en 127.0.0.1. Cierra o reinicia el equipo normalmente; la tarea vuelve a revisar los datos al iniciar sesión y **ABRIR_RECHAZOS_LOCAL.bat** vuelve a iniciar el servidor al abrir el tablero.

## Verificación

- `node tests/core.test.cjs`: llaves, fechas, motivos, tasas y filtros.
- `node tests/excel.test.cjs`: seis tablas dinámicas y exportación filtrada.
- `python -m unittest discover -s tests -p "*_test.py" -v`: detección de meses, reemplazo de versiones, identidad exacta y conservación de datos ante errores.
- `node tests/local-model.test.cjs`: conciliación inicial de septiembre/octubre y filtros sobre los archivos reales de este equipo; no es una prueba para CI sin fuentes locales.
- `node tests/html.test.cjs RUTA_AL_HTML`: ejecuta el script incrustado sin red y verifica el render y los filtros.

## Publicación de datos

`automation/config.json` permite habilitar `publish.enabled` con el destino autorizado vicenteqm/rechazos-lab. Después de cada cruce correcto, el actualizador publica un modelo JSON comprimido, version.json y un estado de publicación correcto en una sola confirmación de Git. Usa la sesión GitHub guardada por Git en Windows; nunca escribe credenciales en archivos del proyecto. Si falla la publicación, reintenta en la siguiente revisión aunque no hayan cambiado las fuentes. `.private/publicacion.json` registra la última versión enviada.

La página se actualiza después del despliegue de GitHub Pages, que puede tardar unos minutos. El equipo actualizador necesita estar encendido, con sesión iniciada e internet para publicar cambios. El enlace permanece consultable cuando ese equipo está apagado y muestra la última versión publicada.
