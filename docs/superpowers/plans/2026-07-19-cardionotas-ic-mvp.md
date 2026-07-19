# Cardionotas IC MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap Cardionotas as a stripped R+ fork and ship inpatient IC decongestion capture + fixed-schema hoja IC `.docx` export.

**Architecture:** Copy R+ into this repo, rename branding, lock UX to Sala + local Pase (LiveSync/Interconsulta/VPO/Receta HU UI off). Add IC domain modules (descongestión, congestión/POCUS, med dose segments) under `public/js/features/cardio/` and `lib/cardio/`, restore a top-level **Manejo** expediente tab for fantásticos/otros/diuréticos, and generate the institutional IC sheet via OOXML placeholder fill (same pattern as `lib/doc-generators/note-xml-fill.js`).

**Tech Stack:** Electron 41, ES modules + esbuild renderer, SQLCipher (`lib/db`), Node doc generators (`lib/doc-generators`), `node:test` via Electron's Node (`npm run test:one`).

**Spec:** `docs/superpowers/specs/2026-07-19-cardionotas-ic-fork-design.md`  
**Reference docx:** `/Users/mauriciosalas/Downloads/Ma. Elena Contreras Alvarado 19.03.26.docx`  
**Upstream source:** `/Users/mauriciosalas/R+` (do not modify R+; copy into Cardionotas)

---

## File structure (new / primary touch points)

| Path | Responsibility |
| --- | --- |
| `lib/cardio/descongestion.mjs` | Day counts + acumulados with override flags |
| `lib/cardio/congestion.mjs` | Daily congestion checklist + POCUS record helpers |
| `lib/cardio/med-segments.mjs` | Dose segments, active meds, furosemida mg sum, catalog helpers |
| `lib/cardio/ic-export-payload.mjs` | Map patient → plain export DTO for docx fill |
| `lib/doc-generators/ic-hoja.js` | Load template + OOXML placeholder replace |
| `lib/doc-generators/ic-hoja-xml-fill.js` | Pure XML fill functions |
| `templates/ic-seguimiento.docx` | Fixed institutional template (copy of reference) |
| `public/js/features/cardio/descongestion-panel.mjs` | EA header UI |
| `public/js/features/cardio/congestion-panel.mjs` | Checklist + POCUS UI |
| `public/js/features/cardio/manejo-panel.mjs` | Manejo tab UI |
| `public/js/features/cardio/cardionotas-gates.mjs` | Feature gates (hide LAN/VPO/etc.) |
| `public/js/features/cardio/*.test.mjs` | Unit tests co-located |

Preserve existing Cardionotas files: `docs/superpowers/specs/…`, `.gitignore`.

---

### Task 1: Bootstrap R+ tree into Cardionotas

**Files:**
- Create: entire R+ source tree under `/Users/mauriciosalas/Cardionotas` (excluding R+ `.git`, `node_modules`, `dist`, `.superpowers`)
- Preserve: `docs/superpowers/specs/2026-07-19-cardionotas-ic-fork-design.md`, this plan, `.gitignore`
- Modify: `.gitignore` merge R+ ignores + keep `.superpowers/`

- [ ] **Step 1: Copy upstream (rsync)**

```bash
cd /Users/mauriciosalas/Cardionotas
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.superpowers' \
  --exclude 'docs/superpowers' \
  /Users/mauriciosalas/R+/ ./
# restore Cardionotas docs if rsync excluded them incorrectly — docs/superpowers must remain
mkdir -p docs/superpowers/specs docs/superpowers/plans
# ensure design + this plan exist (they should; if missing, abort)
test -f docs/superpowers/specs/2026-07-19-cardionotas-ic-fork-design.md
```

- [ ] **Step 2: Merge .gitignore**

Ensure `.gitignore` includes at least:

```
.superpowers/
.worktrees/
node_modules/
dist/
.env
*.log
.DS_Store
```

Plus whatever R+ already ignores (keep R+ entries).

- [ ] **Step 3: Install and smoke build**

```bash
npm install
npm run build:ui
npm run test:one -- lib/doc-generators/shared.test.js
```

Expected: install succeeds; `build:ui` exits 0; shared test passes (or same baseline as R+).

