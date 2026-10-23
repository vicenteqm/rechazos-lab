(() => {
    'use strict';
    const bar = document.createElement('div');
    bar.className = 'excel-export-bar';
    bar.innerHTML = `<div><strong>Comparte el tablero como HTML</strong><p>Incluye únicamente los folios de la selección actual, con gráficos y filtros interactivos. Funciona sin internet y no permite cargar archivos. Quien lo reciba podrá consultar folios, responsables, promotores, estatus y motivos incluidos.</p></div><button id="exportHtml" disabled>↓ Exportar tablero HTML</button><p id="htmlStatus" role="status" aria-live="polite"></p>`;
    document.getElementById('analisis').insertBefore(bar, document.getElementById('empty'));
    const button = document.getElementById('exportHtml');
    const status = document.getElementById('htmlStatus');
    let current = null, busy = false;
    document.addEventListener('rechazos:render', e => { current = e.detail; button.disabled = busy || !current; });
    document.addEventListener('rechazos:reset', () => { current = null; button.disabled = true; status.textContent = ''; });
    const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const safeScript = value => value.replace(/<\/script/gi, '<\\/script');
    button.onclick = async () => {
        if (!current || busy) return;
        busy = true; button.disabled = true;
        status.textContent = 'Preparando el informe con los datos de esta selección…';
        const snapshot = current;
        try {
            const paths = ['index.html','styles.css','halloween.css','visuals.css','pumpkin.svg','core.js','app.js'];
            const parts = await Promise.all(paths.map(async path => {
                const response = await fetch(path + '?v=20261023-busqueda');
                if (!response.ok) throw Error('No se pudo leer ' + path);
                return response.text();
            }));
            const [shell, baseCSS, halloweenCSS, visualsCSS, pumpkin, core, app] = parts;
            const doc = new DOMParser().parseFromString(shell, 'text/html');
            doc.querySelectorAll('script, link, #fuentes, #actualizacion, #empty, nav a[href="#fuentes"], nav a[href="#actualizacion"], footer a').forEach(el => el.remove());
            doc.querySelector('.brand').removeAttribute('href');
            doc.querySelector('.privacy').textContent = '● Informe autónomo · Datos incrustados';
            doc.querySelector('.hero .intro').textContent = 'Informe compartido de la selección exportada. Los filtros y gráficos funcionan sin internet. No permite cargar archivos ni consultar folios fuera de esta selección.';
            doc.querySelector('.hero-note').innerHTML = '<span class="pill">INFORME COMPARTIDO</span><h3>Datos listos para consultar</h3><p>Selecciona región, tienda o determinante para explorar los casos incluidos.</p>';
            doc.querySelector('footer > span:nth-child(2)').textContent = 'Informe local · Contiene datos de la selección exportada';
            const selected = snapshot.options.a;
            const rows = window.RechazosCore.select(snapshot.model.rows, selected, snapshot.options.scope).base;
            if (!rows.length) throw Error('La selección no tiene solicitudes para compartir.');
            const data = {model: {...snapshot.model, rows, months: [...new Set(rows.map(r => r.month))].sort()}, filters: selected, scope: snapshot.options.scope};
            const note = doc.createElement('p');
            note.className = 'quality';
            note.textContent = `Informe generado el ${new Date().toLocaleString('es-MX')}. Contiene ${rows.length.toLocaleString('es-MX')} solicitudes de la selección exportada. Limpiar filtros solo permite explorar esos datos. Las cifras de archivos y repeticiones describen la carga original.`;
            doc.getElementById('analisis').prepend(note);
            const style = doc.createElement('style');
            const icon = 'data:image/svg+xml,' + encodeURIComponent(pumpkin);
            style.textContent = (baseCSS + '\n' + halloweenCSS + '\n' + visualsCSS).replace(/@import\s+url\([^)]*\);/g, '').replace(/url\('pumpkin.svg'\)/g, `url("${icon}")`);
            doc.head.append(style);
            doc.title = 'Rechazos Lab · Informe ' + selected.month;
            const script = doc.createElement('script');
            script.textContent = 'window.RechazosShared=' + safeJSON(data) + ';\n' + safeScript(core) + '\n' + safeScript(app);
            doc.body.append(script);
            const blob = new Blob(['<!doctype html>\n' + doc.documentElement.outerHTML], {type:'text/html;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `rechazos-informe-${selected.month}.html`; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            status.textContent = 'HTML descargado. Comparte ese archivo; se abre directamente en un navegador, sin internet ni carga de archivos.';
        } catch (error) { status.textContent = 'No se pudo exportar: ' + error.message; }
        finally { busy = false; button.disabled = !current; }
    };
})();
