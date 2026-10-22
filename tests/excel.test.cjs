const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const F=require('../vendor/fflate.js'),E=require('../excel-export.js'),C=require('../core.js');
const doc=(role,rows)=>({role,name:role+'.xlsx',sheet:'Datos',map:Object.fromEntries(Object.keys(C.aliases[role]).map(k=>[k,k])),rows});
const b=[{folio:'1001',created:'2026-09-01',region:'1',det:'6206',status:'RECHAZO'},{folio:'1002',created:'2026-09-02',region:'1',det:'6206',status:'COMPLETO'},{folio:'1003',created:'2026-10-02',region:'2',det:'6242',status:'RECHAZO PF'},{folio:'1004',created:'2026-10-03',region:'2',det:'6242',status:'CANCELADA AP'}];
const r=b.map(x=>({folio:x.folio,status:'Declinado',approval:'Rechazada',process:'Solicitud rechazada'}));
const a=b.map((x,i)=>({folio:x.folio,reason:i===0?'Rechazo por Nivel de Riesgo':i===2?'Sin TDC':'Edad',status:'Rechazada',cut:'AGENCIA_20_OCTUBRE_2026.xlsx'}));
const model=C.build([doc('bpi',b),doc('records',r),doc('agency',a)]);
const template=fs.readFileSync(path.join(__dirname,'../assets/export-template.xlsx'));
const options={scope:'rejects',target:'all',a:{month:'2026-09'},b:{month:'2026-10'},generated:'2026-10-22T06:00:00Z'};
const out=path.join(__dirname,'../../outputs/rechazos_excel');fs.mkdirSync(out,{recursive:true});
for(const [name,m,o]of [['prueba',model,options],['seleccion_a',model,{...options,target:'a'}],['sin_casos',{...model,rows:model.rows.map(x=>({...x,reject:false,cancel:false}))},options]]){
 const bytes=E.build(template,m,o,F),z=F.unzipSync(bytes),text=p=>new TextDecoder().decode(z[p]);
 assert.equal(Object.keys(z).filter(x=>/^xl\/pivotTables\/pivotTable\d+\.xml$/.test(x)).length,6);
 assert.match(text('xl/workbook.xml'),/<pivotCaches\b/);
 assert.match(text('xl/tables/table1.xml'),/name="CruceSolicitudes"/);
 assert.match(text('xl/pivotCache/pivotCacheDefinition1.xml'),/worksheetSource name="CruceSolicitudes"/);
 assert.match(text('xl/pivotTables/pivotTable1.xml'),/pageField fld="13" item="\d+"/);
 assert.match(text('xl/pivotTables/pivotTable1.xml'),/sortType="descending"/);
 assert.match(text('xl/pivotTables/pivotTable2.xml'),/sortType="ascending"/);
 fs.writeFileSync(path.join(out,name+'.xlsx'),bytes);
}
assert.throws(()=>E.build(template,model,{...options,target:'a',a:{region:'NO_EXISTE'}},F),/no tiene solicitudes/);
console.log('PASS: seis tablas dinámicas, caché, tabla de cruce, selección A y caso sin rechazos.');

const stores={...model,rows:model.rows.map((r,i)=>({...r,store:i===0?'NORTE':'SUR'}))};
const filtered=F.unzipSync(E.build(template,stores,{...options,target:'a',a:{month:'2026-09',store:'NORTE'}},F));
const cache=new TextDecoder().decode(filtered['xl/pivotCache/pivotCacheRecords1.xml']);
assert.match(cache,/count="1"/);
const source=new TextDecoder().decode(filtered['xl/worksheets/sheet8.xml']);
assert.match(source,/TIENDA/);assert.match(source,/NORTE/);assert.doesNotMatch(source,/>SUR</);
console.log('PASS: Excel respeta el mes y la tienda seleccionados.');