- [ ] **Step 4: Commit**

```bash
git add -A
git status
git commit -m "$(cat <<'EOF'
chore: bootstrap Cardionotas from R+ source tree

Copy upstream workbench while preserving Cardionotas design docs; exclude build artifacts and LiveSync session dirs from the import.
EOF
)"
```

---

### Task 2: Brand rename to Cardionotas

**Files:**
- Modify: `package.json` (`name`, `description`, `build.productName`, `build.appId`)
- Modify: `main.js` (window title, menu labels, error dialogs that say `R+`)
- Modify: `README.md` title line only (short Cardionotas blurb pointing to IC fork spec) — do not rewrite all R+ release notes

- [ ] **Step 1: Update package.json identity**

Set:

```json
{
  "name": "cardionotas",
  "description": "Cardionotas — seguimiento IC descompensada (fork de R+)",
  "build": {
    "appId": "com.hospitaluniversitario.cardionotas",
    "productName": "Cardionotas"
  }
}
```

Keep other electron-builder fields; change only identity fields above.

- [ ] **Step 2: Replace user-visible `R+` chrome strings in `main.js`**

Replace window `title: 'R+'` and dialog/menu strings that display the product name with `Cardionotas`. Do **not** rename internal LAN module filenames in this task.

- [ ] **Step 3: Smoke**

```bash
node -e "const p=require('./package.json'); if(p.build.productName!=='Cardionotas') process.exit(1)"
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json main.js README.md
git commit -m "$(cat <<'EOF'
chore: rename product branding to Cardionotas

Point package identity and main-process chrome at Cardionotas without changing clinical module layout yet.
EOF
)"
```

---

### Task 3: Feature gates — Sala-only UX, hide LiveSync / VPO / Receta HU / Interconsulta

**Files:**
- Create: `public/js/features/cardio/cardionotas-gates.mjs`
- Create: `public/js/features/cardio/cardionotas-gates.test.mjs`
- Modify: `public/js/mode-features.mjs` — force `appMode` default/migration to `'sala'`
- Modify: settings/LAN panel entry points to no-op or hide when `isCardionotasLanUiEnabled()` is false
- Modify: `public/js/expediente-tabs.mjs` — Salida sections exclude `vpo` and `recetaHu` under Cardionotas gate

- [ ] **Step 1: Write failing tests**

```js
// public/js/features/cardio/cardionotas-gates.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCardionotasLanUiEnabled,
  isCardionotasInterconsultaEnabled,
  filterSalidaSectionsForCardionotas,
} from './cardionotas-gates.mjs';

test('LAN UI disabled in Cardionotas v1', () => {
  assert.equal(isCardionotasLanUiEnabled(), false);
});

test('Interconsulta mode disabled', () => {
  assert.equal(isCardionotasInterconsultaEnabled(), false);
});

test('Salida drops vpo and recetaHu', () => {
  assert.deepEqual(
    filterSalidaSectionsForCardionotas(['listado', 'vpo', 'recetaHu', 'todo']),
    ['listado', 'todo'],
  );
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test:one -- public/js/features/cardio/cardionotas-gates.test.mjs
```

- [ ] **Step 3: Implement gates**

```js
// public/js/features/cardio/cardionotas-gates.mjs
export function isCardionotasLanUiEnabled() {
  return false;
}

export function isCardionotasInterconsultaEnabled() {
  return false;
}

export function filterSalidaSectionsForCardionotas(sections) {
  return (sections || []).filter((s) => s !== 'vpo' && s !== 'recetaHu');
}
```

Wire `filterSalidaSectionsForCardionotas` into `getSalidaSections` in `expediente-tabs.mjs`.  
In `migrateToV3` / settings load path: if `!isCardionotasInterconsultaEnabled()`, force `settings.appMode = 'sala'`.  
Hide LAN sync chrome: guard the LAN settings panel / LiveSync connect button render with `isCardionotasLanUiEnabled()` (find the primary render entry in `public/js/features/lan/` or settings sidebar and early-return empty).

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test:one -- public/js/features/cardio/cardionotas-gates.test.mjs
npm run test:one -- public/js/expediente-tabs.test.mjs
```

Fix any expediente-tabs tests that assume VPO/Receta in Sala salida — update expectations for Cardionotas gates.

- [ ] **Step 5: Commit**

```bash
git add public/js/features/cardio/cardionotas-gates.mjs \
  public/js/features/cardio/cardionotas-gates.test.mjs \
  public/js/expediente-tabs.mjs public/js/mode-features.mjs \
  public/js/features/lan public/js/clinical-settings.mjs
