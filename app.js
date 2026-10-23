
'use strict';

const $ = id => document.getElementById(id);

const esc = v => String(v ?? '').replace(
    /[&<>"']/g,
    c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c])
);

const fmt = n => Number(n || 0).toLocaleString('es-MX');

const pct = n => n == null
    ? '—'
    : (n * 100).toLocaleString('es-MX', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1
    }) + '%';

const fields = {
    folio: 'Folio',
    created: 'Fecha de creación',
    region: 'Región',
    store: 'Tienda (SEDE de BPI)',
    det: 'Determinante',
    status: 'Estatus',
    approval: 'Aprobación',
    process: 'Proceso',
    reason: 'Motivo específico',
    fico: 'Estatus FICO',
    cut: 'Archivo o fecha de corte'
};

const schema = {
    bpi: ['folio', 'created', 'region', 'store', 'det', 'status'],
    records: ['folio', 'status', 'approval', 'process', 'created'],
    agency: ['folio', 'reason', 'status', 'fico', 'cut']
};

const required = {
    bpi: ['folio', 'created', 'region', 'det', 'status'],
    records: ['folio', 'status'],
    agency: ['folio', 'reason']
};

let docs = [];
let model = null;
let views = {};
let seq = 0;
let worker = null;
let pending = 0;
let busy = false;

// LECTOR DE ARCHIVOS

function startWorker() {
    worker = new Worker('worker.js?v=20261022-filtros');

    worker.onmessage = ({data}) => {
        if (data.type === 'loaded') {
            pending = Math.max(0, pending - 1);

            const best = [...data.sheets].sort(
                (a, b) => b.score - a.score || b.count - a.count
            )[0];

            if (!best) {
                fail('No se encontró una hoja válida en ' + data.name);
                buttons();
                return;
            }

            docs.push({
                ...data,
                sheet: best.name,
                map: {...best.map}
            });

            renderFiles(data.role);

            status(
                `${data.name}: ${fmt(best.count)} filas disponibles. ` +
                'Revisa la hoja y las columnas antes de construir.'
            );

        } else if (data.type === 'result') {
            busy = false;
            model = data.result;
            renderModel();

            status(
                `Análisis listo: ${fmt(model.rows.length)} ` +
                'folios BPI únicos. Consulta indicadores, motivos y regiones.'
            );

        } else if (data.type === 'error') {
            if (busy) {
                busy = false;
            } else {
                pending = Math.max(0, pending - 1);
            }

            fail(data.error);
        }

        buttons();
    };

    worker.onerror = () => {
        pending = 0;
        busy = false;

        fail(
            'No fue posible iniciar el lector de archivos. ' +
            'Abre el tablero desde GitHub Pages o un servidor local ' +
            'y verifica que vendor/xlsx.full.min.js esté disponible.'
        );

        buttons();
    };
}

function status(text) {
    $('status').textContent = text;
}

function fail(text) {
    $('error').hidden = false;
    $('error').textContent = text;
    status('Revisa el aviso antes de continuar.');
}

function buttons() {
    const enabled = ['bpi', 'records', 'agency'].every(
        role => docs.some(d => d.role === role)
    );

    $('analyze').disabled = !enabled || !!pending || busy;

    $('analyze').textContent = busy
        ? 'Cruzando archivos…'
        : 'Construir análisis ↗';

    for (const role of ['bpi', 'records', 'agency']) {
        $(role).disabled = busy;
    }

    $('clear').disabled = busy;

    document.querySelectorAll(
        '.file-entry select,.file-entry button'
    ).forEach(el => el.disabled = busy);
}

function invalidate() {
    model = null;
    views = {};

    $('results').hidden = true;
    $('empty').hidden = false;
    $('export').disabled = true;
    $('error').hidden = true;

    document.dispatchEvent(
        new CustomEvent('rechazos:reset')
    );
}

// LISTA DE ARCHIVOS

