'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('es-MX'),pct=n=>n==null?'—':(n*100).toLocaleString('es-MX',{maximumFractionDigits:1,minimumFractionDigits:1})+'%';
const fields={folio:'Folio',created:'Fecha de creación',region:'Región',det:'Determinante',status:'Estatus',approval:'Aprobación',process:'Proceso',reason:'Motivo específico',fico:'Estatus FICO',cut:'Archivo o fecha de corte'};
const schema={bpi:['folio','created','region','det','status'],records:['folio','status','approval','process','created'],agency:['folio','reason','status','fico','cut']};
const required={bpi:['folio','created','region','det','status'],records:['folio','status'],agency:['folio','reason']};
let docs=[],model=null,views={},seq=0,worker=null,pending=0,busy=false;
function startWorker(){
  worker=new Worker('worker.js');
  worker.onmessage=({data})=>{
    if(data.type==='loaded'){
      pending--;const best=[...data.sheets].sort((a,b)=>b.score-a.score||b.count-a.count)[0];
      docs.push({...data,sheet:best.name,map:{...best.map}});renderFiles(data.role);status(`${data.name}: ${fmt(best.count)} filas disponibles. Revisa la hoja y las columnas antes de construir.`);
    }else if(data.type==='result'){
      busy=false;model=data.result;renderModel();status(`Análisis listo: ${fmt(model.rows.length)} folios BPI únicos. Puedes comparar las selecciones A y B.`);
    }else if(data.type==='error'){
      if(busy)busy=false;else pending=Math.max(0,pending-1);fail(data.error);
    }
    buttons();
  };
  worker.onerror=()=>{pending=0;busy=false;fail('No fue posible iniciar el lector de archivos. Abre el tablero desde GitHub Pages o un servidor local y verifica que vendor/xlsx.full.min.js esté disponible.');buttons();};
}
function status(text){$('status').textContent=text;}
function fail(text){$('error').hidden=false;$('error').textContent=text;status('Revisa el aviso antes de continuar.');}
function buttons(){const enabled=['bpi','records','agency'].every(role=>docs.some(d=>d.role===role));$('analyze').disabled=!enabled||!!pending||busy;$('analyze').textContent=busy?'Cruzando archivos…':'Construir análisis ↗';for(const role of ['bpi','records','agency'])$(role).disabled=busy;$('clear').disabled=busy;document.querySelectorAll('.file-entry select,.file-entry button').forEach(el=>el.disabled=busy);}
function invalidate(){model=null;$('results').hidden=true;$('empty').hidden=false;$('export').disabled=true;$('error').hidden=true;}
function renderFiles(role){
  const root=$(role+'Files');root.replaceChildren();
  for(const doc of docs.filter(d=>d.role===role)){
    const entry=document.createElement('div');entry.className='file-entry';
    const button=document.createElement('button');button.className='remove';button.textContent='×';button.setAttribute('aria-label','Quitar '+doc.name);button.onclick=()=>{docs=docs.filter(d=>d.id!==doc.id);worker.postMessage({type:'remove',fileId:doc.id});invalidate();renderFiles(role);buttons();};entry.append(button);
    const name=document.createElement('strong');name.textContent=doc.name;entry.append(name);
    const label=document.createElement('label');label.textContent='Hoja';const select=document.createElement('select');for(const s of doc.sheets){const o=new Option(`${s.name} · ${fmt(s.count)} filas`,s.name);select.add(o);}select.value=doc.sheet;select.onchange=()=>{doc.sheet=select.value;doc.map={...doc.sheets.find(s=>s.name===doc.sheet).map};invalidate();renderFiles(role);buttons();};label.append(select);entry.append(label);
    const details=document.createElement('details');details.className='mapping';const summary=document.createElement('summary');summary.textContent='Revisar columnas detectadas';details.append(summary);
    for(const field of schema[role]){
      const l=document.createElement('label');l.textContent=fields[field]+(required[role].includes(field)?' *':' (opcional)');const s=document.createElement('select');s.add(new Option('Sin asignar',''));for(const h of doc.sheets.find(x=>x.name===doc.sheet).headers.filter(Boolean))s.add(new Option(h,h));s.value=doc.map[field]||'';s.onchange=()=>{doc.map[field]=s.value;invalidate();};l.append(s);details.append(l);
    }
    entry.append(details);root.append(entry);
  }
}
for(const role of ['bpi','records','agency'])$(role).addEventListener('change',e=>{
  if(!worker)startWorker();invalidate();
  for(const file of e.target.files){if(!/\.(xlsx|xls|csv)$/i.test(file.name)){fail('Formato no permitido: '+file.name);continue;}pending++;status('Leyendo '+file.name+'…');worker.postMessage({id:++seq,type:'load',role,file});}
  e.target.value='';buttons();
});
$('analyze').onclick=()=>{invalidate();busy=true;$('error').hidden=true;status('Cruzando folios y comprobando las tres fuentes…');buttons();worker.postMessage({id:++seq,type:'build',docs:docs.map(({id,sheet,map})=>({id,sheet,map}))});};
$('clear').onclick=()=>{worker?.terminate();worker=null;docs=[];pending=0;busy=false;invalidate();for(const r of ['bpi','records','agency'])renderFiles(r);buttons();status('Sesión vacía. Carga BPI, records y agencia para comenzar.');};
function optionList(id,values,label){const s=$(id);s.replaceChildren(new Option(label,''));for(const value of values)s.add(new Option(value,value));}
function renderModel(){
  // Core is loaded separately for the same selection logic used by the worker.
  $('results').hidden=false;$('empty').hidden=true;$('export').disabled=false;
  const regions=[...new Set(model.rows.map(r=>r.region))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));const dets=[...new Set(model.rows.map(r=>r.det))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  for(const v of ['a','b']){optionList(v+'Month',model.months,'Todos los meses');optionList(v+'Region',regions,'Todas las regiones');optionList(v+'Det',dets,'Todos los determinantes');}
  if(model.months.length){$('aMonth').value=model.months.at(-1);$('bMonth').value=model.months.length>1?model.months.at(-2):model.months[0];}
  const r=model.report;const cuts=[...new Set(model.rows.map(x=>x.cut).filter(Boolean))].sort();
  $('quality').innerHTML=`<strong>${fmt(model.rows.length)} folios BPI únicos · ${fmt(model.files.length)} archivos cargados</strong><br>${fmt(r.duplicateBpi)} repeticiones BPI consolidadas; ${fmt(r.duplicateRecords)} repeticiones en records; ${fmt(r.duplicateAgency)} repeticiones en agencia. Filas sin folio numérico excluidas: BPI ${fmt(r.invalidBpi)}, records ${fmt(r.invalidRecords)}, agencia ${fmt(r.invalidAgency)}.<br><strong>Corte de agencia:</strong> ${cuts.length?esc(cuts[0])+' a '+esc(cuts.at(-1)):'sin fecha reconocida'}. Se utiliza el último corte disponible por folio; puede ser posterior al mes de creación. Los registros sin fecha de corte reconocida no permiten fijar una fecha histórica.`;
  render();
}
function filters(v){return {month:$(v+'Month').value,region:$(v+'Region').value,det:$(v+'Det').value};}
function table(headers,rows,numeric=[]){return `<table><thead><tr>${headers.map((h,i)=>`<th${numeric.includes(i)?' class="num"':''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>'<tr>'+row.map((c,i)=>`<td${numeric.includes(i)?' class="num"':''}>${esc(c)}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${headers.length}">Sin resultados para esta selección.</td></tr>`}</tbody></table>`;}
function metric(label,value,description,featured=false){return `<div class="metric ${featured?'featured':''}"><small>${esc(label)}</small><strong>${esc(value)}</strong><p>${esc(description)}</p></div>`;}
function bars(items,total){if(!items.length)return '<p class="chart-note">Sin casos para esta selección. Prueba otros filtros.</p>';const shown=items.slice(0,8),max=Math.max(...shown.map(r=>r.count),1);return shown.map(r=>`<div class="bar ${/SIN |CONFLICTO|DIFERENTE|EN PROCESO/.test(r.reason)?'revision':''}"><div class="bar-top"><span>${esc(r.reason)}</span><b>${fmt(r.count)} · ${pct(total?r.count/total:0)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${r.count/max*100}%"></div></div></div>`).join('')+`<p class="chart-note">${shown.length} de ${items.length} categorías. Longitud relativa al motivo de mayor volumen; porcentaje sobre ${fmt(total)} casos. ${items.length>8?'La tabla comparativa incluye todos los motivos.':''}</p>`;}
function render(){
  if(!model||!window.RechazosCore)return;
  const scope=$('scope').value;
  for(const v of ['a','b']){
    const f=filters(v),s=RechazosCore.select(model.rows,f,scope);views[v]=s;
    $(v+'Metrics').innerHTML=metric('Solicitudes BPI',fmt(s.base.length),'Folios únicos con los filtros de esta vista.')+metric(scope==='rejects'?'Rechazos BPI':'Rechazos y canceladas',fmt(s.total),'Un folio cuenta una sola vez.',true)+metric(scope==='rejects'?'Tasa de rechazo':'Tasa combinada',pct(s.rate),`${fmt(s.total)} casos / ${fmt(s.base.length)} solicitudes BPI.`)+metric('Casos para revisión',fmt(s.review.length),`${pct(s.total?s.review.length/s.total:null)} de los casos tiene al menos una alerta.`);
    $(v+'Reasons').innerHTML=bars(s.reasons,s.total);
    const regions=new Map();for(const r of s.base){if(!regions.has(r.region))regions.set(r.region,{base:0,count:0});regions.get(r.region).base++;}for(const r of s.cases)regions.get(r.region).count++;
    $(v+'Regions').innerHTML=table(['Región','Casos','Solicitudes','Tasa'],[...regions].filter(([,r])=>r.count).sort((a,b)=>b[1].count-a[1].count).slice(0,8).map(([reg,r])=>[reg,fmt(r.count),fmt(r.base),pct(r.count/r.base)]),[1,2,3]);
  }
  const a=views.a,b=views.b,delta=a.rate==null||b.rate==null?null:(a.rate-b.rate)*100;
  const same=JSON.stringify(filters('a'))===JSON.stringify(filters('b'));
  $('deltaTitle').textContent=same?'A y B muestran la misma selección':delta==null?'Falta una base para comparar':delta===0?'Las dos selecciones tienen la misma tasa':`La tasa de A es ${delta>0?'mayor':'menor'} que la de B`;
  $('deltaValue').textContent=delta==null?'—':`${delta>0?'+':''}${delta.toLocaleString('es-MX',{maximumFractionDigits:1,minimumFractionDigits:1})} pp`;
  $('deltaText').textContent=same?'Cambia el mes, región o determinante de una de las vistas para obtener una comparación.':`A: ${fmt(a.total)} de ${fmt(a.base.length)} solicitudes (${pct(a.rate)}). B: ${fmt(b.total)} de ${fmt(b.base.length)} (${pct(b.rate)}). Compara periodos completos y cortes equivalentes para interpretar el cambio.`;
  const reasons=[...new Set([...a.reasons,...b.reasons].map(r=>r.reason))].sort((x,y)=>(a.reasons.find(r=>r.reason===y)?.count||0)-(a.reasons.find(r=>r.reason===x)?.count||0));
  $('comparison').innerHTML=table(['Motivo','Casos A','% A','Casos B','% B','Δ pp'],reasons.map(reason=>{const x=a.reasons.find(r=>r.reason===reason),y=b.reasons.find(r=>r.reason===reason),pa=a.total?(x?.count||0)/a.total:null,pb=b.total?(y?.count||0)/b.total:null;return [reason,fmt(x?.count),pct(pa),fmt(y?.count),pct(pb),pa==null||pb==null?'—':((pa-pb)*100).toLocaleString('es-MX',{maximumFractionDigits:1,minimumFractionDigits:1})];}),[1,2,3,4,5]);
  $('trend').innerHTML=table(['Mes','Solicitudes','Casos','Tasa'],model.months.map(month=>{const s=RechazosCore.select(model.rows,{...filters('a'),month},scope);return [month,fmt(s.base.length),fmt(s.total),pct(s.rate)];}),[1,2,3]);
  const checks=[['Con coincidencia en records',`${fmt(a.records)} / ${fmt(a.total)} · ${pct(a.total?a.records/a.total:null)}`],['Con coincidencia en agencia',`${fmt(a.agency)} / ${fmt(a.total)} · ${pct(a.total?a.agency/a.total:null)}`],['Sin motivo en agencia',fmt(a.cases.filter(r=>r.reason==='SIN MOTIVO EN AGENCIA').length)],['Conflictos entre cortes agencia',fmt(a.cases.filter(r=>r.reason==='CONFLICTO ENTRE CORTES').length)],['Records con estatus distintos',fmt(a.cases.filter(r=>r.flags.includes('Records con estatus distintos')).length)],['Agencia reporta otro estatus',fmt(a.cases.filter(r=>['ESTATUS DIFERENTE EN AGENCIA','EN PROCESO EN AGENCIA'].includes(r.reason)).length)]];
  $('checks').innerHTML=checks.map(([k,v])=>`<div class="check"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  $('review').innerHTML=table(['Folio','BPI','Records','Agencia / motivo','Alerta'],a.review.slice(0,100).map(r=>[r.folio,r.status,r.records,r.agencyReason,r.flags.join('; ')]));
}
function csvCell(value){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function download(name,rows){const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>{if(!model)return;const rows=[['VISTA','MES','REGION','DETERMINANTE','ALCANCE','MOTIVO','CONTEO','PARTICIPACION','SOLICITUDES_BPI','CASOS','TASA','CASOS_REVISION']];for(const v of ['a','b']){const s=views[v],f=filters(v);for(const r of s.reasons)rows.push([v.toUpperCase(),f.month||'Todos',f.region||'Todas',f.det||'Todos',$('scope').value,r.reason,r.count,(r.share*100).toFixed(2)+'%',s.base.length,s.total,s.rate==null?'':(s.rate*100).toFixed(2)+'%',s.review.length]);if(!s.reasons.length)rows.push([v.toUpperCase(),f.month||'Todos',f.region||'Todas',f.det||'Todos',$('scope').value,'SIN CASOS',0,'',s.base.length,0,s.rate==null?'':'0%',0]);}download('resumen-rechazos-a-b.csv',rows);};
$('exportReview').onclick=()=>{if(!model)return;download('revision-rechazos-seleccion-a.csv',[['FOLIO','MES','REGION','DETERMINANTE','ESTATUS_BPI','ESTATUS_RECORDS','ESTATUS_AGENCIA','MOTIVO_AGENCIA','CORTE','ALERTAS'],...views.a.review.map(r=>[r.folio,r.month,r.region,r.det,r.status,r.records,r.agency,r.agencyReason,r.cutText,r.flags.join('; ')])]);};
for(const id of ['scope','aMonth','aRegion','aDet','bMonth','bRegion','bDet'])$(id).onchange=render;
const coreScript=document.createElement('script');coreScript.src='core.js';coreScript.onload=()=>{if(model)render();};coreScript.onerror=()=>fail('No se pudo cargar el motor de análisis.');document.head.append(coreScript);
