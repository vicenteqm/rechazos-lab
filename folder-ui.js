(() => {
    'use strict';
    window.RechazosLive = {
        async start(accept) {
            const status = document.getElementById('liveStatus');
            let generation = '', checking = false;
            const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            await Promise.all(['vendor/fflate.js','excel-ui.js','html-export.js'].map(source => new Promise((resolve,reject)=>{
                const script=document.createElement('script');script.src=source+'?v=20261023-fecha';script.onload=resolve;script.onerror=reject;document.head.append(script);
            })));
            async function refresh() {
                if (checking) return;
                checking = true;
                try {
                    const response = await fetch('data/version.json',{cache:'no-store'});
                    if (!response.ok) throw Error('Los datos todavía no están disponibles. La publicación puede estar en proceso; se volverá a comprobar automáticamente.');
                    const version = await response.json();
                    if (version.id !== generation) {
                        if (!/^model-[a-f0-9]+\.json(?:\.gz)?$/.test(version.model)) throw Error('Referencia de datos no válida.');
                        const result = await fetch('data/'+version.model,{cache:'no-store'});
                        if (!result.ok) throw Error('La nueva versión todavía no está disponible.');
                        const model = version.model.endsWith('.gz') ? JSON.parse(new TextDecoder().decode(window.fflate.gunzipSync(new Uint8Array(await result.arrayBuffer())))) : await result.json();
                        if (!Array.isArray(model.rows)||!model.rows.length) throw Error('Versión sin solicitudes válidas.');
                        accept(model);generation=version.id;
                        const summary = document.getElementById('sourceSummary');
                        summary.innerHTML = '<table><thead><tr><th>Fuente</th><th>Archivo</th><th>Periodo</th><th>Última fecha de datos</th><th>Modificación</th></tr></thead><tbody>'+model.automation.sources.map(s=>'<tr><td>'+esc(({stores:'Base de tiendas',attendance:'Asistencia',bpi:'BPI',agency:'Agencia',records:'Records'})[s.role]||s.role)+'</td><td>'+esc(s.name)+'</td><td>'+esc(s.period||'Base vigente / consolidado')+'</td><td>'+esc(s.lastDate||'Según fuente')+'</td><td>'+esc(s.modified.slice(0,16).replace('T',' '))+'</td></tr>').join('')+'</tbody></table>';
                    }
                    const checked = await fetch('data/status.json',{cache:'no-store'});
                    if (checked.ok) { const health=await checked.json(); if (!health.ok) throw Error('El actualizador encontró un problema: '+health.error); }
                    status.textContent = 'Datos actualizados el '+new Date(version.generated).toLocaleString('es-MX')+'. Verificación automática activa. El histórico de meses se conserva.';
                } catch(error) {
                    status.textContent = (generation?'Se conserva la última versión. ':'')+error.message;
                } finally { checking=false; }
            }
            await refresh();setInterval(refresh,30000);
        }
    };
})();
