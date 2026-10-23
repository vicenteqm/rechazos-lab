const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const file = process.argv[2];
if (!file) throw Error('Indica el HTML exportado que se debe verificar.');
const html = fs.readFileSync(file, 'utf8');
assert.doesNotMatch(html, /<input[^>]+type="file"|<script[^>]+src=|<link\b|@import\b/i);
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
assert.equal(scripts.length, 1);
// Execute the exact exported script with only the DOM nodes shipped in the report.
// No network, worker, file upload or dynamically loaded script API is available.
const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(x => [x[1], {
    value: '', innerHTML: '', textContent: '', hidden: true, options: [],
    replaceChildren() { this.options = []; this.value = ''; },
    add(option) { this.options.push(option); if (this.options.length === 1) this.value = option.value; }
}]));
const events = [];
const context = {
    console, setTimeout, clearTimeout,
    Option: function(text, value) { this.text = text; this.value = value; },
    CustomEvent: function(type, options) { this.type = type; this.detail = options.detail; },
    document: {getElementById: id => nodes.get(id) || null, addEventListener() {}, dispatchEvent: e => events.push(e)}
};
context.window = context; context.self = context;
vm.createContext(context); vm.runInContext(scripts[0][1], context);
const data = context.RechazosShared;
assert.ok(data.model.rows.length);
assert.equal(nodes.get('results').hidden, false);
assert.match(nodes.get('aMetrics').innerHTML, /Solicitudes BPI/);
assert.match(nodes.get('aReasons').innerHTML, /composition|Sin casos/);
let event = events.at(-1);
assert.equal(event.type, 'rechazos:render');
assert.equal(event.detail.options.a.month, data.filters.month);
nodes.get('resetFilters').onclick();
event = events.at(-1);
assert.equal(event.detail.options.a.region, '');
if (nodes.has('aTrainer')) assert.equal(event.detail.options.a.trainer, '');
if (nodes.has('aSearch')) assert.equal(event.detail.options.a.q, '');
if (nodes.has('aFolioSearch')) assert.equal(event.detail.options.a.folioQuery, '');
if (nodes.has('aPersonSearch')) assert.equal(event.detail.options.a.personQuery, '');
assert.equal(event.detail.model.rows.length, data.model.rows.length);
console.log(`PASS: HTML autónomo inicia y renderiza ${data.model.rows.length} folios; filtros activos, sin carga de archivos ni dependencias externas.`);
