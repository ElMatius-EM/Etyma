const PROVIDERS = {
    'gemini-flash': {
        name: 'Google Gemini 2.5 Flash', short: 'Gemini Flash',
        placeholder: 'AIzaSy...',
        desc: 'Creá tu clave gratis en <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a>.',
        costPer: '~$0.003',
    },
    'deepseek': {
        name: 'DeepSeek V3.2', short: 'DeepSeek V3.2',
        placeholder: 'sk-...',
        desc: 'Creá tu clave en <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a>.',
        costPer: '~$0.001',
    },
    'anthropic': {
        name: 'Claude Sonnet 4', short: 'Claude Sonnet 4',
        placeholder: 'sk-ant-api03-...',
        desc: 'Creá tu clave en <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>.',
        costPer: '~$0.02',
    },
};

const SYSTEM_PROMPT = `Eres un lingüista experto en ruso y español con profundos conocimientos de etimología, gramática comparativa e historia de las lenguas eslavas y romances. Tu audiencia son estudiantes de ruso hispanohablantes apasionados por la lingüística.

Cuando recibas una palabra en ruso, genera un análisis completo EN ESPAÑOL siguiendo EXACTAMENTE este formato JSON (sin markdown, sin backticks, solo JSON puro):

{
  "palabra": "la palabra en ruso",
  "transcripcion": "transcripción fonética IPA",
  "pronunciacion_aprox": "pronunciación aproximada para hispanohablantes",
  "definicion": "Definición clara y completa en español. Si tiene múltiples acepciones, listarlas así:\n1. (Categoría) Definición.\n2. (Categoría) Definición.\nSi es una sola acepción, un párrafo corrido. Si NO tiene traducción literal, indicarlo explícitamente al inicio.",
  "traduccion_directa": "traducción(es) más cercana(s) al español, o 'Sin traducción literal directa' si aplica",
  "etimologia": "Análisis etimológico detallado: raíz protoeslava, conexiones con protoindoeuropeo si las hay, cognados en otras lenguas eslavas. Menciona si hay alguna conexión etimológica con el español o el latín. Sé específico con las reconstrucciones (*korwā, etc.).",
  "evolucion": "Explica cómo esta palabra llegó a tener su significado actual en el ruso moderno. Describe los cambios semánticos a lo largo de los siglos, influencias históricas (mongolas, bizantinas, francesas, alemanas, etc.) si las hay. Cuenta la historia de la palabra.",

  "gramatical": "Análisis gramatical comparativo exhaustivo con el español: Compara estructura por estructura con el equivalente español. Señala similitudes sorprendentes y diferencias fundamentales entre ambos sistemas lingüísticos usando esta palabra como ejemplo. Seguir SIEMPRE esta estructura con estos títulos exactos:\nCategoría gramatical: [descripción]\n\nParadigma de declinación (singular):\n- Nominativo: forma (función)\n- Genitivo: forma (función)\n- Dativo: forma (función)\n- Acusativo: forma (función)\n- Instrumental: forma (función)\n- Preposicional: forma (función)\n\nPlural: [formas principales]\n\nAnálisis comparativo con el español:\n1. [punto]\n2. [punto]\n3. [punto]",

  "conceptual": "Si la palabra tiene un campo semántico que no existe como tal en español, explícalo en profundidad. Si tiene matices culturales únicos del mundo rusohablante, descríbelos. Si SÍ tiene equivalente directo, explica igualmente los matices que la diferencian de su traducción española.",
  "ejemplos": [
    {"ruso": "frase en ruso", "español": "traducción al español", "nota": "nota gramatical o cultural breve sobre esta frase"},
    {"ruso": "frase en ruso", "español": "traducción al español", "nota": "nota"},
    {"ruso": "frase en ruso", "español": "traducción al español", "nota": "nota"}
  ]
}

REGLAS:
- Responde SOLO con el JSON, sin texto adicional, sin backticks de markdown.
- Sé académicamente riguroso pero accesible.
- En el análisis gramatical, usa ejemplos concretos de declinaciones o conjugaciones.
- Si la palabra puede ser de varias categorías gramaticales, analiza la principal.
- En los ejemplos, incluye frases que muestren diferentes usos o registros.
- Usa terminología lingüística pero siempre explicándola brevemente.
- Si hay refranes o expresiones idiomáticas con esa palabra, menciónalos.
- Dentro de cada campo de texto, usá \n para separar ideas, listas o secciones. Por ejemplo, en "gramatical" separar el paradigma de declinación del análisis comparativo. En "definicion" separar acepciones numeradas. Nunca escribas todo seguido en un párrafo único.
`;