function renderFiles(role) {
    const root = $(role + 'Files');
    root.replaceChildren();

    for (const doc of docs.filter(d => d.role === role)) {
        const entry = document.createElement('div');
        entry.className = 'file-entry';

        const button = document.createElement('button');
        button.className = 'remove';
        button.textContent = '×';
        button.setAttribute('aria-label', 'Quitar ' + doc.name);

        button.onclick = () => {
            docs = docs.filter(d => d.id !== doc.id);

            worker.postMessage({
                type: 'remove',
                fileId: doc.id
            });

            invalidate();
            renderFiles(role);
            buttons();
        };

        entry.append(button);

        const name = document.createElement('strong');
        name.textContent = doc.name;
        entry.append(name);

        const label = document.createElement('label');
        label.textContent = 'Hoja';

        const select = document.createElement('select');

        for (const s of doc.sheets) {
            select.add(
                new Option(
                    `${s.name} · ${fmt(s.count)} filas`,
                    s.name
                )
            );
        }

        select.value = doc.sheet;

        select.onchange = () => {
            doc.sheet = select.value;
            doc.map = {
                ...doc.sheets.find(s => s.name === doc.sheet).map
            };

            invalidate();
            renderFiles(role);
            buttons();
        };

        label.append(select);
        entry.append(label);

        const details = document.createElement('details');
        details.className = 'mapping';

        const summary = document.createElement('summary');
        summary.textContent = 'Revisar columnas detectadas';
        details.append(summary);

        for (const field of schema[role]) {
            const l = document.createElement('label');

            l.textContent = fields[field] +
                (required[role].includes(field)
                    ? ' *'
                    : ' (opcional)');

            const s = document.createElement('select');
            s.add(new Option('Sin asignar', ''));

            const headers = doc.sheets.find(
                x => x.name === doc.sheet
            ).headers.filter(Boolean);

            for (const h of headers) {
                s.add(new Option(h, h));
            }

            s.value = doc.map[field] || '';

            s.onchange = () => {
                doc.map[field] = s.value;
                invalidate();
            };

            l.append(s);
            details.append(l);
        }

        entry.append(details);
        root.append(entry);
    }
}

if (!window.RechazosShared && !window.RechazosFolder) {
// CARGA DE EXCEL Y CSV

for (const role of ['bpi', 'records', 'agency']) {
    $(role).addEventListener('change', e => {
        if (!worker) startWorker();

        invalidate();

        for (const file of e.target.files) {
            if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
                fail('Formato no permitido: ' + file.name);
                continue;
            }

            pending++;
            status('Leyendo ' + file.name + '…');

            worker.postMessage({
                id: ++seq,
                type: 'load',
                role,
                file
            });
        }

        e.target.value = '';
        buttons();
    });
}

// CONSTRUIR ANÁLISIS

$('analyze').onclick = () => {
    invalidate();
    busy = true;

    $('error').hidden = true;

    status('Cruzando folios y comprobando las tres fuentes…');
    buttons();

    worker.postMessage({
        id: ++seq,
        type: 'build',
        docs: docs.map(({id, sheet, map}) => ({
            id,
            sheet,
            map
        }))
    });
};

// VACIAR SESIÓN

$('clear').onclick = () => {
    worker?.terminate();
    worker = null;

    docs = [];
    pending = 0;
    busy = false;

    invalidate();

    for (const r of ['bpi', 'records', 'agency']) {
        renderFiles(r);
    }

    buttons();

    status(
        'Sesión vacía. Carga BPI, records y agencia para comenzar.'
    );
};

}

// FILTROS

function optionList(id, values, label) {
    const s = $(id);

    s.replaceChildren(new Option(label, ''));

    for (const value of values) {
        s.add(new Option(value, value));
    }
}

// MODELO DE DATOS