git commit -m "$(cat <<'EOF'
feat: gate Cardionotas to Sala-only without LiveSync UX

Force sala mode and hide LAN sync, VPO, and Receta HU from the default workbench chrome.
EOF
)"
```

---

### Task 4: Domain — descongestión calculations + overrides

**Files:**
- Create: `lib/cardio/descongestion.mjs`
- Create: `lib/cardio/descongestion.test.mjs`

- [ ] **Step 1: Failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetweenInclusive,
  computeDescongestion,
  applyAcumuladoOverride,
  clearAcumuladoOverride,
} from './descongestion.mjs';

test('daysBetweenInclusive counts calendar days', () => {
  assert.equal(daysBetweenInclusive('2026-03-13', '2026-03-19'), 7);
  assert.equal(daysBetweenInclusive('2026-03-13', '2026-03-13'), 1);
});

test('computeDescongestion sums diuresis and uses furosemidaMg', () => {
  const r = computeDescongestion({
    ingresoDate: '2026-03-13',
    asOfDate: '2026-03-19',
    inicioDescongestion: '2026-03-13',
    dailyDiuresisMl: [2900, 2000, 1800, 1700, 1600, 1780, 2465],
    furosemidaAcumuladaMg: 800,
    overrides: {},
  });
  assert.equal(r.diasInternamiento, 7);
  assert.equal(r.diasDescongestion, 7);
  assert.equal(r.diuresisAcumuladaMl, 14245);
  assert.equal(r.furosemidaAcumuladaMg, 800);
});

test('override sticks until cleared', () => {
  let state = { overrides: {} };
  state = applyAcumuladoOverride(state, 'diuresisAcumuladaMl', 17245);
  const r = computeDescongestion({
    ingresoDate: '2026-03-13',
    asOfDate: '2026-03-19',
    inicioDescongestion: '2026-03-13',
    dailyDiuresisMl: [100],
    furosemidaAcumuladaMg: 10,
    overrides: state.overrides,
  });
  assert.equal(r.diuresisAcumuladaMl, 17245);
  state = clearAcumuladoOverride(state, 'diuresisAcumuladaMl');
  const r2 = computeDescongestion({
    ingresoDate: '2026-03-13',
    asOfDate: '2026-03-19',
    inicioDescongestion: '2026-03-13',
    dailyDiuresisMl: [100],
    furosemidaAcumuladaMg: 10,
    overrides: state.overrides,
  });
  assert.equal(r2.diuresisAcumuladaMl, 100);
});
```

- [ ] **Step 2: Run — FAIL**

```bash
npm run test:one -- lib/cardio/descongestion.test.mjs
```

- [ ] **Step 3: Implement**

```js
// lib/cardio/descongestion.mjs
function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function daysBetweenInclusive(fromYmd, toYmd) {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

export function computeDescongestion(input) {
  const overrides = input.overrides || {};
  const diuresisSum = (input.dailyDiuresisMl || []).reduce((s, n) => s + (Number(n) || 0), 0);
  return {
    diasInternamiento: daysBetweenInclusive(input.ingresoDate, input.asOfDate),
    diasDescongestion: daysBetweenInclusive(input.inicioDescongestion, input.asOfDate),
    diuresisAcumuladaMl:
      overrides.diuresisAcumuladaMl != null
        ? Number(overrides.diuresisAcumuladaMl)
        : diuresisSum,
    furosemidaAcumuladaMg:
      overrides.furosemidaAcumuladaMg != null
        ? Number(overrides.furosemidaAcumuladaMg)
        : Number(input.furosemidaAcumuladaMg) || 0,
  };
}

export function applyAcumuladoOverride(state, key, value) {
  const overrides = Object.assign({}, state.overrides || {});
  overrides[key] = value;
  return Object.assign({}, state, { overrides });
}

export function clearAcumuladoOverride(state, key) {
  const overrides = Object.assign({}, state.overrides || {});
  delete overrides[key];
  return Object.assign({}, state, { overrides });
}
```