const SECTIONS = [
    { key: 'definicion', label: 'Definición y traducción' },
    { key: 'etimologia', label: 'Etimología' },
    { key: 'evolucion', label: 'Evolución semántica' },
    { key: 'gramatical', label: 'Análisis gramatical comparativo' },
    { key: 'conceptual', label: 'Significado conceptual' },
    { key: 'ejemplos', label: 'Ejemplos en contexto' },
];

const LOADING_PHRASES = [
    'Consultando raíces protoeslavas…', 'Rastreando conexiones indoeuropeas…',
    'Comparando estructuras gramaticales…', 'Analizando evolución semántica…',
];

const selectedProvider = 'deepseek';

// ─── IndexedDB cache ───
const DB_NAME = 'etima_cache';
const DB_VERSION = 1;
const STORE = 'words';
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(STORE)) {
                d.createObjectStore(STORE, { keyPath: 'word' });
            }
        };
        req.onsuccess = e => { db = e.target.result; resolve(db); preloadFromJSON(); };
        req.onerror = () => reject(req.error);
    });
}

function getCached(word) {
    return new Promise((resolve) => {
        if (!db) { resolve(null); return; }
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(word.trim().toLowerCase());
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
    });
}

function saveToCache(word, data) {
    if (!db) return;
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ word: word.trim().toLowerCase(), data, savedAt: Date.now() });
}

async function preloadFromJSON() {
    const count = await new Promise(res => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).count();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(-1);
    });
    if (count > 0) return;

    try {
        const res = await fetch('words.json');
        if (!res.ok) return;
        const items = await res.json();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);

        items.forEach(item => {
            // Si viene del nuevo export, usa item.word. Si es el formato viejo, usa item.palabra.
            const key = item.word ? item.word : item.palabra.trim().toLowerCase();
            const data = item.data ? item.data : item;

            store.put({
                word: key,
                data: data,
                savedAt: item.savedAt || Date.now(),
            });
        });
        console.log(`Etima: ${items.length} palabras precargadas desde words.json`);
    } catch (e) {
        console.error('Error al precargar JSON:', e);
    }
}


let apiKeys = JSON.parse(localStorage.getItem('etimolog_keys') || '{}');
let history = JSON.parse(localStorage.getItem('etimolog_history') || '[]');
let activeSection = null;
let currentResult = null;
let loadingInterval = null;

function init() {
    openDB().catch(e => console.warn('IndexedDB no disponible:', e));
    if (apiKeys[selectedProvider]) {
        document.getElementById('apiKeyInput').value = apiKeys[selectedProvider];
        markKeySaved();
    }
    buildKeyboard();
    renderHistory();
}

document.getElementById('wordInput').addEventListener('keydown', e => { if (e.key === 'Enter') analyze(); });

function selectProvider(id, silent) {
    selectedProvider = id;
    localStorage.setItem('etimolog_provider', id);
    const p = PROVIDERS[id];
    document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('card-' + id).classList.add('selected');
    document.getElementById('providerLabel').textContent = p.name;
    document.getElementById('providerDesc').innerHTML = p.desc;
    document.getElementById('apiKeyInput').placeholder = p.placeholder;
    const savedKey = apiKeys[id] || '';
    document.getElementById('apiKeyInput').value = savedKey;
    if (savedKey) { markKeySaved(); } else {
        document.getElementById('saveKeyBtn').textContent = 'Guardar';
        document.getElementById('clearKeyBtn').style.display = 'none';
        document.getElementById('keyStatus').style.display = 'none';
    }
    updateActiveBadge();
    if (!silent) document.getElementById('apiKeyInput').focus();
}

//function updateActiveBadge() {
//    const badge = document.getElementById('activeProviderText');
//    const dot = document.querySelector('.active-provider-badge .dot');
//    if (apiKeys[selectedProvider]) {
//        const p = PROVIDERS[selectedProvider];
//        badge.textContent = p.name + '  ·  ' + p.costPer + '/palabra';
//        dot.style.background = '#5a8a5a';
//        document.getElementById('settingsToggle').classList.add('active');
//    } else {
//        badge.textContent = 'Sin configurar — tocá ⚙️';
//        dot.style.background = '#5a5d6a';
//       document.getElementById('settingsToggle').classList.remove('active');
//    }
//}

