
(() => {
    'use strict';

    // CARGAR ESTILOS DE EXCEL

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'excel.css';
    document.head.append(css);

    // CREAR BARRA DE EXPORTACIÓN

    const bar = document.createElement('div');
    bar.className = 'excel-export-bar';

    bar.innerHTML = `
        <div>
            <strong>Exporta tu análisis en Excel</strong>
            <p>
                Descarga el cruce por folio, el resumen de rechazos,
                los rankings de motivos y las tablas dinámicas editables.
                Se utilizarán los filtros seleccionados en el tablero.
            </p>
        </div>

        <button id="exportExcel" disabled>
            ↓ Exportar análisis a Excel
        </button>

        <p
            id="excelStatus"
            role="status"
            aria-live="polite"
        ></p>
    `;

    const analysis = document.getElementById('analisis');
    const empty = document.getElementById('empty');

    analysis.insertBefore(bar, empty);

    // VARIABLES

    let current = null;
    let worker = null;

    const button = document.getElementById('exportExcel');
    const status = document.getElementById('excelStatus');

    // RECIBIR DATOS DEL ANÁLISIS

    document.addEventListener('rechazos:render', e => {
        current = e.detail;

        button.disabled = !current || !!worker;
    });

    // LIMPIAR DATOS

    document.addEventListener('rechazos:reset', () => {
        worker?.terminate();

        worker = null;
        current = null;

        button.disabled = true;
        status.textContent = '';
    });

    // EXPORTAR EXCEL

    button.onclick = () => {
        if (!current || worker) return;

        button.disabled = true;

        status.textContent =
            'Preparando el cruce, los rankings y las tablas dinámicas…';

        worker = new Worker('excel-worker.js?v=20261022-filtros');

        // SOLO SECCIÓN A
        const options = {
            ...current.options,
            target: 'a',
            generated: new Date().toISOString()
        };

        worker.onmessage = ({data}) => {
            if (data.ok) {
                const blob = new Blob(
                    [data.bytes],
                    {
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    }
                );

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');

                a.href = url;

                a.download =
                    'rechazos-analisis-' +
                    new Date().toISOString().slice(0, 10) +
                    '.xlsx';

                a.click();

                setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 1000);

                status.textContent =
                    'Excel descargado. Consulta la hoja Resumen, ' +
                    'el cruce de folios y las tablas dinámicas disponibles.';

            } else {
                status.textContent =
                    'No se pudo exportar: ' + data.error;
            }

            worker.terminate();
            worker = null;

            button.disabled = !current;
        };

        // CONTROL DE ERRORES

        worker.onerror = () => {
            status.textContent =
                'No se pudo iniciar la exportación. ' +
                'Recarga el tablero e inténtalo de nuevo.';

            worker?.terminate();
            worker = null;

            button.disabled = !current;
        };

        // ENVIAR INFORMACIÓN AL GENERADOR

        worker.postMessage({
            model: current.model,
            options
        });
    };
})();