- [ ] **Step 4: PASS + commit**

```bash
npm run test:one -- lib/cardio/descongestion.test.mjs
git add lib/cardio/descongestion.mjs lib/cardio/descongestion.test.mjs
git commit -m "$(cat <<'EOF'
feat: add descongestión day and acumulado calculators

Support inclusive day counts and sticky manual overrides for diuresis and furosemida totals.
EOF
)"
```

---

### Task 5: Domain — congestión / POCUS day records

**Files:**
- Create: `lib/cardio/congestion.mjs`
- Create: `lib/cardio/congestion.test.mjs`

- [ ] **Step 1: Failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertPocusDay, getPocusDay, emptyCongestionChecklist } from './congestion.mjs';

test('upsertPocusDay replaces same calendar day', () => {
  let hist = [];
  hist = upsertPocusDay(hist, {
    date: '2026-03-14',
    vciCm: 1.96,
    vexus: 0,
    congestionScore: 3,
    lungPattern: 'B',
    stevenson: 'A',
    note: '',
  });
  hist = upsertPocusDay(hist, {
    date: '2026-03-14',
    vciCm: 1.9,
    vexus: 0,
    congestionScore: 2,
    lungPattern: 'B',
    stevenson: 'A',
    note: 'update',
  });
  assert.equal(hist.length, 1);
  assert.equal(getPocusDay(hist, '2026-03-14').congestionScore, 2);
});

test('emptyCongestionChecklist has selector fields', () => {
  const c = emptyCongestionChecklist();
  assert.equal(c.pvy, null);
  assert.equal(c.soplo, null);
  assert.ok('estertores' in c);
});
```

- [ ] **Step 2–4: Implement minimal API**

```js
// lib/cardio/congestion.mjs
export function emptyCongestionChecklist() {
  return {
    pvy: null, // true|false|null
    rhy: null,
    soplo: null,
    soploNota: '',
    estertores: null,
    estertoresNota: '',
    ascitisHepatomegalia: null,
    edemaMi: null,
    edemaMiNota: '',
    llenadoCapilar: '',
  };
}

export function upsertPocusDay(history, record) {
  const date = String(record.date || '').trim();
  const list = Array.isArray(history) ? history.slice() : [];
  const row = {
    date,
    vciCm: record.vciCm ?? null,
    vciCollapse: record.vciCollapse || '',
    vexus: record.vexus ?? null,
    congestionScore: record.congestionScore ?? null,
    congestionComponents: record.congestionComponents || [],
    lungPattern: record.lungPattern || '',
    lungLinesB: record.lungLinesB || '',
    stevenson: record.stevenson || '',
    note: record.note || '',
    checklist: record.checklist || emptyCongestionChecklist(),
  };
  const idx = list.findIndex((r) => r && r.date === date);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return list;
}

export function getPocusDay(history, date) {
  return (history || []).find((r) => r && r.date === String(date)) || null;
}
```

- [ ] **Step 5: Commit**

```bash
npm run test:one -- lib/cardio/congestion.test.mjs
git add lib/cardio/congestion.mjs lib/cardio/congestion.test.mjs
git commit -m "$(cat <<'EOF'
feat: add daily congestion and POCUS history helpers

