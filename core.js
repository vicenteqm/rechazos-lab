(function(root){
  'use strict';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
  const key=v=>String(v??'').trim().replace(/^'/,'').replace(/\.0+$/,'');
  const valid=v=>/^\d+$/.test(key(v));
  const monthNames=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  function date(v){
    if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
    if(typeof v==='number'||/^\d{5}(\.\d+)?$/.test(String(v??''))){const n=Number(v);if(n>20000&&n<100000)return new Date(Date.UTC(1899,11,30)+Math.floor(n)*86400000).toISOString().slice(0,10);}
    const s=String(v??'').trim();let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(!m){const d=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);if(d)m=[d[0],d[3],d[2],d[1]];}
    if(!m)return '';const y=+m[1],mo=+m[2],day=+m[3],d=new Date(Date.UTC(y,mo-1,day));
    return d.getUTCFullYear()===y&&d.getUTCMonth()===mo-1&&d.getUTCDate()===day?`${y}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';
  }
  function cut(v,year){
    const direct=date(v);if(direct)return direct;
    const s=norm(v).replace(/SEPTEIMBRE/g,'SEPTIEMBRE');
    const m=s.match(/(?:^|[ _-])(\d{1,2})[ _-]+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)/);
    if(!m||!year)return '';const y=s.match(/(?:^|\D)(20\d{2})(?:\D|$)/)?.[1]||year;
    return date(`${y}-${monthNames.indexOf(m[2])+1}-${m[1]}`);
  }
  const aliases={
    bpi:{folio:['FOLIO','FOLIO FICO'],created:['FECHA DE CREACION','F. CREACION'],region:['REGION'],det:['DETERMINANTE','DETE'],status:['ESTATUS BANCO']},
    records:{folio:['FOLIO FICO','FOLIO'],status:['ESTATUS FICO'],approval:['APROBACION'],process:['ESTATUS DEL PROCESO'],created:['F. CREACION','FECHA DE CREACION']},
    agency:{folio:['FOLIO','FOLIO FICO'],reason:['ESTATUS_P','RAZON AGRUPADA','MOTIVO DE RECHAZO'],status:['ESTATUS'],fico:['ESTATUS_FICO'],cut:['ARCHIVO_ULTIMO_CORTE','FECHA DE CORTE']}
  };
  const required={bpi:['folio','created','region','det','status'],records:['folio','status'],agency:['folio','reason']};
  function mapping(role,headers){return Object.fromEntries(Object.entries(aliases[role]).map(([field,names])=>[field,headers.find(h=>names.includes(norm(h)))||'']));}
  function reason(value){const s=norm(value);return ({'RECHAZO POR NIVEL DE RIESGO':'NIVEL DE RIESGO','NIVEL RIESGO':'NIVEL DE RIESGO','RECHAZO POR GRUPO DE MATRICES':'GRUPO DE MATRICES','LIMITE DE CREDITO MENOR A PRODUCTO':'LÍMITE DE CRÉDITO','RECHAZO POR SCORE':'SCORE','FUERA ZONA':'FUERA DE ZONA','ANTIGUEDAD TDC':'ANTIGÜEDAD TDC','MAXIMA LDC':'MÁXIMA LDC','LINEA MINIMA':'LÍNEA MÍNIMA','UTILIZACION':'UTILIZACIÓN'})[s]||s;}
  function mapped(docs,role){const rows=[];for(const doc of docs.filter(d=>d.role===role)){for(const field of required[role])if(!doc.map[field])throw Error(`${doc.name}: falta asignar la columna ${field}.`);for(const source of doc.rows){const out={source:doc.name};for(const [field,column]of Object.entries(doc.map))out[field]=source[column]??'';rows.push(out);}}return rows;}
  function build(docs){
    for(const role of ['bpi','records','agency'])if(!docs.some(d=>d.role===role))throw Error('Carga al menos un archivo de cada fuente.');
    const report={invalidBpi:0,invalidRecords:0,invalidAgency:0,duplicateBpi:0,duplicateRecords:0,duplicateAgency:0,recordsConflicts:0,agencyConflicts:0};
    const bm=new Map(),rm=new Map(),am=new Map();
    for(const r of mapped(docs,'bpi')){
      if(!valid(r.folio)){report.invalidBpi++;continue;}
      const id=key(r.folio),created=date(r.created);if(!created)throw Error(`${r.source}: hay un folio numérico con fecha de creación vacía o no reconocida. Revisa la columna de fecha; se acepta ISO, día/mes/año o fecha Excel.`);
      const b={folio:id,created,month:created.slice(0,7),region:key(r.region)||'Sin dato',det:key(r.det)||'Sin dato',status:norm(r.status)||'SIN ESTATUS'};
      if(bm.has(id)){report.duplicateBpi++;if(JSON.stringify(bm.get(id))!==JSON.stringify(b))throw Error(`El folio ${id} tiene datos BPI distintos entre archivos. Carga un solo corte por folio o concilia sus datos antes de continuar.`);}else bm.set(id,b);
    }
    if(!bm.size)throw Error('No hay folios BPI válidos para analizar.');
    const years=[...new Set([...bm.values()].map(r=>r.month.slice(0,4)))];const defaultYear=years.length===1?years[0]:'';
    for(const r of mapped(docs,'records')){
      if(!valid(r.folio)){report.invalidRecords++;continue;}
      const id=key(r.folio);if(!rm.has(id))rm.set(id,new Map());else report.duplicateRecords++;
      const s={status:norm(r.status),approval:norm(r.approval),process:norm(r.process)};rm.get(id).set(JSON.stringify(s),s);
    }
    for(const r of mapped(docs,'agency')){
      if(!valid(r.folio)){report.invalidAgency++;continue;}
      const id=key(r.folio);if(!am.has(id))am.set(id,[]);else report.duplicateAgency++;
      am.get(id).push({reason:reason(r.reason),rawReason:String(r.reason??''),source:r.source,status:norm(r.status),fico:norm(r.fico),cut:cut(r.cut,defaultYear),cutText:String(r.cut||r.source)});
    }
    const rows=[];
    for(const b of bm.values()){
      const rec=[...(rm.get(b.folio)?.values()||[])],ag=am.get(b.folio)||[];
      let candidates=ag;
      if(ag.length>1&&ag.every(a=>a.cut)){const latest=ag.reduce((m,a)=>a.cut>m?a.cut:m,'');candidates=ag.filter(a=>a.cut===latest);}
      const sigs=new Set(candidates.map(a=>JSON.stringify([a.reason,a.status,a.fico])));const agencyConflict=sigs.size>1;
      const a=candidates[0];const flags=[];let grouped='';
      if(!ag.length){grouped='SIN COINCIDENCIA EN AGENCIA';flags.push('Sin coincidencia en agencia');}
      else if(agencyConflict){grouped='CONFLICTO ENTRE CORTES';flags.push('Agencia con estatus o motivos distintos sin corte único');report.agencyConflicts++;}
      else if(!a.reason){grouped='SIN MOTIVO EN AGENCIA';flags.push('Motivo vacío en agencia');}
      else if(['APROBADO','APROBADA','APROBADO FRANJA','APROBADO/CANCELADO','APROBADA/CANCELADO'].includes(a.reason)){grouped='ESTATUS DIFERENTE EN AGENCIA';flags.push('Agencia reporta aprobación o aprobación/cancelación');}
      else if(a.reason==='EN PROCESO'){grouped='EN PROCESO EN AGENCIA';flags.push('Agencia en proceso');}
      else grouped=a.reason;
      if(!rec.length)flags.push('Sin coincidencia en records');
      if(rec.length>1){flags.push('Records con estatus distintos');report.recordsConflicts++;}
      rows.push({...b,reason:grouped,hasAgency:!!ag.length,hasRecords:!!rec.length,records:rec.map(r=>r.status||'Sin estatus').join(' | '),agency:a?.status||'',agencyReason:agencyConflict?'CONFLICTO':a?.reason||'',agencyRawReason:agencyConflict?'':a?.rawReason||'',agencySources:[...new Set(candidates.map(a=>a.source))],cut:a?.cut||'',cutText:a?.cutText||'',flags,
        reject:b.status.startsWith('RECHAZO'),cancel:b.status.startsWith('CANCELADA')||b.status.startsWith('CANCELADO')});
    }
    return {rows,report,files:docs.map(d=>({name:d.name,role:d.role,sheet:d.sheet,rows:d.rows.length})),months:[...new Set(rows.map(r=>r.month))].sort()};
  }
  function select(rows,filters={},scope='rejects'){
    const base=rows.filter(r=>(!filters.month||r.month===filters.month)&&(!filters.region||r.region===filters.region)&&(!filters.det||r.det===filters.det));
    const cases=base.filter(r=>r.reject||(scope==='rejects-cancelled'&&r.cancel));
    const counts=new Map();cases.forEach(r=>counts.set(r.reason,(counts.get(r.reason)||0)+1));
    const reasons=[...counts].map(([reason,count])=>({reason,count,share:cases.length?count/cases.length:0})).sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason));
    return {base,cases,reasons,total:cases.length,rate:base.length?cases.length/base.length:null,review:cases.filter(r=>r.flags.length),agency:cases.filter(r=>r.hasAgency).length,records:cases.filter(r=>r.hasRecords).length};
  }
  const api={norm,key,date,cut,aliases,required,mapping,reason,build,select};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RechazosCore=api;
})(typeof self!=='undefined'?self:globalThis);