function renderModel() {
    $('results').hidden = false;
    if ($('empty')) $('empty').hidden = true;
    $('export').disabled = false;

    syncFilters('month', {month: model.months.at(-1),trainer:''});

    const r = model.report;

    const cuts = [
        ...new Set(model.rows.map(x => x.cut).filter(Boolean))
    ].sort();

    $('quality').innerHTML = `
        <strong>
            ${fmt(model.rows.length)} folios BPI únicos ·
            ${fmt(model.files.length)} archivos cargados
        </strong><br>
        ${fmt(r.duplicateBpi)} repeticiones BPI consolidadas;
        ${fmt(r.duplicateRecords)} repeticiones en records;
        ${fmt(r.duplicateAgency)} repeticiones en agencia.
        Filas sin folio numérico excluidas:
        BPI ${fmt(r.invalidBpi)},
        records ${fmt(r.invalidRecords)},
        agencia ${fmt(r.invalidAgency)}.
        <br>
        <strong>Corte de agencia:</strong>
        ${cuts.length
            ? esc(cuts[0]) + ' a ' + esc(cuts.at(-1))
            : 'sin fecha reconocida'}.
        Se utiliza el último corte disponible por folio;
        puede ser posterior al mes de creación.
        Los registros sin fecha de corte reconocida
        no permiten fijar una fecha histórica.
    `;

    render();
}

const filterDefinitions = [
    ['month','Month',null],['trainer','Trainer','Todas las capacitadoras'],['region','Region','Todas las regiones'],['store','Store','Todas las tiendas'],['det','Det','Todos los determinantes'],
    ['teamLeader','TeamLeader','Todos los team leaders'],['swatLeader','SwatLeader','Todos los líderes SWAT'],['subleader','Subleader','Todos los sublíderes'],
    ['promoter','Promoter','Todos los promotores / capturistas'],['employeeRole','EmployeeRole','Todos los puestos'],['rh','Rh','Todas las ejecutivas RH'],
    ['cpro','Cpro','Todas las ejecutivas CPRO'],['bankLink','BankLink','Todas las ejecutivas enlace banco'],['attendanceMatch','AttendanceMatch','Todas las coincidencias']
];
function filters(v) {
    return {...Object.fromEntries(filterDefinitions.filter(([,suffix])=>$(v+suffix)).map(([field,suffix])=>[field,$(v+suffix).value])),...($('aSearch')?{q:$('aSearch').value}:{}),...Object.fromEntries([['folioQuery','aFolioSearch'],['personQuery','aPersonSearch']].filter(([,id])=>$(id)).map(([k,id])=>[k,$(id).value]))};
}
function syncFilters(changed, initial) {
    if (!model) return;
    const state = RechazosCore.facets(model.rows, initial || filters('a'), changed);
    if ($('aSearch')) $('aSearch').value=state.selected.q || '';
    for(const [key,id] of [['folioQuery','aFolioSearch'],['personQuery','aPersonSearch']])if($(id))$(id).value=state.selected[key]||'';
    for (const [field,suffix,label] of filterDefinitions) {
        const el = $('a' + suffix);
        if (!el) continue;
        el.replaceChildren();
        if (label) el.add(new Option(label,''));
        for (const value of state.options[field] || []) el.add(new Option(value,value));
        el.value = state.selected[field] || '';
    }
    $('filterContext').textContent = `Mes ${state.selected.month}. ${RechazosCore.select(model.rows,state.selected).base.length.toLocaleString('es-MX')} solicitudes compatibles. ` + (model.automation ? 'Región, tienda y responsables de la base vigente. Promotor validado por asistencia del mes; los casos sin validar se identifican expresamente.' : 'Tienda de BPI.');
}

// TABLAS