Store one structured POCUS/checklist record per calendar day with upsert semantics.
EOF
)"
```

---

### Task 6: Domain — med segments, activos, furosemida sum, catalog

**Files:**
- Create: `lib/cardio/med-segments.mjs`
- Create: `lib/cardio/med-segments.test.mjs`

- [ ] **Step 1: Failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendDoseSegment,
  endDoseSegment,
  listActiveMeds,
  sumFurosemidaMg,
  addCatalogTipo,
  FANTASTICO_CLASSES,
} from './med-segments.mjs';

test('FANTASTICO_CLASSES has four pillars', () => {
  assert.equal(FANTASTICO_CLASSES.length, 4);
});

test('dose history and active list', () => {
  let segs = [];
  segs = appendDoseSegment(segs, {
    tipo: 'Furosemida',
    inicio: '2026-03-13',
    dosis: '80 mg IV cada 12h',
    indicacion: 'Descongestión',
  });
  segs = endDoseSegment(segs, segs[0].id, '2026-03-17');
  segs = appendDoseSegment(segs, {
    tipo: 'Furosemida',
    inicio: '2026-03-17',
    dosis: '40 mg VO cada 12h',
    indicacion: 'Descongestión',
  });
  const active = listActiveMeds(segs);
  assert.equal(active.length, 1);
  assert.match(active[0].dosis, /40 mg/);
});

test('sumFurosemidaMg parses mg from furosemida segments only', () => {
  const segs = [
    { tipo: 'Furosemida', dosis: '80 mg IV cada 12h', dosesPerDay: 2, days: 4 },
    { tipo: 'Bumetanida', dosis: '1 mg', dosesPerDay: 2, days: 2 },
  ];
  // Use explicit mgTotal on segments for v1 reliability:
  const withTotals = [
    { tipo: 'Furosemida', mgTotal: 640 },
    { tipo: 'Bumetanida', mgTotal: 4 },
    { tipo: 'Furosemida', mgTotal: 160 },
  ];
  assert.equal(sumFurosemidaMg(withTotals), 800);
});

test('catalog add is idempotent by tipo', () => {
  let cat = [];
  cat = addCatalogTipo(cat, { tipo: 'Enoxaparina', defaultIndicacion: 'Anticoagulación' });
  cat = addCatalogTipo(cat, { tipo: 'Enoxaparina', defaultIndicacion: 'other' });
  assert.equal(cat.length, 1);
});
```

- [ ] **Step 2–4: Implement**

```js
// lib/cardio/med-segments.mjs
export const FANTASTICO_CLASSES = [
  'IECA/ARA/ARNI',
  'SGLT2i',
  'Betabloqueador',
  'MRA',
];

function newId() {
  return 'ms_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function appendDoseSegment(segments, row) {
  const list = Array.isArray(segments) ? segments.slice() : [];
  list.push({
    id: newId(),
    tipo: String(row.tipo || '').trim(),
    inicio: String(row.inicio || '').trim(),
    dosis: String(row.dosis || '').trim(),
    indicacion: String(row.indicacion || '').trim(),
    endedAt: null,
    mgTotal: row.mgTotal != null ? Number(row.mgTotal) : null,
  });
  return list;
}

export function endDoseSegment(segments, id, endedAt) {
  const list = Array.isArray(segments) ? segments.slice() : [];
  const idx = list.findIndex((s) => s && s.id === id);
  if (idx < 0) return list;
  list[idx] = Object.assign({}, list[idx], { endedAt: String(endedAt || '').trim() || null });
  return list;
}

export function listActiveMeds(segments) {
  return (segments || []).filter((s) => s && !s.endedAt);
}

export function sumFurosemidaMg(segments) {
  return (segments || []).reduce((sum, s) => {
    if (!s || !/furosemida/i.test(String(s.tipo || ''))) return sum;
    return sum + (Number(s.mgTotal) || 0);
  }, 0);
}

export function addCatalogTipo(catalog, entry) {
  const tipo = String(entry.tipo || '').trim();
  if (!tipo) return catalog || [];
  const list = Array.isArray(catalog) ? catalog.slice() : [];
  const idx = list.findIndex((c) => c && String(c.tipo).toLowerCase() === tipo.toLowerCase());
  const row = {
    tipo,
    defaultIndicacion: String(entry.defaultIndicacion || '').trim(),
  };
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], row);
  else list.push(row);
  return list;
}

export function emptyFantasticos() {
  return FANTASTICO_CLASSES.map((className) => ({
    className,
    drug: '',
    inicio: '',
    dosis: '',
    tolerancia: '',
  }));
}
```

Note: UI must collect `mgTotal` per furosemida segment (number input) so acumulado is reliable without parsing free-text doses.

- [ ] **Step 5: Commit**

