// Prueba local opcional. Los archivos originales no se incluyen en GitHub.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const XLSX=require('../vendor/xlsx.full.min.js'),C=require('../core.js');
const dir=process.argv[2];if(!dir)throw Error('Indica la carpeta de los tres archivos originales.');
const sources=[['bpi','BPI_SEPTIEMBRE.xlsx','SEPTIEMBRE'],['records','records_report_20260901_20260930.csv',null],['agency','AGENCIA_BETTER_HOUSE_MODULOS_CONSOLIDADO_SEP_OCT_2026 (1).xlsx','CONSOLIDADO']];
const docs=sources.map(([role,name,sheet])=>{
 let input=fs.readFileSync(path.join(dir,name));
 if(name.endsWith('.csv')){try{input=new TextDecoder('utf-8',{fatal:true}).decode(input);}catch{input=new TextDecoder('windows-1252').decode(input);}}
 const wb=XLSX.read(input,{type:typeof input==='string'?'string':'buffer',raw:true});sheet=sheet||wb.SheetNames[0];
 const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{defval:'',raw:true});
 return {role,name,sheet,rows,map:C.mapping(role,Object.keys(rows[0]))};
});
const m=C.build(docs),s=C.select(m.rows,{month:'2026-09'});
assert.equal(m.rows.length,19618);assert.equal(s.total,14837);assert.equal(s.review.length,424);
assert.equal(s.agency,14836);assert.equal(s.records,14837);
assert.equal(s.reasons.find(r=>r.reason==='SIN TDC').count,4476);
assert.equal(s.reasons.find(r=>r.reason==='NIVEL DE RIESGO').count,4272);
assert.equal(s.reasons.reduce((sum,r)=>sum+r.count,0),s.total);
console.log(JSON.stringify({base:m.rows.length,rechazos:s.total,revision:s.review.length,agencia:s.agency,records:s.records,report:m.report},null,2));
console.log('PASS: los tres archivos reales concilian con el cruce independiente de Python.');
