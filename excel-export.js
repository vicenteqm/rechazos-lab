(function(root){
'use strict';
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships',PKG='http://schemas.openxmlformats.org/package/2006/relationships';
const enc=new TextEncoder(),dec=new TextDecoder();
const xml=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const columns=['FOLIO','FECHA_CREACION','MES','REGION','DETERMINANTE','ESTATUS_BPI','ESTATUS_RECORDS','ESTATUS_AGENCIA','MOTIVO_AGRUPADO','MOTIVO_ORIGINAL_AGENCIA','ARCHIVOS_AGENCIA','CORTE_AGENCIA','ALERTAS','INCLUIR','CASOS','SOLICITUDES','REVISION','VISTA_FILTRADA','TIENDA','ARCHIVO_CORTE_AGENCIA','COINCIDE_AGENCIA','COINCIDE_RECORDS'];
const numeric=new Set([1,14,15,16]);
function letter(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function fits(r,f={}){return(!f.month||r.month===f.month)&&(!f.region||r.region===f.region)&&(!f.store||r.store===f.store)&&(!f.det||r.det===f.det);}
function group(rows,key,asc=false){const map=new Map();for(const row of rows)map.set(String(row[key]??''),(map.get(String(row[key]??''))||0)+1);return [...map].sort((a,b)=>(asc?a[1]-b[1]:b[1]-a[1])||a[0].localeCompare(b[0],'es',{numeric:true}));}
function build(template,model,options={},F=root.fflate){
 if(!F)throw Error('No se cargó la biblioteca de exportación Excel.');
 const filters=options.target==='a'?options.a:options.target==='b'?options.b:{};
 const base=model.rows.filter(r=>fits(r,filters));
 if(!base.length)throw Error('La selección no tiene solicitudes BPI. Elige todo el cruce u otros filtros.');
 if(base.length>1048575)throw Error('El cruce supera el límite de filas de una hoja Excel. Exporta por mes o región.');
 const isCase=r=>r.reject||(options.scope==='rejects-cancelled'&&r.cancel),cases=base.filter(isCase),desc=group(cases,'reason'),asc=group(cases,'reason',true);
 const data=base.map(r=>[r.folio,Math.round((Date.parse(r.created+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000),r.month,r.region,r.det,r.status,r.records,r.agency,isCase(r)?r.reason:'FUERA DE ALCANCE',r.agencyRawReason||'',(r.agencySources||[]).join(' | '),r.cut||'',isCase(r)?r.flags.join('; '):'',isCase(r)?'Sí':'No',isCase(r)?1:0,1,isCase(r)&&r.flags.length?1:0,fits(r,options.a)?'Sí':'No',r.store||'Sin tienda en BPI',r.cutText||'',r.hasAgency?'Sí':'No',r.hasRecords?'Sí':'No']);
 for(const row of data)for(const value of row)if(typeof value==='string'&&value.length>32767)throw Error('Hay un texto que supera el límite de celda de Excel. Reduce los archivos incluidos en esta exportación.');
 const zip=F.unzipSync(template instanceof Uint8Array?template:new Uint8Array(template)),get=p=>dec.decode(zip[p]),put=(p,s)=>zip[p]=enc.encode(s);
 const original=get('xl/worksheets/sheet1.xml');
 function style(ref){const tag=original.match(new RegExp('<(?:\\w+:)?c\\b[^>]*\\br="'+ref+'"[^>]*>'))?.[0];return tag?.match(/\bs="(\d+)"/)?.[1]||'0';}
 const st={title:style('B2'),note:style('B4'),header:style('B6'),pivotHeader:style('B7'),body:style('B8'),int:style('C7'),pct:style('D7'),total:style('B9'),totalInt:style('C9'),date:style('B11')};
 function cell(ref,value,s=st.body,formula){
  if(formula)return `<c r="${ref}" s="${s}"><f>${xml(formula)}</f><v>${Number(value)||0}</v></c>`;
  if(typeof value==='number')return `<c r="${ref}" s="${s}"><v>${Number.isFinite(value)?value:0}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
 }
 const row=(n,cells,height=23)=>`<row r="${n}" ht="${height}" customHeight="1">${cells.join('')}</row>`;
 function sheet(rows,widths,freeze=0,extra=''){
  const view=freeze?`<pane ySplit="${freeze}" topLeftCell="A${freeze+1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freeze+1}" sqref="A${freeze+1}"/>`:'<selection activeCell="B2" sqref="B2"/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetViews><sheetView showGridLines="0" workbookViewId="0">${view}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="23"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>${extra}</worksheet>`;
 }
 const range=`A1:V${data.length+1}`,last=data.length+1;
 const dataRows=[row(1,columns.map((h,i)=>cell(letter(i)+'1',h,st.header)),31),...data.map((values,i)=>row(i+2,values.map((v,j)=>cell(letter(j)+(i+2),v,j===1?st.date:numeric.has(j)?st.int:st.body))))];
 put('xl/worksheets/sheet8.xml',sheet(dataRows,[15,17,13,12,16,22,30,25,38,42,64,18,64,12,12,15,13,16,16,60,21,21],1,'<tableParts count="1"><tablePart r:id="rIdCruceTable"/></tableParts>'));
 put('xl/worksheets/_rels/sheet8.xml.rels',`<Relationships xmlns="${PKG}"><Relationship Id="rIdCruceTable" Type="${REL}/table" Target="../tables/table1.xml"/></Relationships>`);
 put('xl/tables/table1.xml',`<?xml version="1.0" encoding="UTF-8"?><table xmlns="${NS}" id="1" name="CruceSolicitudes" displayName="CruceSolicitudes" ref="${range}" totalsRowShown="0"><autoFilter ref="${range}"/><tableColumns count="${columns.length}">${columns.map((h,i)=>`<tableColumn id="${i+1}" name="${xml(h)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium9" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`);
 const sum=(col)=>`SUM(Cruce!${col}2:${col}${last})`;
 const target=options.target==='a'?'Vista mensual filtrada':options.target==='b'?'Selección B':'Todo el cruce cargado',scope=options.scope==='rejects-cancelled'?'Rechazos y canceladas BPI':'Rechazos BPI (incluye PF y CE)';
 const months=[...new Set(base.map(r=>r.month))].sort(),review=cases.filter(r=>r.flags.length).length;
 const summary=[row(2,[cell('B2','Rechazos Lab',st.title)]),row(4,[cell('B4',`${target}. Periodos: ${months.join(', ')}.`,st.note)]),row(5,[cell('B5',scope,st.note)]),row(7,[cell('B7','Solicitudes BPI exportadas'),cell('C7',base.length,st.int,sum('P'))]),row(8,[cell('B8','Casos incluidos'),cell('C8',cases.length,st.int,sum('O'))]),row(9,[cell('B9','Tasa sobre solicitudes BPI',st.total),cell('C9',cases.length/base.length,st.pct,'IF(C7=0,0,C8/C7)')]),row(10,[cell('B10','Casos para revisión'),cell('C10',review,st.int,sum('Q'))]),row(12,[cell('B12','Tablas dinámicas: TD_Mayor, TD_Menor, TD_Regiones, TD_Determinantes, TD_Meses y TD_Estatus.',st.note)]),row(13,[cell('B13','Datos fuente en Cruce. El filtro INCLUIR = Sí identifica los casos del alcance seleccionado.',st.note)]),row(15,[cell('B15','MAYOR FRECUENCIA',st.header),cell('C15','Casos',st.header),cell('D15','% casos',st.header),cell('F15','MENOR FRECUENCIA',st.header),cell('G15','Casos',st.header),cell('H15','% casos',st.header)],28)];
 for(let i=0;i<Math.min(10,desc.length);i++){
  const n=i+16,more=desc[i],less=asc[i];
  const formula=(col)=>`COUNTIFS(Cruce!$N$2:$N$${last},"Sí",Cruce!$I$2:$I$${last},${col}${n})`;
  summary.push(row(n,[cell('B'+n,more[0]),cell('C'+n,more[1],st.int,formula('B')),cell('D'+n,more[1]/cases.length,st.pct,`IF($C$8=0,0,C${n}/$C$8)`),cell('F'+n,less[0]),cell('G'+n,less[1],st.int,formula('F')),cell('H'+n,less[1]/cases.length,st.pct,`IF($C$8=0,0,G${n}/$C$8)`)]));
 }
 if(!cases.length)summary.push(row(16,[cell('B16','Sin casos en el alcance seleccionado.'),cell('F16','Sin casos en el alcance seleccionado.')]));
 summary.push(row(28,[cell('B28','Rankings: hasta 10 causas con casos. Las tablas dinámicas incluyen todas las categorías.',st.note)]),row(29,[cell('B29','Después de editar Cruce: Datos > Actualizar todo. Para regenerar el orden del resumen, vuelve a exportar.',st.note)]));
 put('xl/worksheets/sheet1.xml',sheet(summary,[3,45,15,15,4,45,15,15]));
 const unique=columns.map((_,j)=>numeric.has(j)?null:[]),indices=columns.map(()=>new Map());
 // Conserva Sí incluso en una selección sin casos para poder mantener el filtro de la tabla dinámica.
 unique[13].push('Sí');indices[13].set('Sí',0);
 for(const values of data)values.forEach((v,j)=>{if(unique[j]&&!indices[j].has(v)){indices[j].set(v,unique[j].length);unique[j].push(v);}});
 const cacheFields=columns.map((h,j)=>`<cacheField name="${xml(h)}"${j===1?' numFmtId="14"':''}>${numeric.has(j)?'<sharedItems containsSemiMixedTypes="0" containsString="0" containsNumber="1" containsInteger="1"/>':`<sharedItems count="${unique[j].length}">${unique[j].map(v=>`<s v="${xml(v)}"/>`).join('')}</sharedItems>`}</cacheField>`).join('');
 put('xl/pivotCache/pivotCacheDefinition1.xml',`<?xml version="1.0" encoding="UTF-8"?><pivotCacheDefinition xmlns="${NS}" xmlns:r="${REL}" r:id="rIdRecords" refreshedBy="Rechazos Lab" createdVersion="6" refreshedVersion="6" minRefreshableVersion="3" recordCount="${data.length}" saveData="1" enableRefresh="1" refreshOnLoad="0"><cacheSource type="worksheet"><worksheetSource name="CruceSolicitudes"/></cacheSource><cacheFields count="${columns.length}">${cacheFields}</cacheFields></pivotCacheDefinition>`);
 put('xl/pivotCache/pivotCacheRecords1.xml',`<?xml version="1.0" encoding="UTF-8"?><pivotCacheRecords xmlns="${NS}" count="${data.length}">${data.map(values=>'<r>'+values.map((v,j)=>numeric.has(j)?`<n v="${v}"/>`:`<x v="${indices[j].get(v)}"/>`).join('')+'</r>').join('')}</pivotCacheRecords>`);
 put('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels',`<Relationships xmlns="${PKG}"><Relationship Id="rIdRecords" Type="${REL}/pivotCacheRecords" Target="pivotCacheRecords1.xml"/></Relationships>`);
 const pivots=[['TD_Mayor','Causas de mayor a menor',8,desc,'descending'],['TD_Menor','Causas de menor a mayor',8,asc,'ascending'],['TD_Regiones','Casos por región',3,group(cases,'region'),'descending'],['TD_Determinantes','Casos por determinante',4,group(cases,'det'),'descending'],['TD_Meses','Casos por mes',2,group(cases,'month').sort((a,b)=>a[0].localeCompare(b[0])),'ascending'],['TD_Estatus','Casos por estatus BPI',5,group(cases,'status'),'descending']];
 let types=get('[Content_Types].xml');const override=(part,type)=>{if(!types.includes(`PartName="/${part}"`))types=types.replace('</Types>',`<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${type}+xml"/></Types>`);};
 for(let p=0;p<pivots.length;p++){
  const [name,title,field,items,sort]=pivots[p],id=p+1,sheetId=p+2,end=7+items.length;
  const out=[row(2,[cell('B2',title,st.title)]),row(4,[cell('B4','INCLUIR'),cell('C4','Sí')]),row(6,[cell('B6',columns[field],st.pivotHeader),cell('C6','Total casos',st.pivotHeader)],28),...items.map(([label,n],i)=>row(i+7,[cell('B'+(i+7),label),cell('C'+(i+7),n,st.int)])),row(end,[cell('B'+end,'Total general',st.total),cell('C'+end,cases.length,st.totalInt)])];
  put(`xl/worksheets/sheet${sheetId}.xml`,sheet(out,[3,55,18],6));
  put(`xl/worksheets/_rels/sheet${sheetId}.xml.rels`,`<Relationships xmlns="${PKG}"><Relationship Id="rIdPivot" Type="${REL}/pivotTable" Target="../pivotTables/pivotTable${id}.xml"/></Relationships>`);
  const axisOrder=unique[field].map((_,i)=>i).sort((a,b)=>unique[field][a].localeCompare(unique[field][b],'es',{numeric:true}));
  const pageOrder=unique[13].map((_,i)=>i).sort((a,b)=>unique[13][a].localeCompare(unique[13][b],'es'));
  const selectedPage=pageOrder.indexOf(0);
  const pivotFields=columns.map((_,j)=>{
   if(j===field)return `<pivotField axis="axisRow" showAll="0" sortType="${sort}"><items count="${axisOrder.length+1}">${axisOrder.map(i=>`<item x="${i}"/>`).join('')}<item t="default"/></items>${field===2?'':`<autoSortScope><pivotArea dataOnly="0" outline="0" fieldPosition="0"><references count="1"><reference field="4294967294" count="1" selected="0"><x v="0"/></reference></references></pivotArea></autoSortScope>`}</pivotField>`;
   if(j===13)return `<pivotField axis="axisPage" showAll="0"><items count="${pageOrder.length+1}">${pageOrder.map(i=>`<item x="${i}"/>`).join('')}<item t="default"/></items></pivotField>`;
   return `<pivotField${j===14?' dataField="1" numFmtId="3"':j===1?' numFmtId="14"':''} showAll="0"/>`;
  }).join('');
  put(`xl/pivotTables/pivotTable${id}.xml`,`<?xml version="1.0" encoding="UTF-8"?><pivotTableDefinition xmlns="${NS}" name="${name}" cacheId="1" applyNumberFormats="0" applyBorderFormats="0" applyFontFormats="0" applyPatternFormats="0" applyAlignmentFormats="0" applyWidthHeightFormats="1" dataCaption="Valores" updatedVersion="8" minRefreshableVersion="3" useAutoFormatting="1" itemPrintTitles="1" createdVersion="6" indent="0" outline="1" outlineData="1" multipleFieldFilters="0"><location ref="B6:C${end}" firstHeaderRow="1" firstDataRow="1" firstDataCol="1" rowPageCount="1" colPageCount="1"/><pivotFields count="${columns.length}">${pivotFields}</pivotFields><rowFields count="1"><field x="${field}"/></rowFields><rowItems count="${items.length+1}">${items.map(([label])=>`<i><x v="${axisOrder.indexOf(indices[field].get(label))}"/></i>`).join('')}<i t="grand"><x/></i></rowItems><colItems count="1"><i/></colItems><pageFields count="1"><pageField fld="13" item="${selectedPage}" hier="-1"/></pageFields><dataFields count="1"><dataField name="Total casos" fld="14" baseField="0" baseItem="0" numFmtId="3"/></dataFields><pivotTableStyleInfo name="PivotStyleLight16" showRowHeaders="1" showColHeaders="1" showRowStripes="0" showColStripes="0" showLastColumn="1"/></pivotTableDefinition>`);
  put(`xl/pivotTables/_rels/pivotTable${id}.xml.rels`,`<Relationships xmlns="${PKG}"><Relationship Id="rIdCache" Type="${REL}/pivotCacheDefinition" Target="../pivotCache/pivotCacheDefinition1.xml"/></Relationships>`);
  override(`xl/pivotTables/pivotTable${id}.xml`,'pivotTable');
 }
 override('xl/pivotCache/pivotCacheDefinition1.xml','pivotCacheDefinition');override('xl/pivotCache/pivotCacheRecords1.xml','pivotCacheRecords');override('xl/tables/table1.xml','table');put('[Content_Types].xml',types);
 let workbook=get('xl/workbook.xml');workbook=workbook.replace(/<\/(?:\w+:)?workbook>/,closing=>`<calcPr xmlns="${NS}" calcId="191029" fullCalcOnLoad="1"/><pivotCaches xmlns="${NS}" xmlns:r="${REL}"><pivotCache cacheId="1" r:id="rIdRechazosCache"/></pivotCaches>`+closing);put('xl/workbook.xml',workbook);
 put('xl/_rels/workbook.xml.rels',get('xl/_rels/workbook.xml.rels').replace('</Relationships>',`<Relationship Id="rIdRechazosCache" Type="${REL}/pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/></Relationships>`));
 const guide=[['Contenido','Cruce: todas las solicitudes BPI de la exportación. INCLUIR identifica los casos según el alcance.'],['Alcance',scope],['Exportación',target],['Periodos',months.join(', ')],['Mes y filtros',(options.a?.month||'Todos los meses')+' / Región: '+(options.a?.region||'Todas')+' / Tienda: '+(options.a?.store||'Todas')+' / Determinante: '+(options.a?.det||'Todos')],['Generado',options.generated||new Date().toISOString()],['Tablas dinámicas','Seis tablas nativas de Excel, con caché y datos fuente en la tabla CruceSolicitudes.'],['Actualizar','En Excel: Datos > Actualizar todo. En una tabla dinámica puedes cambiar filas, valores y filtros desde la lista de campos.'],['Filtro INCLUIR','Sí = caso incluido. No = otra solicitud BPI. Mantén Sí para reproducir el tablero.'],['Cambiar alcance','Para incluir o excluir canceladas, selecciona el alcance en el tablero y vuelve a exportar.'],['Mayor y menor','Las tablas dinámicas usan todos los motivos con casos; Resumen muestra hasta diez por extremo. Los empates se ordenan por etiqueta al exportar.'],['Recalcular resumen','Las fórmulas cuentan desde Cruce. Si modificas los datos, actualiza las tablas dinámicas y vuelve a ordenar o exportar el ranking del resumen.'],['Causas','BPI define el universo y estatus banco; agencia aporta Estatus_P; records contrasta el proceso.'],['Corte','La cohorte se basa en fecha de creación BPI. Agencia usa el último corte cargado y puede incluir actualizaciones posteriores al mes.'],['Región y determinante','Provienen de BPI; no se infieren desde records ni agencia.'],['Revisión','Un caso cuenta una sola vez aunque tenga varias alertas. Se conservan discrepancias y motivos faltantes.'],['Privacidad','Incluye folios y estatus para rastrear casos. No incluye nombres de clientes ni ejecutivos.'],['Filas excluidas',`Sin folio numérico: BPI ${model.report.invalidBpi}; records ${model.report.invalidRecords}; agencia ${model.report.invalidAgency}.`],['Repeticiones',`BPI ${model.report.duplicateBpi}; records ${model.report.duplicateRecords}; agencia ${model.report.duplicateAgency}.`],['Fuentes cargadas','Las filas siguientes identifican los archivos y hojas usados para construir el cruce.'],...model.files.map(f=>[f.role,`${f.name} / ${f.sheet} / ${f.rows} filas`])];
 const guideRows=[row(2,[cell('B2','Guía y procedencia',st.title)]),row(4,[cell('B4','Concepto',st.header),cell('C4','Explicación',st.header)],28),...guide.map(([k,v],i)=>row(i+5,[cell('B'+(i+5),k),cell('C'+(i+5),v)]))];
 put('xl/worksheets/sheet9.xml',sheet(guideRows,[3,30,145]));
 // No se conservan rangos usados ni partes de dibujo de la plantilla en hojas reemplazadas.
 return F.zipSync(zip,{level:6});
}
const api={build,columns};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RechazosExcel=api;
})(typeof self!=='undefined'?self:globalThis);