```bash
npm run test:one -- lib/cardio/med-segments.test.mjs
git add lib/cardio/med-segments.mjs lib/cardio/med-segments.test.mjs
git commit -m "$(cat <<'EOF'
feat: add IC med dose-segment model and furosemida sum

Support fantásticos classes, catalog tipos, active regimens, and explicit mg totals for acumulados.
EOF
)"
```

---

### Task 7: Persist IC fields on patient + restore Manejo tab shell

**Files:**
- Modify: patient shape defaults wherever `monitoreo` is initialized (search `estadoClinico` / `monitoreo:` in `public/js`)
- Modify: `public/js/expediente-tabs.mjs` — add `'manejo'` to consolidated Sala tabs; map granular `manejo` → `{ tab: 'manejo', section: null }`
- Modify: expediente HTML shell (`public/index.html` or template source used by `build:ui`) — add `itab-manejo` button + `#exp-pane-manejo` mount
- Create: `public/js/features/cardio/manejo-panel.mjs` (empty render shell first)
- Update: `public/js/expediente-tabs.test.mjs` for new tab

Patient blob extension (logical):

```js
patient.cardio = {
  inicioDescongestion: '',
  overrides: {},
  pocusByDay: [],
  fantasticos: emptyFantasticos(),
  medSegments: [],
  diureticSegments: [],
  medCatalog: [],
};
```

- [ ] **Step 1: Update tab tests first (fail), then implement tab + empty pane**
- [ ] **Step 2: `npm run build:ui` + `npm run test:one -- public/js/expediente-tabs.test.mjs`**
- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add Cardionotas Manejo tab and patient.cardio blob

Restore a top-level Manejo expediente tab and default IC persistence fields on the patient record.
EOF
)"
```

---

### Task 8: UI — Estado actual descongestión + congestión/POCUS

**Files:**
- Create: `public/js/features/cardio/descongestion-panel.mjs`
- Create: `public/js/features/cardio/congestion-panel.mjs`
- Modify: Estado actual panel mount (`estado-actual-panel.mjs` / `estado-actual-panel-render.mjs`) to inject cardio blocks above vitals
- Wire save into `patient.cardio` + balance diuresis series for `computeDescongestion`
- Show read-only active meds via `listActiveMeds(medSegments.concat(diureticSegments))` + open fantásticos doses

- [ ] **Step 1:** Mount header with calculated days + override inputs + Recalcular buttons calling `clearAcumuladoOverride`
- [ ] **Step 2:** Mount checklist selectors + POCUS form; on save call `upsertPocusDay`
- [ ] **Step 3:** Manual UI smoke notes in commit body; add one unit test for panel HTML builder if you extract `buildDescongestionHeaderHtml`
- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: wire IC descongestión and congestion UI into Estado actual

Capture daily checklist/POCUS and show calculated acumulados with sticky overrides.
EOF
)"
```

---

### Task 9: UI — Manejo tables (fantásticos, otros, diuréticos, repo)

**Files:**
- Expand: `public/js/features/cardio/manejo-panel.mjs`
- Create: `public/js/features/cardio/manejo-panel.test.mjs` (HTML/row helpers)
- Persist `patient.cardio.fantasticos`, `medSegments`, `diureticSegments`, `medCatalog`

UI rules:
- Fantásticos: 4 rows, columns Tipo(class)/Inicio/Dosis/Tolerancia + drug name field
- Otros: table Tipo|Inicio|Dosis|Indicación; actions: add segment, end segment (suspensión implícita), “guardar tipo en repo”
- Diuréticos: same + `mgTotal` number field for Furosemida rows
- Selectors pull from `medCatalog`

- [ ] **Step 1–3: TDD helpers for row model ↔ table, then wire panel**
- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: implement Manejo IC medication tables and catalog

Edit fantásticos, dose-segment history, and diuretic mg totals that feed Estado actual acumulados.
EOF
)"
```

---

### Task 10: IC docx template + OOXML filler

**Files:**
- Create: `templates/ic-seguimiento.docx` (copy reference file)
- Create: `lib/doc-generators/ic-hoja-xml-fill.js`
- Create: `lib/doc-generators/ic-hoja.js`
- Create: `lib/doc-generators/ic-hoja.test.js`
- Create: `lib/cardio/ic-export-payload.mjs`
- Create: `lib/cardio/ic-export-payload.test.mjs`

Fill strategy (match `note-xml-fill.js`): keep template text sentinels from the reference docx (patient name, registro, sample vitals, sample POCUS lines). Replace those sentinels with `esc()`-safe values. **Do not reorder OOXML sections.**

- [ ] **Step 1:** Copy template

```bash
cp "/Users/mauriciosalas/Downloads/Ma. Elena Contreras Alvarado 19.03.26.docx" \
  templates/ic-seguimiento.docx
