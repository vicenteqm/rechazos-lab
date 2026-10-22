(()=>{
 const css=document.createElement('link');css.rel='stylesheet';css.href='excel.css';document.head.append(css);
 const bar=document.createElement('div');bar.className='excel-export-bar';bar.innerHTML='<div><strong>Comparte el análisis en Excel</strong><p>Cruce por folio, resumen de mayor y menor frecuencia y seis tablas dinámicas editables.</p></div><label>Qué exportar<select id="excelScope"><option value="all">Todo el cruce cargado</option><option value="a">Solo la selección A</option><option value="b">Solo la selección B</option></select></label><button id="exportExcel" disabled>↓ Exportar Excel con tablas dinámicas</button><p id="excelStatus" role="status" aria-live="polite"></p>';
 document.getElementById('analisis').insertBefore(bar,document.getElementById('empty'));
 let current=null,worker=null;const button=document.getElementById('exportExcel'),status=document.getElementById('excelStatus');
 document.addEventListener('rechazos:render',e=>{current=e.detail;button.disabled=!current||!!worker;});
 document.addEventListener('rechazos:reset',()=>{worker?.terminate();worker=null;current=null;button.disabled=true;status.textContent='';});
 button.onclick=()=>{
  if(!current||worker)return;button.disabled=true;status.textContent='Preparando el cruce, los rankings y las tablas dinámicas…';
  worker=new Worker('excel-worker.js');
  const options={...current.options,target:document.getElementById('excelScope').value,generated:new Date().toISOString()};
  worker.onmessage=({data})=>{
   if(data.ok){const blob=new Blob([data.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rechazos-cruce-'+options.target+'-'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Excel descargado. Abre Resumen para consultar los resultados y las hojas TD_ para reorganizar las tablas dinámicas.';}
   else status.textContent='No se pudo exportar: '+data.error;
   worker.terminate();worker=null;button.disabled=!current;
  };
  worker.onerror=()=>{status.textContent='No se pudo iniciar la exportación. Recarga el tablero e inténtalo de nuevo.';worker?.terminate();worker=null;button.disabled=!current;};
  worker.postMessage({model:current.model,options});
 };
})();