function table(headers, rows, numeric = []) {
    return `
        <table>
            <thead>
                <tr>
                    ${headers.map((h, i) => `
                        <th ${numeric.includes(i) ? 'class="num"' : ''}>
                            ${esc(h)}
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.length
                    ? rows.map(row => `
                        <tr>
                            ${row.map((c, i) => `
                                <td ${numeric.includes(i)
                                    ? 'class="num"'
                                    : ''}>
                                    ${esc(c)}
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')
                    : `<tr>
                        <td colspan="${headers.length}">
                            Sin resultados para esta selección.
                        </td>
                    </tr>`
                }
            </tbody>
        </table>
    `;
}

// INDICADORES KPI

function metric(label, value, description, featured = false) {
    return `
        <div class="metric ${featured ? 'featured' : ''}">
            <small>${esc(label)}</small>
            <strong>${esc(value)}</strong>
            <p>${esc(description)}</p>
        </div>
    `;
}

// BARRAS DE MOTIVOS

function bars(items, total, view) {
    if (!items.length) {
        return '<p class="chart-note">Sin casos para esta selección. Prueba otros filtros.</p>';
    }

    const max = Math.max(...items.map(r => r.count), 1);

    return `
        <div class="ranking">
            ${items.map((r, i) => `
                <button
                    type="button"
                    class="cause-bar ${/SIN |CONFLICTO|DIFERENTE|EN PROCESO/.test(r.reason) ? 'revision' : ''}"
                    data-cause="${esc(r.reason)}"
                    data-view="${view}"
                    aria-label="Ver origen de ${esc(r.reason)}, ${fmt(r.count)} casos"
                >
                    <span class="rank-number">
                        ${String(i + 1).padStart(2, '0')}
                    </span>
                    <span class="rank-body">
                        <span class="bar-top">
                            <span>${esc(r.reason)}</span>
                            <b>
                                ${fmt(r.count)}
                                <small>${pct(total ? r.count / total : 0)}</small>
                            </b>
                        </span>
                        <span class="bar-track">
                            <span
                                class="bar-fill"
                                style="width:${r.count / max * 100}%"
                            ></span>
                        </span>
                    </span>
                    <span class="rank-arrow" aria-hidden="true">↗</span>
                </button>
            `).join('')}
        </div>
        <p class="chart-note">
            ${items.length} causas, de mayor a menor.
            Haz clic en una barra para ver su origen
            y dónde se concentra.
        </p>
        <div id="${view}CauseDetail" class="cause-detail" hidden></div>
    `;
}

// GRÁFICA DE COMPOSICIÓN

const palette = [
    '#ff9a40',
    '#b981d0',
    '#a9d47b',
    '#ffc369',
    '#f58c96',
    '#75bcc4'
];

function composition(s) {
    if (!s.total) return '';

    const top = s.reasons.slice(0, 5);
    const other = s.total - top.reduce(
        (n, r) => n + r.count, 0
    );

    const parts = [
        ...top,
        ...(other ? [{reason: 'Otras causas', count: other}] : [])
    ];

    let start = 0;
    const radius = 66;
    const circ = 2 * Math.PI * radius;

    const arcs = parts.map((r, i) => {
        const len = r.count / s.total * circ;

        const svg = `
            <circle
                cx="90"
                cy="90"
                r="${radius}"
                fill="none"
                stroke="${palette[i]}"
                stroke-width="23"
                stroke-dasharray="${len} ${circ - len}"
                stroke-dashoffset="${-start}"
            />
        `;

        start += len;
        return svg;
    }).join('');

    const top3 = s.reasons.slice(0, 3);

    const concentration = top3.reduce(
        (n, r) => n + r.count, 0
    );

    return `
        <div class="cause-takeaway">
            <span class="eyebrow">LO QUE MÁS PESA</span>
            <strong>${esc(s.reasons[0].reason)}</strong>
            <p>
                <b>${fmt(s.reasons[0].count)}</b> casos ·
                ${pct(s.reasons[0].share)} de la selección.
                Las ${top3.length} causas principales reúnen
                <b>${pct(concentration / s.total)}</b>
                de los casos.
            </p>
        </div>

        <div class="composition">
            <svg
                viewBox="0 0 180 180"
                role="img"
                aria-label="Distribución de ${fmt(s.total)} casos por motivo"
            >
                <g transform="rotate(-90 90 90)">
                    ${arcs}
                </g>
                <text x="90" y="87" text-anchor="middle"
                    class="donut-total">
                    ${fmt(s.total)}
                </text>
                <text x="90" y="106" text-anchor="middle"
                    class="donut-label">
                    CASOS
                </text>
            </svg>

            <div class="donut-legend">
                ${parts.map((r, i) => `
                    <div>
                        <span class="legend-dot"
                            style="background:${palette[i]}"></span>
                        <span>${esc(r.reason)}</span>
                        <b>${pct(r.count / s.total)}</b>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="ranking-heading">
            <span>RANKING COMPLETO</span>
            <span>CASOS · % DEL TOTAL</span>
        </div>
    `;
}

// DETALLE INTERACTIVO DE CAUSAS

function showCause(view, reason) {
    const s = views[view];

    const rows = s?.cases.filter(
        r => r.reason === reason
    ) || [];

    const target = $(view + 'CauseDetail');

    if (!rows.length || !target) return;

    const count = new Map();

    for (const r of rows) {
        count.set(
            r.region,
            (count.get(r.region) || 0) + 1
        );
    }

    const regions = [...count]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const max = regions[0]?.[1] || 1;

    const names = [
        ...new Set(rows.flatMap(r => r.agencySources || []))
    ];

    const originals = new Map();

    rows.forEach(r => {
        const raw = r.agencyRawReason || '(sin motivo disponible)';

        originals.set(
            raw,
            (originals.get(raw) || 0) + 1
        );
    });

    const explanation = {
        'SIN TDC':
            'La agencia etiquetó la solicitud como “Sin TDC”. El tablero conserva esa clasificación.',
        'NIVEL DE RIESGO':
            'Agrupa las etiquetas “Rechazo por Nivel de Riesgo” y “Nivel Riesgo” de agencia.',
        'DUPLICIDAD':
            'La fuente de agencia reporta “Duplicidad”. Es una razón de rechazo distinta de las filas repetidas.',
        'GRUPO DE MATRICES':
            'Agrupa las variantes de “Rechazo por Grupo de Matrices” de agencia.',
        'LÍMITE DE CRÉDITO':
            'Proviene de “Limite De Credito Menor A Producto” en agencia.',
        'SIN MOTIVO EN AGENCIA':
            'El folio existe en agencia, pero Estatus_P está vacío.',
        'SIN COINCIDENCIA EN AGENCIA':
            'BPI marca rechazo, pero el folio no se encontró en los archivos de agencia cargados.',
        'ESTATUS DIFERENTE EN AGENCIA':
            'BPI marca rechazo o cancelación y agencia reporta una aprobación.',
        'EN PROCESO EN AGENCIA':
            'BPI marca rechazo o cancelación y agencia todavía reporta “En proceso”.',
        'CONFLICTO ENTRE CORTES':
            'Hay motivos o estatus distintos en agencia y no puede elegirse un corte único de forma fiable.'
    }[reason] ||
        'Esta etiqueta proviene de Estatus_P de agencia, normalizada para agrupar diferencias de escritura.';

    target.hidden = false;

    target.innerHTML = `
        <div class="detail-head">
            <span class="eyebrow">ORIGEN DE LA CAUSA</span>
            <button type="button" class="ghost"
                data-close-cause="${view}"
                aria-label="Cerrar detalle de causa">×</button>
        </div>

        <h4>${esc(reason)}</h4>
        <p>${esc(explanation)}</p>

        <div class="source-flow">
            <div>
                <b>1 · BPI</b>
                <span>ESTATUS BANCO</span>
                <small>Define los casos incluidos</small>
            </div>
            <span aria-hidden="true">→</span>
            <div>
                <b>2 · FOLIO</b>
                <span>Cruce de fuentes</span>
                <small>Una solicitud, un conteo</small>
            </div>
            <span aria-hidden="true">→</span>
            <div>
                <b>3 · AGENCIA</b>
                <span>Estatus_P</span>
                <small>Aporta el motivo</small>
            </div>
        </div>

        <p class="detail-note">
            <b>Records:</b>
            ${fmt(rows.filter(r => r.hasRecords).length)}
            de ${fmt(rows.length)} folios encontrados.
        </p>

        <p class="detail-note">
            <b>Archivo(s) de agencia:</b>
            ${names.length
                ? names.map(esc).join(' · ')
                : 'Sin coincidencia disponible.'}
        </p>

        <h5>Texto original en Estatus_P</h5>

        ${table(
            ['Etiqueta original', 'Casos'],
            [...originals]
                .sort((a, b) => b[1] - a[1])
                .map(([r, n]) => [r, fmt(n)]),
            [1]
        )}

        <h5>¿De dónde vienen estos casos?</h5>
        <p class="detail-note">
            Las 5 regiones con más casos de esta causa.
        </p>

        ${regions.map(([reg, n]) => `
            <div class="region-cause">
                <span>Región ${esc(reg)}</span>
                <div class="bar-track">
                    <span class="bar-fill"
                        style="width:${n / max * 100}%"></span>
                </div>
                <b>${fmt(n)} · ${pct(n / rows.length)}</b>
            </div>
        `).join('')}

        <p class="detail-note">
            ${fmt(rows.length)} casos en la selección.
            El motivo refleja el último corte disponible de agencia.
        </p>
    `;

    document.querySelectorAll(
        `[data-view="${view}"][data-cause]`
    ).forEach(b => {
        const active = b.dataset.cause === reason;

        b.setAttribute(
            'aria-pressed',
            active ? 'true' : 'false'
        );

        if (active) b.after(target);
    });

    target.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
    });
}