function markKeySaved() {
    document.getElementById('saveKeyBtn').textContent = '✓ Guardada';
    document.getElementById('clearKeyBtn').style.display = '';
    document.getElementById('keyStatus').style.display = '';
    document.getElementById('keyStatus').textContent = '✓ Clave configurada';
}

function saveApiKey() {
    const val = document.getElementById('apiKeyInput').value.trim();
    if (!val) return;
    apiKeys[selectedProvider] = val;
    localStorage.setItem('etimolog_keys', JSON.stringify(apiKeys));
    markKeySaved();
    updateActiveBadge();
    setTimeout(() => toggleSettings(), 400);
}

function clearApiKey() {
    if (!selectedProvider) return;
    delete apiKeys[selectedProvider];
    localStorage.setItem('etimolog_keys', JSON.stringify(apiKeys));
    document.getElementById('apiKeyInput').value = '';
    document.getElementById('saveKeyBtn').textContent = 'Guardar';
    document.getElementById('clearKeyBtn').style.display = 'none';
    document.getElementById('keyStatus').style.display = 'none';
    updateActiveBadge();
}

function toggleSettings() { document.getElementById('settingsPanel').classList.toggle('open'); }

function startLoading() {
    let idx = 0;
    document.getElementById('loadingArea').style.display = '';
    loadingInterval = setInterval(() => {
        idx = (idx + 1) % LOADING_PHRASES.length;
        document.getElementById('loadingText').textContent = LOADING_PHRASES[idx];
    }, 2200);
}
function stopLoading() {
    document.getElementById('loadingArea').style.display = 'none';
    if (loadingInterval) clearInterval(loadingInterval);
}

function renderHistory() {
    const row = document.getElementById('historyRow');
    const list = document.getElementById('historyList');
    if (history.length === 0) { row.style.display = 'none'; return; }
    row.style.display = '';
    list.innerHTML = history.map(w => `<button class="history-item" onclick="analyzeWord('${w}')">${w}</button>`).join('');
}
function addToHistory(w) {
    history = [w, ...history.filter(x => x !== w)].slice(0, 15);
    localStorage.setItem('etimolog_history', JSON.stringify(history));
    renderHistory();
}

async function exportCache() {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
        const records = req.result;
        const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'words.json';
        a.click();
        URL.revokeObjectURL(a.href);
    };
}

// ─── API calls ───
async function callAnthropic(word, key) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json', 'x-api-key': key,
            'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 4000, system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: `Analiza la palabra rusa: ${word}` }],
        }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.type === 'authentication_error'
        ? 'Clave API de Anthropic inválida.' : `Anthropic: ${d.error.message}`);
    return d.content.map(i => i.type === 'text' ? i.text : '').filter(Boolean).join('\n');
}

async function callGemini(word, key) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: `Analiza la palabra rusa: ${word}` }] }],
            generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
        }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.status === 'UNAUTHENTICATED'
        ? 'Clave API de Google inválida.' : `Gemini: ${d.error.message}`);
    return d.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
}

