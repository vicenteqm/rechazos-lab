'use strict';
importScripts('vendor/xlsx.full.min.js','core.js?v=20261022-filtros');
const books=new Map();
self.onmessage=async({data})=>{
  const {id,type}=data;
  try{
    if(type==='load'){
      const {file,role}=data;
      let input=await file.arrayBuffer();
      if(file.name.toLowerCase().endsWith('.csv')){
        try{input=new TextDecoder('utf-8',{fatal:true}).decode(input);}catch{input=new TextDecoder('windows-1252').decode(input);}
      }
      const wb=XLSX.read(input,{type:typeof input==='string'?'string':'array',cellDates:false,raw:true});
      if(wb.Workbook?.WBProps?.date1904)throw Error(`${file.name}: este libro usa el calendario Excel 1904. Convierte sus fechas al calendario 1900 antes de cargarlo.`);
      const sheets=wb.SheetNames.map(name=>{
        const table=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:true,blankrows:false});
        const headerRow=table.findIndex(row=>row.some(v=>['FOLIO','FOLIO FICO'].includes(RechazosCore.norm(v))));
        const index=headerRow<0?0:headerRow;
        const headers=(table[index]||[]).map(v=>String(v??'').trim());
        const map=RechazosCore.mapping(role,headers);
        return {name,headers,headerRow:index,count:Math.max(0,table.length-index-1),map,score:RechazosCore.required[role].filter(f=>map[f]).length};
      });
      books.set(id,{wb,name:file.name,role,sheets});
      self.postMessage({id,type:'loaded',name:file.name,role,sheets});
    }else if(type==='build'){
      const docs=data.docs.map(d=>{
        const book=books.get(d.id);if(!book)throw Error('Vuelve a cargar los archivos.');
        const sheet=book.sheets.find(s=>s.name===d.sheet);
        const table=XLSX.utils.sheet_to_json(book.wb.Sheets[d.sheet],{header:1,defval:'',raw:true,blankrows:false});
        const headers=sheet.headers;
        if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error(`${book.name}: la hoja contiene encabezados repetidos. Corrige la hoja o elige otra.`);
        return {...d,name:book.name,role:book.role,rows:table.slice(sheet.headerRow+1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])))};
      });
      const result=RechazosCore.build(docs);self.postMessage({id,type:'result',result});
    }else if(type==='remove')books.delete(data.fileId);
  }catch(error){self.postMessage({id,type:'error',error:error.message});}
};