document.addEventListener('click', event => {
    const cause = event.target.closest('[data-cause]');

    if (cause) {
        showCause(cause.dataset.view, cause.dataset.cause);
        return;
    }

    const close = event.target.closest('[data-close-cause]');

    if (close) {
        $(close.dataset.closeCause + 'CauseDetail').hidden = true;
    }
});

// RENDERIZAR ANÁLISIS ÚNICO

function render() {
    if (!model || !window.RechazosCore) return;

    const scope = $('scope').value;
    const f = filters('a');

    const a = RechazosCore.select(model.rows, f, scope);

    views = {a};
    if ($('searchResultsPanel')) {
        $('searchResultsPanel').hidden = ![f.q,f.folioQuery,f.personQuery].some(value=>value?.trim());
        $('searchResults').innerHTML = table(['Folio','Promotor / capturista','Tienda','Capacitadora','Estatus BPI','Motivo / referencia'],a.base.slice(0,100).map(r=>[r.folio,r.promoter||'Sin dato',r.store,RechazosCore.trainerForRegion(r.region),r.status,r.reason]));
    }
    if (model.automation) {
        const validated = a.base.filter(r=>r.attendanceMatch==='Coincidencia exacta').length;
        $('filterContext').textContent = `Mes ${f.month}. ${fmt(a.base.length)} solicitudes compatibles: ${fmt(validated)} con capturista validado y ${fmt(a.base.length-validated)} sin validar o con identidad ambigua. Responsables de la base vigente; asistencia del mes y determinante. Los casos sin validar permanecen en los totales.`;
    }

    // KPI

    $('aMetrics').innerHTML =
        metric(
            'Solicitudes BPI',
            fmt(a.base.length),
            'Folios únicos con los filtros seleccionados.'
        ) +
        metric(
            scope === 'rejects'
                ? 'Rechazos BPI'
                : 'Rechazos y canceladas',
            fmt(a.total),
            'Un folio cuenta una sola vez.',
            true
        ) +
        metric(
            scope === 'rejects'
                ? 'Tasa de rechazo'
                : 'Tasa combinada',
            pct(a.rate),
            `${fmt(a.total)} casos / ${fmt(a.base.length)} solicitudes BPI.`
        ) +
        metric(
            'Casos para revisión',
            fmt(a.review.length),
            `${pct(a.total ? a.review.length / a.total : null)} de los casos tiene al menos una alerta.`
        );

    // MOTIVOS

    $('aReasons').innerHTML =
        composition(a) + bars(a.reasons, a.total, 'a');

    // REGIONES

    const regions = new Map();

    for (const r of a.base) {
        if (!regions.has(r.region)) {
            regions.set(r.region, {
                base: 0,
                count: 0
            });
        }

        regions.get(r.region).base++;
    }

    for (const r of a.cases) {
        regions.get(r.region).count++;
    }

    $('aRegions').innerHTML = table(
        ['Región', 'Casos', 'Solicitudes', 'Tasa'],
        [...regions]
            .filter(([, r]) => r.count)
            .sort((x, y) => y[1].count - x[1].count)
            .slice(0, 8)
            .map(([reg, r]) => [
                reg,
                fmt(r.count),
                fmt(r.base),
                pct(r.count / r.base)
            ]),
        [1, 2, 3]
    );

    // COBERTURA

    const checks = [
        [
            'Con coincidencia en records',
            `${fmt(a.records)} / ${fmt(a.total)} · ${pct(a.total ? a.records / a.total : null)}`
        ],
        [
            'Con coincidencia en agencia',
            `${fmt(a.agency)} / ${fmt(a.total)} · ${pct(a.total ? a.agency / a.total : null)}`
        ],
        [
            'Sin motivo en agencia',
            fmt(a.cases.filter(
                r => r.reason === 'SIN MOTIVO EN AGENCIA'
            ).length)
        ],
        [
            'Conflictos entre cortes agencia',
            fmt(a.cases.filter(
                r => r.reason === 'CONFLICTO ENTRE CORTES'
            ).length)
        ],
        [
            'Records con estatus distintos',
            fmt(a.cases.filter(
                r => r.flags.includes('Records con estatus distintos')
            ).length)
        ],
        [
            'Agencia reporta otro estatus',
            fmt(a.cases.filter(
                r => [
                    'ESTATUS DIFERENTE EN AGENCIA',
                    'EN PROCESO EN AGENCIA'
                ].includes(r.reason)
            ).length)
        ]
    ];

    $('checks').innerHTML = checks.map(([k, v]) => `
        <div class="check">
            <span>${esc(k)}</span>
            <b>${esc(v)}</b>
        </div>
    `).join('');

    // CASOS PARA REVISAR

    $('review').innerHTML = table(
        [
            'Folio',
            'BPI',
            'Records',
            'Agencia / motivo',
            'Alerta'
        ],
        a.review.slice(0, 100).map(r => [
            r.folio,
            r.status,
            r.records,
            r.agencyReason,
            r.flags.join('; ')
        ])
    );

    // EVENTO PARA OTROS MÓDULOS

    document.dispatchEvent(
        new CustomEvent('rechazos:render', {
            detail: {
                model,
                options: {
                    a: f,
                    scope
                }
            }
        })
    );
}