async function callDeepSeek(word, key) {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
            model: 'deepseek-chat', max_tokens: 4000, temperature: 0.7,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Analiza la palabra rusa: ${word}` },
            ],
        }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.type === 'authentication_error'
        ? 'Clave API de DeepSeek inválida.' : `DeepSeek: ${d.error.message}`);
    return d.choices?.[0]?.message?.content || '';
}

// ─── Analyze ───
function analyzeWord(w) { document.getElementById('wordInput').value = w; analyze(w); }

async function analyze(inputWord) {
    const w = (inputWord || document.getElementById('wordInput').value).trim();
    if (!w) return;

    const wordCount = w.split(/\s+/).length;


    if (wordCount > 3) {
        showError('Por favor, ingresá una sola palabra o una frase corta (máximo 3 palabras). El análisis etimológico no funciona con oraciones largas.');
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('resultsArea').style.display = 'none';
        return;
    }
    // ---------------------------------------------

    if (!apiKeys[selectedProvider]) {
        showError('Primero configurá tu proveedor y clave API. Tocá ⚙️ arriba.');
        toggleSettings(); return;
    }

    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('resultsArea').style.display = 'none';
    document.getElementById('errorBox').style.display = 'none';
    document.getElementById('searchBtn').disabled = true;
    document.getElementById('searchBtn').textContent = 'Analizando…';
    startLoading();

    try {
        const cached = await getCached(w);
        if (cached) {
            currentResult = cached;
            activeSection = null;
            addToHistory(w);
            renderResults(currentResult, true);
            return;
        }

        const key = apiKeys[selectedProvider];
        let raw = '';
        if (selectedProvider === 'anthropic') raw = await callAnthropic(w, key);
        else if (selectedProvider === 'gemini-flash') raw = await callGemini(w, key);
        else if (selectedProvider === 'deepseek') raw = await callDeepSeek(w, key);

        const clean = raw.replace(/```json|```/g, '').trim();
        currentResult = JSON.parse(clean);


        const russianKey = currentResult.palabra.trim().toLowerCase();
        saveToCache(russianKey, currentResult);
        if (w.trim().toLowerCase() !== russianKey) {
            saveToCache(w.trim().toLowerCase(), currentResult);
        }

        activeSection = null;
        addToHistory(w);
        renderResults(currentResult, false);
    } catch (err) {
        console.error(err);
        showError(err.message || 'No se pudo analizar la palabra. Verificá tu conexión e intentá de nuevo.');
    } finally {
        stopLoading();
        document.getElementById('searchBtn').disabled = false;
        document.getElementById('searchBtn').textContent = 'Analizar';
    }
}

function showError(msg) {
    document.getElementById('errorBox').style.display = '';
    document.getElementById('errorText').textContent = msg;
}

function renderResults(r, fromCache = false) {
    const area = document.getElementById('resultsArea');
    area.style.display = '';
    const p = PROVIDERS[selectedProvider];
    let html = `<div class="word-header">
    <div class="word-main">
      <h2 class="word-title">${esc(r.palabra)}</h2>
      ${r.transcripcion ? `<span class="ipa">${esc(r.transcripcion)}</span>` : ''}
    </div>
    ${r.pronunciacion_aprox ? `<p class="pronun"><span class="pronun-label">Pronunciación aproximada:</span> ${esc(r.pronunciacion_aprox)}</p>` : ''}
    ${r.traduccion_directa ? `<div class="translation-badge"><span class="translation-label">→ es</span><span class="translation-text">${esc(r.traduccion_directa)}</span></div>` : ''}
  </div>`;

    html += `<div class="section-nav">`;
    SECTIONS.forEach(s => {
        html += `<button class="nav-btn ${activeSection === s.key ? 'active' : ''}" onclick="filterSection('${s.key}')"><span>${s.label}</span></button>`;
    });
    html += `</div><div>`;

    const show = k => !activeSection || activeSection === k;
    if (show('definicion')) html += card('Definición y traducción', formatText(r.definicion), 0);
    if (show('etimologia')) html += card('Etimología', formatText(r.etimologia), 100);
    if (show('evolucion')) html += card('Evolución semántica', formatText(r.evolucion), 200);
    if (show('gramatical')) html += card('Análisis gramatical comparativo', formatText(r.gramatical), 300);
    if (show('conceptual')) html += card('Significado conceptual', formatText(r.conceptual), 400);
    if (show('ejemplos') && r.ejemplos) {
        let ex = '';
        r.ejemplos.forEach(e => {
            ex += `<div class="example-item"><p class="ex-russian">${esc(e.ruso)}</p><p class="ex-spanish">${esc(e.español)}</p>${e.nota ? `<p class="ex-note"><span class="note-tag">Nota:</span> ${esc(e.nota)}</p>` : ''}</div>`;
        });
        html += card('Ejemplos en contexto', ex, 500);
    }
    html += `</div>`;
    area.innerHTML = html;
    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function card(label, content, delay) {
    return `<div class="section-card" style="animation-delay:${delay}ms"><div class="section-header"><h3 class="section-title">${label}</h3></div>${content}</div>`;
}

function filterSection(k) {
    activeSection = activeSection === k ? null : k;
    if (currentResult) renderResults(currentResult);
}

// ─── Rich text renderer ───
function formatText(raw) {
    if (!raw) return '';
    const lines = raw.replace(/\r\n/g, '\n').replace(/<br\s*\/?>/gi, '\n').split('\n');
    let html = '';
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        if (!line) { i++; continue; }

        // Encabezado: línea corta que termina en ':'
        if (/^[^-\d•*].{0,60}:$/.test(line)) {
            html += `<p class="rt-heading">${esc(line)}</p>`;
            i++; continue;
        }

        // Lista con guión, asterisco o bullet
        if (/^[-*•]\s+/.test(line)) {
            html += '<ul class="rt-list">';
            while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
                html += `<li>${renderInline(lines[i].trim().replace(/^[-*•]\s+/, ''))}</li>`;
                i++;
            }
            html += '</ul>';
            continue;
        }

        // Lista numerada
        if (/^\d+[.)]\s+/.test(line)) {
            html += '<ol class="rt-list">';
            while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
                html += `<li>${renderInline(lines[i].trim().replace(/^\d+[.)]\s+/, ''))}</li>`;
                i++;
            }
            html += '</ol>';
            continue;
        }

        html += `<p class="body-text">${renderInline(line)}</p>`;
        i++;
    }

    return html;
}

// ─── Cyrillic keyboard ───
const KB_ROWS = [
    'йцукенгшщзхъ',
    'фывапролджэ',
    'яячсмитьбю',
];

let kbShift = false;

function buildKeyboard() {
    const kb = document.getElementById('cyrillicKeyboard');
    let html = '';

    KB_ROWS.forEach(row => {
        html += '<div class="kb-row">';
        if (row === KB_ROWS[2]) html += '<button class="kb-key kb-key--shift" id="shiftBtn" onclick="toggleShift()">⇧</button>';
        for (const char of row) {
            html += `<button class="kb-key" data-lower="${char}" onclick="kbType('${char}')">${char}</button>`;
        }
        if (row === KB_ROWS[2]) html += '<button class="kb-key kb-key--wide" data-lower="ё" onclick="kbType(\'ё\')">ё</button>';
        html += '</div>';
    });

    html += `<div class="kb-row kb-row--bottom">
        <button class="kb-key kb-key--wide" onclick="kbType(' ')">espacio</button>
        <button class="kb-key kb-key--action" onclick="kbBackspace()">⌫</button>
        <button class="kb-key kb-key--action kb-key--enter" onclick="analyze()">↵</button>
    </div>`;

    kb.innerHTML = html;
}

function toggleKeyboard() {
    const kb = document.getElementById('cyrillicKeyboard');
    const btn = document.getElementById('keyboardToggleBtn');
    const visible = kb.style.display !== 'none';
    kb.style.display = visible ? 'none' : '';
    btn.classList.toggle('active', !visible);
    if (!visible) document.getElementById('wordInput').focus();
}

function toggleShift() {
    kbShift = !kbShift;
    document.getElementById('shiftBtn').classList.toggle('active', kbShift);
    document.querySelectorAll('.kb-key[data-lower]').forEach(btn => {
        btn.textContent = kbShift ? btn.getAttribute('data-lower').toUpperCase() : btn.getAttribute('data-lower');
    });
}

function kbType(char) {
    const input = document.getElementById('wordInput');
    const ch = kbShift ? char.toUpperCase() : char;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.slice(0, start) + ch + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + ch.length;
    input.focus();
    if (kbShift) toggleShift();
}

function kbBackspace() {
    const input = document.getElementById('wordInput');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start !== end) {
        input.value = input.value.slice(0, start) + input.value.slice(end);
        input.selectionStart = input.selectionEnd = start;
    } else if (start > 0) {
        input.value = input.value.slice(0, start - 1) + input.value.slice(start);
        input.selectionStart = input.selectionEnd = start - 1;
    }
    input.focus();
}

function renderInline(text) {
    return esc(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function esc(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

// ─── DICTIONARY ───────────────────────────────────────────────

let dicData = null;
let dicFiltered = [];
let dicPage = 0;
const DIC_PAGE_SIZE = 40;

const POS_LABELS = {
    noun: 'sust.', verb: 'verb.', adjective: 'adj.', adverb: 'adv.',
    pronoun: 'pron.', preposition: 'prep.', conjunction: 'conj.',
    interjection: 'interj.', particle: 'part.', numeral: 'núm.',
};

// ─── Cambio de modo ───
function switchMode(mode) {
    const isAnalysis = mode === 'analysis';
    document.getElementById('tabAnalysis').classList.toggle('active', isAnalysis);
    document.getElementById('tabDictionary').classList.toggle('active', !isAnalysis);

    ['search-area', 'loadingArea', 'errorBox', 'resultsArea', 'emptyState'].forEach(id => {
        const el = document.getElementById(id) || document.querySelector('.' + id);
    });
    document.querySelector('.search-area').style.display = isAnalysis ? '' : 'none';
    document.getElementById('loadingArea').style.display = 'none';
    document.getElementById('errorBox').style.display = 'none';
    document.getElementById('resultsArea').style.display = isAnalysis && currentResult ? '' : 'none';
    document.getElementById('emptyState').style.display = isAnalysis && !currentResult ? '' : 'none';
    document.getElementById('dictionaryArea').style.display = isAnalysis ? 'none' : '';

    if (!isAnalysis) loadDictionary();

    const exportBtn = document.getElementById('exportBtn');

    if (exportBtn) {
        exportBtn.style.display = (mode === 'analysis') ? 'block' : 'none';
    }
}

// ─── Carga lazy del JSON ───
async function loadDictionary() {
    if (dicData) { renderDicResults(); return; }
    setDicStatus('Cargando diccionario…');
    try {
        const res = await fetch('dictionary.json');
        if (!res.ok) throw new Error('No se pudo cargar dictionary.json');
        dicData = await res.json();
        dicFiltered = dicData;
        setDicStatus('');
        renderDicResults();
    } catch (e) {
        setDicStatus('⚠️ Error al cargar el diccionario: ' + e.message);
    }
}

function setDicStatus(msg) {
    const el = document.getElementById('dicStatus');
    el.textContent = msg;
    el.style.display = msg ? '' : 'none';
}

// ─── Búsqueda ───
let dicSearchTimer = null;
function onDicInput() {
    clearTimeout(dicSearchTimer);
    dicSearchTimer = setTimeout(() => {
        const q = document.getElementById('dicInput').value.trim().toLowerCase();
        if (!dicData) return;
        if (!q) {
            dicFiltered = dicData;
        } else {
            dicFiltered = dicData.filter(e =>
                e.w.toLowerCase().startsWith(q) ||
                (e.t && e.t.toLowerCase().startsWith(q)) ||
                (e.d && e.d.toLowerCase().includes(q))
            );
            // Primero los que empiezan exacto en ruso
            dicFiltered.sort((a, b) => {
                const aEx = a.w.toLowerCase().startsWith(q) ? 0 : 1;
                const bEx = b.w.toLowerCase().startsWith(q) ? 0 : 1;
                return aEx - bEx;
            });
        }
        dicPage = 0;
        renderDicResults();
    }, 180);
}

// ─── Render lista ───
function renderDicResults() {
    const list = document.getElementById('dicResults');
    const pag = document.getElementById('dicPagination');
    const hint = document.getElementById('dicHint');
    closeDicDetail();

    const total = dicFiltered.length;
    hint.textContent = total === dicData.length
        ? `${total.toLocaleString('es-AR')} entradas`
        : `${total.toLocaleString('es-AR')} resultado${total !== 1 ? 's' : ''}`;

    const start = dicPage * DIC_PAGE_SIZE;
    const page = dicFiltered.slice(start, start + DIC_PAGE_SIZE);

    if (!page.length) {
        list.innerHTML = '<p class="dic-empty">Sin resultados.</p>';
        pag.innerHTML = '';
        return;
    }

    list.innerHTML = page.map((e, idx) => `
        <div class="dic-entry" onclick="openDicDetail(${start + idx})">
          <span class="dic-word">${escDic(e.w)}</span>
          ${e.t ? `<span class="dic-translit">${escDic(e.t)}</span>` : ''}
          ${e.p ? `<span class="dic-pos">${POS_LABELS[e.p] || e.p}</span>` : ''}
          <span class="dic-def">${escDic(truncate(e.d || '', 80))}</span>
        </div>`).join('');

    // Paginación
    const totalPages = Math.ceil(total / DIC_PAGE_SIZE);
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    let pagHtml = '';
    if (dicPage > 0) pagHtml += `<button class="dic-page-btn" onclick="dicGoPage(${dicPage - 1})">←</button>`;
    pagHtml += `<span class="dic-page-info">${dicPage + 1} / ${totalPages}</span>`;
    if (dicPage < totalPages - 1) pagHtml += `<button class="dic-page-btn" onclick="dicGoPage(${dicPage + 1})">→</button>`;
    pag.innerHTML = pagHtml;
}

function dicGoPage(n) {
    dicPage = n;
    renderDicResults();
    document.getElementById('dictionaryArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
function escDic(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

// ─── Detalle de entrada ───
function openDicDetail(globalIdx) {
    const e = dicFiltered[globalIdx];
    if (!e) return;

    document.getElementById('dicResults').style.display = 'none';
    document.getElementById('dicPagination').style.display = 'none';
    document.querySelector('.dic-search-wrap').style.display = 'none';

    const detail = document.getElementById('dicDetail');
    detail.style.display = '';

    let html = `
        <div class="dic-detail-header">
          <h2 class="dic-detail-word">${escDic(e.w)}</h2>
          ${e.t ? `<span class="ipa">${escDic(e.t)}</span>` : ''}
          ${e.p ? `<span class="dic-pos dic-pos--lg">${POS_LABELS[e.p] || e.p}</span>` : ''}
        </div>
        ${e.d ? `<p class="dic-detail-def">${escDic(e.d)}</p>` : ''}`;

    // Línea de tiempo etimológica
    if (e.e && e.e.length > 0) {
        html += `<div class="dic-section-title">Etimología</div><div class="dic-timeline">`;
        e.e.forEach((step, i) => {
            html += `
                <div class="dic-timeline-step">
                  <div class="dic-tl-dot ${i === e.e.length - 1 ? 'dic-tl-dot--last' : ''}"></div>
                  <div class="dic-tl-body">
                    <span class="dic-tl-period">${escDic(step.p)}</span>
                    <span class="dic-tl-form">${escDic(step.f)}</span>
                    ${step.y ? `<span class="dic-tl-year">${step.y < 0 ? Math.abs(step.y) + ' a.C.' : step.y > 1000 ? 's. ' + Math.floor(step.y / 100) + 'ᵒ' : step.y}</span>` : ''}
                  </div>
                </div>`;
        });
        html += `</div>`;
    }

    // Cognados
    if (e.c && e.c.length > 0) {
        html += `<div class="dic-section-title">Cognados</div><div class="dic-cognates">`;
        e.c.forEach(cog => {
            html += `<div class="dic-cognate"><span class="dic-cog-lang">${escDic(cog.l)}</span><span class="dic-cog-word">${escDic(cog.w)}</span></div>`;
        });
        html += `</div>`;
    }

    // Botón para ir al análisis completo
    html += `<button class="dic-analyze-btn" onclick="dicAnalyzeWord('${e.w.replace(/'/g, "\\'")}')">
        Análisis completo →
    </button>`;

    document.getElementById('dicDetailContent').innerHTML = html;
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDicDetail() {
    document.getElementById('dicDetail').style.display = 'none';
    document.getElementById('dicResults').style.display = '';
    document.getElementById('dicPagination').style.display = '';
    document.querySelector('.dic-search-wrap').style.display = '';
}

function dicAnalyzeWord(word) {
    switchMode('analysis');
    document.getElementById('wordInput').value = word;
    analyze();
}


// Alfabeto cirílico
const russianAlphabet = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
let currentAlphaFilter = null;


function renderAlphaFilter() {
    const container = document.getElementById('dicAlphaFilter');
    if (!container) return;

    container.innerHTML = '';


    const allBtn = document.createElement('button');
    allBtn.className = 'alpha-btn active';
    allBtn.textContent = 'Все'; // "Todos" en ruso
    allBtn.onclick = () => applyAlphaFilter(null, allBtn);
    container.appendChild(allBtn);

    russianAlphabet.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'alpha-btn';
        btn.textContent = letter;
        btn.onclick = () => applyAlphaFilter(letter, btn);
        container.appendChild(btn);
    });
}

function applyAlphaFilter(letter, btnElement) {
    currentAlphaFilter = letter;

    document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    }

    const searchInput = document.getElementById('dicInput');
    if (searchInput) searchInput.value = '';

    if (!dicData) return;

    if (letter === null) {
        dicFiltered = dicData;
    } else {
        dicFiltered = dicData.filter(e => e.w.toUpperCase().startsWith(letter));
    }

    dicPage = 0;
    renderDicResults();
}

init();
renderAlphaFilter();