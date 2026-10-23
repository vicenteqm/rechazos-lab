'use strict';
importScripts('core.js?v=20261023-busqueda','vendor/fflate.js','excel-export.js?v=20261023-busqueda');
self.onmessage=async({data})=>{try{const response=await fetch('assets/export-template.xlsx');if(!response.ok)throw Error('No se pudo cargar la plantilla Excel.');const bytes=RechazosExcel.build(new Uint8Array(await response.arrayBuffer()),data.model,data.options);self.postMessage({ok:true,bytes},[bytes.buffer]);}catch(e){self.postMessage({ok:false,error:e.message});}};
