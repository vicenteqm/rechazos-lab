const fs=require('node:fs'),C=require('../core.js');
try { const docs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const model=C.build(docs);process.stdout.write(JSON.stringify(model)); }
catch(error){console.error(error.message);process.exit(1);}
