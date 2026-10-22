const assert=require('node:assert/strict');
const C=require('../core.js');
const doc=(role,rows)=>({role,name:role,sheet:'Datos',map:Object.fromEntries(Object.keys(C.aliases[role]).map(k=>[k,k])),rows});
const base=[{folio:'1001',created:'2026-09-01',region:'1',det:'6206',status:'RECHAZO'},
{folio:'1002',created:'2026-09-02',region:'1',det:'6206',status:'COMPLETO'},
{folio:'1003',created:'2026-10-02',region:'2',det:'6242',status:'RECHAZO PF'},
{folio:'1004',created:'2026-10-02',region:'2',det:'6242',status:'CANCELADA AP'}];
const rec=base.map(b=>({folio:b.folio,status:'Declinado',approval:'Rechazada',process:'Solicitud rechazada'}));
const agency=base.map(b=>({folio:b.folio,reason:'Rechazo por Nivel de Riesgo',status:'Rechazada',cut:'AGENCIA_20_OCTUBRE.xlsx'}));
const build=(b=base,r=rec,a=agency)=>C.build([doc('bpi',b),doc('records',r),doc('agency',a)]);
assert.equal(C.date(46266),'2026-09-01');
assert.equal(C.date('30/09/2026'),'2026-09-30');
assert.equal(C.date('31/09/2026'),'');
assert.equal(C.key("'1001.0"),'1001');
assert.equal(C.cut('AGENCIA_17_SEPTEIMBRE.xlsx','2026'),'2026-09-17');
assert.equal(C.cut('AGENCIA_20_OCTUBRE_2025.xlsx','2026'),'2025-10-20');
const model=build();let s=C.select(model.rows,{month:'2026-09'});
assert.equal(s.base.length,2);assert.equal(s.total,1);assert.equal(s.rate,.5);assert.equal(s.reasons[0].share,1);
assert.equal(C.select(model.rows,{region:'2'},'rejects-cancelled').total,2);
assert.equal(C.select(model.rows,{region:'NO_EXISTE'}).rate,null);
assert.equal(build([...base,base[0]]).rows.length,4);
assert.throws(()=>build([...base,{...base[0],status:'COMPLETO'}]),/datos BPI distintos/);
assert.throws(()=>build([{...base[0],created:'no fecha'}]),/fecha/);
let m=build(base,[...rec,{...rec[0],status:'Completado'}]);
assert.equal(m.rows[0].flags.includes('Records con estatus distintos'),true);
m=build(base,rec,[...agency,{...agency[0],reason:'Sin TDC',cut:'AGENCIA_21_OCTUBRE.xlsx'}]);
assert.equal(m.rows[0].reason,'SIN TDC');
m=build(base,rec,[...agency,{...agency[0],reason:'Sin TDC'}]);
assert.equal(m.rows[0].reason,'CONFLICTO ENTRE CORTES');
m=build(base,rec,[...agency,{...agency[0],reason:'Sin TDC',cut:''}]);
assert.equal(m.rows[0].reason,'CONFLICTO ENTRE CORTES');
m=build(base,rec,agency.filter(a=>a.folio!=='1001'));
assert.equal(m.rows[0].reason,'SIN COINCIDENCIA EN AGENCIA');
m=build(base,rec,agency.map(a=>({...a,reason:'Aprobado'})));
assert.equal(m.rows[0].reason,'ESTATUS DIFERENTE EN AGENCIA');
m=build(base,[...rec,{folio:'N/A',status:'Incompleto'}]);assert.equal(m.report.invalidRecords,1);
assert.equal(m.rows.length,4);
console.log('PASS: fechas, llaves, tasas, filtros, canceladas, motivos, duplicados y conflictos.');