```

- [ ] **Step 2:** Write `buildIcExportPayload(patient, { asOfDate })` test with a minimal Ma.Elena-shaped fixture (subset)
- [ ] **Step 3:** Write `fillIcHojaXml(xml, payload)` that replaces at least: nombre, registro, días internamiento, VExUS, congestion score placeholders discovered by unzipping `word/document.xml` and listing stable strings
- [ ] **Step 4:** `ic-hoja.js` loads template zip, fills `word/document.xml`, writes output buffer
- [ ] **Step 5:** Test round-trip: output buffer is zip; `document.xml` contains patient registro and does not contain the original sentinel registro if different

```bash
npm run test:one -- lib/cardio/ic-export-payload.test.mjs
npm run test:one -- lib/doc-generators/ic-hoja.test.js
```

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add fixed-schema IC hoja docx generator

Fill the institutional seguimiento template from a Cardionotas export payload without altering section order.
EOF
)"
```

---

### Task 11: Salida — Generar hoja IC action

**Files:**
- Modify: Salida segment UI to add button **Generar hoja IC**
- Wire IPC or existing doc-export HTTP path (same pattern as note export in `lib/doc-export-http.js` / `document-export-client.mjs`)
- Add as-of date input (default today)

- [ ] **Step 1:** Find existing note export client call; clone for `ic-hoja`
- [ ] **Step 2:** Main/server route returns generated docx to Downloads
- [ ] **Step 3:** Manual path documented; add integration test if export HTTP already has test harness
- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: export Generar hoja IC from Salida

Connect the fixed template generator to the patient Salida action with an as-of date.
EOF
)"
```

---

### Task 12: Fixture patient + README Cardionotas + metrics smoke

**Files:**
- Create: `data/demo-patients/ma-elena-ic-fixture.json` (or R+ demo patient format)
- Modify: `README.md` — Cardionotas purpose + link to spec/plan
- Run: `npm run build:ui` and targeted tests listed below

- [ ] **Step 1: Fixture** covering multi-day POCUS, diuretic segments totaling 800 mg, eventualidades, labs stubs
- [ ] **Step 2: Run verification suite**

```bash
npm run build:ui
npm run test:one -- lib/cardio/descongestion.test.mjs
npm run test:one -- lib/cardio/congestion.test.mjs
npm run test:one -- lib/cardio/med-segments.test.mjs
npm run test:one -- lib/cardio/ic-export-payload.test.mjs
npm run test:one -- lib/doc-generators/ic-hoja.test.js
npm run test:one -- public/js/features/cardio/cardionotas-gates.test.mjs
npm run test:one -- public/js/expediente-tabs.test.mjs
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: add IC fixture patient and Cardionotas README entry

Document the MVP path and provide a Ma.Elena-shaped fixture for export smoke checks.
EOF
)"
```

---

## Spec coverage checklist

| Spec section | Tasks |
| --- | --- |
| Fork + strip LiveSync/Interconsulta/VPO | 1–3 |
| Branding Cardionotas | 2 |
| Descongestión acumulados + override | 4, 8 |
| Congestión checklist + POCUS diario | 5, 8 |
| Manejo fantásticos / otros / diuréticos / repo | 6, 7, 9 |
| Meds activos RO in EA | 8 |
| Eventualidades acumuladas in export | 10–11 (payload includes all events) |
| Labs in export | 10–11 |
| Fixed docx schema | 10–11 |
| Pase local only | 3 (LAN UI off; keep pase board) |
| Success criteria / fixture | 12 |

## Deferred (explicit, not in tasks)

- Furosemida-equivalent conversion for bumetanide (v1: `mgTotal` on furosemida only)
- Deleting LAN code (gated, not deleted)
- Broader cardiology templates