// EXPORTACIÓN CSV

function csvCell(value) {
    let s = String(value ?? '');

    if (/^[=+@\-\t\r]/.test(s)) {
        s = "'" + s;
    }

    return '"' + s.replace(/"/g, '""') + '"';
}

function download(name, rows) {
    const blob = new Blob(
        [
            '\uFEFF' +
            rows.map(
                r => r.map(csvCell).join(',')
            ).join('\r\n')
        ],
        {type: 'text/csv;charset=utf-8'}
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = name;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// EXPORTAR RESUMEN

$('export').onclick = () => {
    if (!model) return;

    const rows = [[
        'MES',
        'REGION',
        'DETERMINANTE',
        'TIENDA',
        'CAPACITADORA','BUSQUEDA_FOLIO','BUSQUEDA_PERSONA',
        'TEAM_LEADER','LIDER_SWAT','SUBLIDER','PROMOTOR','PUESTO','RH','CPRO','ENLACE_BANCO','CRUCE_ASISTENCIA',
        'ALCANCE',
        'MOTIVO',
        'CONTEO',
        'PARTICIPACION',
        'SOLICITUDES_BPI',
        'CASOS',
        'TASA',
        'CASOS_REVISION'
    ]];

    const s = views.a;
    const f = filters('a');

    for (const r of s.reasons) {
        rows.push([
            f.month || 'Todos',
            f.region || 'Todas',
            f.det || 'Todos',
            f.store || 'Todas',
            f.trainer || 'Todas',f.folioQuery || '',f.personQuery || '',
            ...['teamLeader','swatLeader','subleader','promoter','employeeRole','rh','cpro','bankLink','attendanceMatch'].map(k=>f[k]||'Todos'),
            $('scope').value,
            r.reason,
            r.count,
            (r.share * 100).toFixed(2) + '%',
            s.base.length,
            s.total,
            s.rate == null
                ? ''
                : (s.rate * 100).toFixed(2) + '%',
            s.review.length
        ]);
    }

    if (!s.reasons.length) {
        rows.push([
            f.month || 'Todos',
            f.region || 'Todas',
            f.det || 'Todos',
            f.store || 'Todas',
            f.trainer || 'Todas',f.folioQuery || '',f.personQuery || '',
            ...['teamLeader','swatLeader','subleader','promoter','employeeRole','rh','cpro','bankLink','attendanceMatch'].map(k=>f[k]||'Todos'),
            $('scope').value,
            'SIN CASOS',
            0,
            '',
            s.base.length,
            0,
            s.rate == null ? '' : '0%',
            0
        ]);
    }

    download('resumen-rechazos.csv', rows);
};

// EXPORTAR REVISIÓN

$('exportReview').onclick = () => {
    if (!model) return;

    download('revision-rechazos.csv', [
        [
            'FOLIO',
            'MES',
            'REGION',
            'DETERMINANTE',
            'ESTATUS_BPI',
            'ESTATUS_RECORDS',
            'ESTATUS_AGENCIA',
            'MOTIVO_AGENCIA',
            'CORTE',
            'ALERTAS'
        ],
        ...views.a.review.map(r => [
            r.folio,
            r.month,
            r.region,
            r.det,
            r.status,
            r.records,
            r.agency,
            r.agencyReason,
            r.cutText,
            r.flags.join('; ')
        ])
    ]);
};

// EVENTOS DE FILTROS

$('scope').onchange = render;
for (const [field,suffix] of filterDefinitions) {
    const control = $('a'+suffix);
    if (control) control.onchange = () => { syncFilters(field); render(); };
}
let searchTimer;
for (const id of ['aSearch','aFolioSearch','aPersonSearch']) if ($(id)) {
    const applySearch=()=>{clearTimeout(searchTimer);syncFilters('search');render();};
    $(id).oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(applySearch,180);};
    $(id).onchange=applySearch;
}
$('resetFilters').onclick = () => { clearTimeout(searchTimer); syncFilters('month', {month: $('aMonth').value,trainer:'',q:'',folioQuery:'',personQuery:''}); render(); };

// El informe compartido trae el motor y sus datos dentro del mismo HTML.
if (window.RechazosShared) {
    model = window.RechazosShared.model;
    renderModel();
    syncFilters('month', window.RechazosShared.filters);
    $('scope').value = window.RechazosShared.scope;
    render();
} else if (window.RechazosFolder) {
    window.RechazosLive.start(next => {
        const previous = model ? filters('a') : null;
        model = next; renderModel();
        if (previous) { syncFilters('month', previous); render(); }
    });
} else {
    const coreScript = document.createElement('script');
    coreScript.src = 'core.js?v=20261022-html';
    coreScript.onload = () => { if (model) render(); };
    coreScript.onerror = () => fail('No se pudo cargar el motor de análisis.');
    document.head.append(coreScript);
    for (const source of ['excel-ui.js?v=20261022-html','html-export.js?v=20261022-html']) {
        const script = document.createElement('script');
        script.src = source;
        document.head.append(script);
    }
}
