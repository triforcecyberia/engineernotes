/* ===== API CONFIG ===== */
const API_BASE = 'https://engnotes-backend.onrender.com';

/**
 * Fetch JSON from the backend API with a timeout and graceful failure.
 * Returns null on any error (network, timeout, non-2xx, malformed JSON)
 * so callers can fall back to local hardcoded data.
 */
async function apiGet(path, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.success !== true) return null;
    return json.data;
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}


/* ===== NAVIGATION ===== */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  document.querySelectorAll(`[data-page="${id}"]`).forEach(l => l.classList.add('active'));
  window.scrollTo(0, 0);
  history.replaceState(null, '', '#' + id);
  closeMobileNav();

  // Page-entry motion: the sheet's title block settles in, like a drawing
  // being laid on the table. Subtle, once per navigation — not scattered.
  if (page && window.gsap) {
    gsap.fromTo(page.querySelectorAll('.sheet-title-block, .home-hero'),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
  }
}

document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    showPage(el.dataset.page);
  });
});

// Mobile nav toggle
function closeMobileNav() {
  document.querySelector('.main-nav')?.classList.remove('open');
}
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.main-nav')?.classList.toggle('open');
});

// Route on load
const hash = location.hash.replace('#', '');
showPage(hash || 'home');


/* ===== DIMENSION-LINE RESULT REVEAL =====
   Signature interaction: when a calculator produces a result, the value
   is "dimensioned" onto the sheet the way a draftsman places a dimension
   line — a tick mark draws in, then the leader rule extends, then the
   value itself settles. Reusable across every calculator's result box. */
function revealResult(boxId) {
  const box = $(boxId);
  if (!box) return;
  box.classList.add('visible');

  if (!window.gsap) return; // graceful no-op if GSAP failed to load

  const ticks = box.querySelectorAll('.dim-tick');
  const rules = box.querySelectorAll('.dim-rule');
  const values = box.querySelectorAll('.result-value, .result-item');

  gsap.killTweensOf([...ticks, ...rules, ...values]);
  gsap.set(ticks, { scaleY: 0 });
  gsap.set(rules, { scaleX: 0 });
  gsap.set(values, { opacity: 0, y: 6 });

  const tl = gsap.timeline();
  tl.to(ticks, { scaleY: 1, duration: 0.18, ease: 'power1.out', stagger: 0.03 })
    .to(rules, { scaleX: 1, duration: 0.28, ease: 'power2.out' }, '-=0.1')
    .to(values, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', stagger: 0.04 }, '-=0.15');
}


/* ===== HELPERS ===== */
const $ = id => document.getElementById(id);
const rad = deg => deg * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const fmt = (n, d = 4) => isFinite(n) ? Number(n.toFixed(d)).toString() : '—';


/* ===== CALC 1: DEGREES ↔ DECIMAL ===== */
function calcDegToDecimal() {
  const d = parseFloat($('deg-d').value) || 0;
  const m = parseFloat($('deg-m').value) || 0;
  const s = parseFloat($('deg-s').value) || 0;
  // Excel formula: =C3+(C4/60)+((C5/60)/60)  which equals degrees + minutes/60 + seconds/3600
  const result = d + (m / 60) + (s / 3600);
  $('deg-result').textContent = fmt(result, 6) + '°';
  revealResult('deg-result-box');
}

function calcDecimalToDeg() {
  const dec = parseFloat($('decimal-in').value);
  if (isNaN(dec)) return;
  const d = Math.floor(Math.abs(dec));
  const mFull = (Math.abs(dec) - d) * 60;
  const m = Math.floor(mFull);
  const s = ((mFull - m) * 60);
  $('dec-result').textContent = `${dec < 0 ? '-' : ''}${d}° ${m}' ${fmt(s, 2)}"`;
  revealResult('dec-result-box');
}


/* ===== CALC 2: RIGHT TRIANGLE ===== */
function calcTriangle() {
  const mode = document.querySelector('.tab-btn[data-group="tri"].active')?.dataset.tab || 'tri-hyp';
  let a, b, c, alpha, beta;

  if (mode === 'tri-hyp') {
    // Known: hypotenuse c + angle alpha
    c = parseFloat($('tri-c').value);
    alpha = parseFloat($('tri-alpha').value);
    if (isNaN(c) || isNaN(alpha) || alpha <= 0 || alpha >= 90) return alert('Введите гипотенузу и угол α (0–90)');
    a = c * Math.sin(rad(alpha));
    b = c * Math.cos(rad(alpha));
    beta = 90 - alpha;
  } else if (mode === 'tri-legs') {
    // Known: two legs a and b
    a = parseFloat($('tri-a2').value);
    b = parseFloat($('tri-b2').value);
    if (isNaN(a) || isNaN(b)) return alert('Введите оба катета');
    c = Math.sqrt(a * a + b * b);
    alpha = deg(Math.atan2(a, b));
    beta = 90 - alpha;
  } else if (mode === 'tri-leg-hyp') {
    // Known: leg a + hypotenuse c
    a = parseFloat($('tri-a3').value);
    c = parseFloat($('tri-c3').value);
    if (isNaN(a) || isNaN(c) || a >= c) return alert('Катет должен быть меньше гипотенузы');
    b = Math.sqrt(c * c - a * a);
    alpha = deg(Math.asin(a / c));
    beta = 90 - alpha;
  } else if (mode === 'tri-leg-angle') {
    // Known: leg a + angle alpha
    a = parseFloat($('tri-a4').value);
    alpha = parseFloat($('tri-alpha4').value);
    if (isNaN(a) || isNaN(alpha) || alpha <= 0 || alpha >= 90) return alert('Введите катет и угол α (0–90)');
    c = a / Math.sin(rad(alpha));
    b = c * Math.cos(rad(alpha));
    beta = 90 - alpha;
  }

  $('res-a').textContent = fmt(a);
  $('res-b').textContent = fmt(b);
  $('res-c').textContent = fmt(c);
  $('res-alpha').textContent = fmt(alpha, 4) + '°';
  $('res-beta').textContent = fmt(beta, 4) + '°';
  revealResult('tri-result-box');
}


/* ===== CALC 3: TAPER / CONE ANGLE ===== */
function calcTaper() {
  const D = parseFloat($('taper-D').value);
  const d = parseFloat($('taper-d').value);
  const L = parseFloat($('taper-L').value);
  if (isNaN(D) || isNaN(d) || isNaN(L) || L <= 0) return;
  const halfAngle = deg(Math.atan((D - d) / (2 * L)));
  const fullAngle = 2 * halfAngle;
  const taper = (D - d) / L;
  $('taper-half').textContent = fmt(halfAngle, 4) + '°';
  $('taper-full').textContent = fmt(fullAngle, 4) + '°';
  $('taper-ratio').textContent = '1 : ' + fmt(1 / taper, 3);
  revealResult('taper-result-box');
}

function calcTaperReverse() {
  const d_s = parseFloat($('taper-d-small').value);
  const angle = parseFloat($('taper-angle').value);
  const L2 = parseFloat($('taper-L2').value);
  if (isNaN(d_s) || isNaN(angle) || isNaN(L2)) return;
  const D_large = d_s + 2 * L2 * Math.tan(rad(angle / 2));
  $('taper-D-res').textContent = fmt(D_large, 4) + ' мм';
  revealResult('taper-rev-result-box');
}


/* ===== CALC 4: SURFACE ROUGHNESS ===== */
// Fallback data (used if backend is unreachable or still waking up)
const roughnessDataFallback = [
  { gost: '1', iso: '', ra_gost: 80.0, rz_gost: 320, ra_iso: null, ra5: null, ra8: null },
  { gost: '', iso: 'N12', ra_gost: 50.0, rz_gost: null, ra_iso: 50.0, ra5: 250.0, ra8: 400.0 },
  { gost: '2', iso: '', ra_gost: 40.0, rz_gost: 160, ra_iso: null, ra5: null, ra8: null },
  { gost: '', iso: 'N11', ra_gost: 25.0, rz_gost: null, ra_iso: 25.0, ra5: 125.0, ra8: 200 },
  { gost: '3', iso: '', ra_gost: 20, rz_gost: 80, ra_iso: null, ra5: null, ra8: null },
  { gost: '', iso: 'N10', ra_gost: 12.5, rz_gost: null, ra_iso: 12.6, ra5: 63.0, ra8: 100.0 },
  { gost: '4', iso: '', ra_gost: 10.0, rz_gost: 40.0, ra_iso: 10, ra5: 50, ra8: 80.0 },
  { gost: '', iso: 'N9', ra_gost: 6.3, rz_gost: null, ra_iso: 6.3, ra5: 32.0, ra8: 50.0 },
  { gost: '5', iso: '', ra_gost: 5.0, rz_gost: 20.0, ra_iso: 5.0, ra5: 25.0, ra8: 40.0 },
  { gost: '', iso: 'N8', ra_gost: 3.20, rz_gost: null, ra_iso: 3.2, ra5: 16.0, ra8: 25.0 },
  { gost: '6', iso: '', ra_gost: 2.5, rz_gost: 10.0, ra_iso: 2.5, ra5: 12.5, ra8: 20.0 },
  { gost: '', iso: 'N7', ra_gost: null, rz_gost: null, ra_iso: 1.8, ra5: 9.0, ra8: 14.4 },
  { gost: '7', iso: '', ra_gost: 1.25, rz_gost: 6.3, ra_iso: 1.26, ra5: 6.3, ra8: 10.0 },
  { gost: '', iso: 'N6', ra_gost: 0.80, rz_gost: null, ra_iso: 0.8, ra5: 4.0, ra8: 6.4 },
  { gost: '8', iso: '', ra_gost: 0.63, rz_gost: 3.2, ra_iso: 0.63, ra5: 3.2, ra8: 5.0 },
  { gost: '', iso: 'N5', ra_gost: null, rz_gost: null, ra_iso: 0.35, ra5: 1.75, ra8: 2.8 },
  { gost: '9', iso: '', ra_gost: 0.32, rz_gost: 1.6, ra_iso: 0.32, ra5: 1.6, ra8: 2.56 },
  { gost: '', iso: 'N4', ra_gost: null, rz_gost: null, ra_iso: 0.18, ra5: 0.9, ra8: 1.4 },
  { gost: '10', iso: '', ra_gost: 0.16, rz_gost: 0.8, ra_iso: 0.16, ra5: 0.8, ra8: 1.28 },
  { gost: '11', iso: 'N3', ra_gost: 0.08, rz_gost: 0.4, ra_iso: 0.10, ra5: 0.5, ra8: 0.8 },
  { gost: '12', iso: 'N2', ra_gost: 0.04, rz_gost: 0.2, ra_iso: 0.05, ra5: 0.25, ra8: 0.4 },
  { gost: '13', iso: 'N1', ra_gost: 0.02, rz_gost: 0.1, ra_iso: 0.025, ra5: 0.1, ra8: 0.2 },
  { gost: '14', iso: '', ra_gost: 0.1, rz_gost: 0.05, ra_iso: null, ra5: null, ra8: null },
];

let roughnessData = roughnessDataFallback;

async function loadRoughnessFromApi() {
  const data = await apiGet('/api/ref/roughness');
  if (data && Array.isArray(data) && data.length > 0) {
    // Backend shape: {gostClass, isoCode, raGost, rzGost, raIso, ra5x, ra8x}
    roughnessData = data.map(r => ({
      gost: r.gostClass, iso: r.isoCode,
      ra_gost: r.raGost, rz_gost: r.rzGost, ra_iso: r.raIso,
      ra5: r.ra5x, ra8: r.ra8x
    }));
  }
  buildRoughnessTable();
}

function buildRoughnessTable() {
  const tbody = $('roughness-tbody');
  if (!tbody) return;
  tbody.innerHTML = roughnessData.map(r => `
    <tr>
      <td class="highlight">${r.gost || ''}</td>
      <td>${r.iso || ''}</td>
      <td>${r.ra_gost ?? ''}</td>
      <td>${r.rz_gost ?? ''}</td>
      <td>${r.ra_iso ?? ''}</td>
      <td>${r.ra5 ?? ''}</td>
      <td>${r.ra8 ?? ''}</td>
    </tr>
  `).join('');
}


/* ===== CALC 5: HARDNESS CONVERSION ===== */
// Fallback data (used if backend is unreachable or still waking up)
const hardnessDataFallback = [
  [100,100,52.4,333],[105,105,57.5,350],[110,110,60.9,362],[115,115,64.1,382],
  [120,120,67.0,402],[125,125,69.8,410],[130,130,72.4,430],[135,135,74.7,450],
  [140,140,76.6,470],[145,145,78.3,480],[150,150,79.9,500],[155,155,81.4,520],
  [160,160,82.8,530],[165,165,84.2,550],[170,170,85.6,565],[175,175,87.0,580],
  [180,180,88.3,600],[185,185,89.5,620],[190,190,90.6,640],[195,195,91.7,650],
  [200,200,92.8,665],[205,205,93.8,685],[210,210,94.8,695],[215,215,95.7,715],
  [220,220,96.6,735],[225,225,97.5,745],[230,230,98.4,765],[235,235,99.2,785],
  [240,240,100.0,795],[245,245,21.2,815],[250,250,22.1,835],[255,255,23.0,855],
  [260,260,23.9,865],[265,265,24.8,880],[270,270,25.6,900],[275,275,26.4,910],
  [280,280,27.2,930],[285,285,28.0,950],[290,290,28.8,970],[295,295,29.5,980],
  [300,300,30.2,1000],[310,310,31.6,1030],[320,319,33.0,1060],[330,328,34.2,1090],
  [340,336,35.3,1120],[350,344,36.3,1150],[360,352,37.2,1180],[370,360,38.1,1200],
  [380,368,38.9,1230],[390,376,39.7,1260],[400,384,40.5,1290],[410,392,41.3,1305],
  [420,400,42.1,1335],[430,408,42.9,1365],[440,416,43.7,1385],[450,425,44.5,1410],
  [460,434,45.3,1440],[470,443,46.1,1480],
];
// Note: HRB is used for HV < 240, HRC for HV >= 240

// Live data — populated from backend on load, falls back to hardcoded array
let hardnessData = hardnessDataFallback;

async function loadHardnessFromApi() {
  const data = await apiGet('/api/ref/hardness');
  if (data && Array.isArray(data) && data.length > 0) {
    // Backend shape: {id, hv, hb, hr, hrScale, sigmaMpa} -> convert to [hv, hb, hr, sigmaMpa]
    hardnessData = data.map(r => [r.hv, r.hb, r.hr, r.sigmaMpa]);
  }
  buildHardnessTable($('hardness-search')?.value?.trim() || '');
}

function buildHardnessTable(filter = '') {
  const tbody = $('hardness-tbody');
  if (!tbody) return;
  const rows = hardnessData.filter(r => !filter || r.some(v => String(v).includes(filter)));
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="highlight">${r[0]}</td>
      <td>${r[1]}</td>
      <td>${r[0] < 240 ? r[2] + ' (HRB)' : r[2] + ' (HRC)'}</td>
      <td>${r[3]}</td>
    </tr>
  `).join('');
}

function searchHardness() {
  buildHardnessTable($('hardness-search').value.trim());
}

function calcHardnessConvert() {
  const val = parseFloat($('hv-input').value);
  if (isNaN(val)) return;
  // Find nearest row
  let best = hardnessData[0], bestDiff = Math.abs(hardnessData[0][0] - val);
  hardnessData.forEach(r => { const d = Math.abs(r[0] - val); if (d < bestDiff) { bestDiff = d; best = r; } });
  $('conv-hv').textContent = best[0];
  $('conv-hb').textContent = best[1];
  $('conv-hr').textContent = best[2] + (best[0] < 240 ? ' HRB' : ' HRC');
  $('conv-mpa').textContent = best[3] + ' МПа';
  revealResult('hardness-conv-box');
}


/* ===== CNC MACROS REFERENCE ===== */
const cncFunctions = [
  { cmd: '#i=SIN[#j]', desc: 'Синус (аргумент в градусах)' },
  { cmd: '#i=COS[#j]', desc: 'Косинус (аргумент в градусах)' },
  { cmd: '#i=TAN[#j]', desc: 'Тангенс (аргумент в градусах)' },
  { cmd: '#i=ASIN[#j]', desc: 'Арксинус → градусы' },
  { cmd: '#i=ACOS[#j]', desc: 'Арккосинус → градусы' },
  { cmd: '#i=ATAN[#j]', desc: 'Арктангенс (1 аргумент), также ATN' },
  { cmd: '#i=ATAN[#j]/[#k]', desc: 'Арктангенс (2 аргумента), также ATN' },
  { cmd: '#i=ATAN[#j,#k]', desc: 'Арктангенс (2 аргумента), также ATN' },
  { cmd: '#i=SQRT[#j]', desc: 'Квадратный корень, также SQR' },
  { cmd: '#i=ABS[#j]', desc: 'Абсолютное значение' },
  { cmd: '#i=BIN[#j]', desc: 'BCD → двоичный' },
  { cmd: '#i=BCD[#j]', desc: 'Двоичный → BCD' },
  { cmd: '#i=ROUND[#j]', desc: 'Округление, также RND' },
  { cmd: '#i=FIX[#j]', desc: 'Округление до меньшего целого' },
  { cmd: '#i=FUP[#j]', desc: 'Округление до большего целого' },
  { cmd: '#i=LN[#j]', desc: 'Натуральный логарифм' },
  { cmd: '#i=EXP[#j]', desc: 'Экспонента e^#j' },
  { cmd: '#i=POW[#j,#k]', desc: 'Степень (#j в степени #k)' },
  { cmd: '#i=ADP[#j]', desc: 'Прибавление десятичной точки' },
  { cmd: '#i=#j AND #k', desc: 'Логическое И (побитово 32 бит)' },
  { cmd: '#i=#j MOD #k', desc: 'Остаток от деления (до целых)' },
];
const cncOperators = [
  { op: 'GE', desc: 'Больше или равно  ≥' },
  { op: 'GT', desc: 'Больше  >' },
  { op: 'LE', desc: 'Меньше или равно  ≤' },
  { op: 'LT', desc: 'Меньше  <' },
  { op: 'EQ', desc: 'Равно  =' },
  { op: 'NE', desc: 'Не равно  ≠' },
  { op: 'INCR', desc: 'Приращение (инкремент)' },
  { op: 'DECR', desc: 'Уменьшение (декремент)' },
];

function buildCncTable(filter = '') {
  const tbody = $('cnc-tbody');
  if (!tbody) return;
  const f = filter.toLowerCase();
  const rows = cncFunctions.filter(r => !f || r.cmd.toLowerCase().includes(f) || r.desc.toLowerCase().includes(f));
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="highlight" style="font-family:var(--font-mono)">${r.cmd}</td>
      <td style="color:var(--text-dim)">${r.desc}</td>
    </tr>
  `).join('');
}

function buildCncOpsTable() {
  const tbody = $('cnc-ops-tbody');
  if (!tbody) return;
  tbody.innerHTML = cncOperators.map(r => `
    <tr>
      <td class="highlight" style="font-family:var(--font-mono)">${r.op}</td>
      <td style="color:var(--text-dim)">${r.desc}</td>
    </tr>
  `).join('');
}

function searchCnc() {
  buildCncTable($('cnc-search').value.trim());
}


/* ===== PIPE THREAD TABLE ===== */
// Fallback data (from Image 6)
const pipeThreadDataFallback = [
  { size: '1/16"', steps: 27, pitch: 0.941, id: 6.389, d0_nom: 6.00, d0_tol: '-0.16', d0_nom2: 6.39, d0_tol2: '+0.09', depth: 13, plain_nom: 6.3, plain_tol: '+0.14' },
  { size: '1/8"',  steps: 27, pitch: 0.941, id: 8.766, d0_nom: 8.30, d0_tol: '-0.20', d0_nom2: 8.76, d0_tol2: '+0.09', depth: 14, plain_nom: 8.7, plain_tol: '+0.14' },
  { size: '1/4"',  steps: 18, pitch: 1.411, id: 11.314, d0_nom: 10.70, d0_tol: '-0.24', d0_nom2: 11.31, d0_tol2: '-0.13', depth: 20, plain_nom: 11.2, plain_tol: '-0.24' },
  { size: '3/8"',  steps: 18, pitch: 1.411, id: 14.797, d0_nom: 14.25, d0_tol: '-0.24', d0_nom2: 14.80, d0_tol2: '-0.13', depth: 21, plain_nom: 14.7, plain_tol: '-0.24' },
  { size: '1/2"',  steps: 14, pitch: 1.814, id: 18.321, d0_nom: 17.50, d0_tol: '-0.28', d0_nom2: 18.32, d0_tol2: '-0.17', depth: 26.5, plain_nom: 18.25, plain_tol: '-0.24' },
  { size: '3/4"',  steps: 14, pitch: 1.814, id: 23.666, d0_nom: 22.90, d0_tol: '-0.28', d0_nom2: 23.66, d0_tol2: '-0.17', depth: 26.5, plain_nom: 23.50, plain_tol: '-0.28' },
  { size: '1"',    steps: 11, pitch: 2.209, id: 29.694, d0_nom: 28.75, d0_tol: '-0.28', d0_nom2: 29.69, d0_tol2: '-0.17', depth: 33.5, plain_nom: 29.6, plain_tol: '-0.28' },
  { size: '1 1/4"',steps:11, pitch: 2.209, id: 38.451, d0_nom: 37.43, d0_tol: '-0.34', d0_nom2: 38.45, d0_tol2: '-0.17', depth: 34.5, plain_nom: 38.5, plain_tol: '-0.34' },
  { size: '1 1/8"',steps:11, pitch: 2.209, id: 44.520, d0_nom: 43.50, d0_tol: '-0.34', d0_nom2: 44.52, d0_tol2: null,    depth: 34.5, plain_nom: null, plain_tol: null },
];

let pipeThreadData = pipeThreadDataFallback;

async function loadPipeThreadsFromApi() {
  const data = await apiGet('/api/ref/threads/pipe');
  if (data && Array.isArray(data) && data.length > 0) {
    // Backend shape: {sizeLabel, threadsPerInch, pitchMm, innerDia, drillTaperNom, drillTaperTol, drillTaperNom2, drillTaperTol2, drillDepth, drillPlainNom, drillPlainTol}
    pipeThreadData = data.map(r => ({
      size: r.sizeLabel, steps: r.threadsPerInch, pitch: r.pitchMm, id: r.innerDia,
      d0_nom: r.drillTaperNom, d0_tol: r.drillTaperTol,
      d0_nom2: r.drillTaperNom2, d0_tol2: r.drillTaperTol2,
      depth: r.drillDepth, plain_nom: r.drillPlainNom, plain_tol: r.drillPlainTol
    }));
  }
  buildPipeTable();
}

function buildPipeTable() {
  const tbody = $('pipe-tbody');
  if (!tbody) return;
  tbody.innerHTML = pipeThreadData.map(r => `
    <tr>
      <td class="highlight">${r.size}</td>
      <td>${r.steps}</td>
      <td>${r.pitch}</td>
      <td>${r.id}</td>
      <td>${r.d0_nom}</td>
      <td>${r.d0_tol}</td>
      <td>${r.d0_nom2 ?? '—'}</td>
      <td>${r.d0_tol2 ?? '—'}</td>
      <td>${r.depth}</td>
      <td>${r.plain_nom ?? '—'}</td>
      <td>${r.plain_tol ?? '—'}</td>
    </tr>
  `).join('');
}


/* ===== CALC: CUTTING SPEED ===== */
function calcVtoN() {
  const V = parseFloat($('cut-V').value);
  const D = parseFloat($('cut-D').value);
  if (isNaN(V) || isNaN(D) || D <= 0) return;
  const n = (1000 * V) / (Math.PI * D);
  $('cut-n-res').textContent = fmt(n, 0) + ' об/мин';
  revealResult('cut-n-box');
}

function calcNtoV() {
  const n = parseFloat($('cut-N2').value);
  const D = parseFloat($('cut-D2').value);
  if (isNaN(n) || isNaN(D) || D <= 0) return;
  const V = (Math.PI * D * n) / 1000;
  $('cut-v-res').textContent = fmt(V, 2) + ' м/мин';
  revealResult('cut-v-box');
}

function calcFeed() {
  const fz = parseFloat($('cut-fz').value);
  const z  = parseFloat($('cut-z').value);
  const n  = parseFloat($('cut-n-feed').value);
  if (isNaN(fz) || isNaN(z) || isNaN(n)) return;
  const F = fz * z * n;
  const frev = fz * z;
  $('cut-feed-res').textContent = fmt(F, 1) + ' мм/мин';
  $('cut-frev-res').textContent = fmt(frev, 4) + ' мм/об';
  revealResult('cut-feed-box');
}


/* ===== CALC: METRIC THREAD DRILL ===== */
// Fallback data [d, pitch_coarse, d1, d2]
const metricThreadsFallback = [
  [1,   0.25, 0.693, 0.838],
  [1.2, 0.25, 0.893, 1.038],
  [1.4, 0.3,  1.032, 1.205],
  [1.6, 0.35, 1.171, 1.373],
  [2,   0.4,  1.509, 1.740],
  [2.5, 0.45, 1.948, 2.208],
  [3,   0.5,  2.387, 2.675],
  [3.5, 0.6,  2.764, 3.110],
  [4,   0.7,  3.141, 3.545],
  [5,   0.8,  4.019, 4.480],
  [6,   1.0,  4.773, 5.350],
  [7,   1.0,  5.773, 6.350],
  [8,   1.25, 6.466, 7.188],
  [9,   1.25, 7.466, 8.188],
  [10,  1.5,  8.160, 9.026],
  [11,  1.5,  9.160, 10.026],
  [12,  1.75, 9.853, 10.863],
  [14,  2.0,  11.546, 12.701],
  [16,  2.0,  13.546, 14.701],
  [18,  2.5,  15.046, 16.376],
  [20,  2.5,  17.046, 18.376],
  [22,  2.5,  19.046, 20.376],
  [24,  3.0,  20.319, 22.051],
  [27,  3.0,  23.319, 25.051],
  [30,  3.5,  25.706, 27.727],
  [33,  3.5,  28.706, 30.727],
  [36,  4.0,  31.093, 33.402],
  [39,  4.0,  34.093, 36.402],
  [42,  4.5,  36.479, 39.077],
  [45,  4.5,  39.479, 42.077],
  [48,  5.0,  41.866, 44.752],
  [52,  5.0,  45.866, 48.752],
  [56,  5.5,  49.252, 52.428],
  [60,  5.5,  53.252, 56.428],
  [64,  6.0,  56.639, 60.103],
  [68,  6.0,  60.639, 64.103],
];

let metricThreads = metricThreadsFallback;

async function loadMetricThreadsFromApi() {
  const data = await apiGet('/api/ref/threads/metric');
  if (data && Array.isArray(data) && data.length > 0) {
    // Backend shape: {nominalD, pitchCoarse, d1, d2, ...}
    metricThreads = data.map(r => [r.nominalD, r.pitchCoarse, r.d1, r.d2]);
  }
  buildThreadTable();
}

function buildThreadTable() {
  const tbody = $('thread-tbody');
  if (!tbody) return;
  tbody.innerHTML = metricThreads.map(r => {
    const [d, p, d1, d2] = r;
    const drill_steel = d - p;
    const drill_al = d - 1.05 * p;
    return `<tr>
      <td class="highlight">M${d}×${p}</td>
      <td>${p}</td>
      <td>${fmt(d1, 3)}</td>
      <td>${fmt(d2, 3)}</td>
      <td>${fmt(drill_steel, 2)}</td>
      <td>${fmt(drill_al, 2)}</td>
    </tr>`;
  }).join('');
}

function calcThreadDrill() {
  const d = parseFloat($('thr-d').value);
  const p = parseFloat($('thr-p').value);
  const k = parseFloat($('thr-mat').value);
  if (isNaN(d) || isNaN(p)) return;
  const drill = d - k * p;
  const d1 = d - 1.0825 * p; // exact formula
  const d2 = d - 0.6495 * p;
  $('thr-drill').textContent = fmt(drill, 3) + ' мм';
  $('thr-d1').textContent = fmt(d1, 3) + ' мм';
  $('thr-d2').textContent = fmt(d2, 3) + ' мм';
  revealResult('thr-result-box');
}


/* ===== CALC: TOLERANCES ===== */
// IT number multipliers (factors × i)
const itFactors = { IT5: 7, IT6: 10, IT7: 16, IT8: 25, IT9: 40, IT10: 64, IT11: 100, IT12: 160 };
const itSelectMap = { 7: 'IT6', 10: 'IT7', 16: 'IT8', 25: 'IT9', 40: 'IT10', 64: 'IT11', 100: 'IT12' };

function calcTolerance() {
  const D = parseFloat($('fit-D').value);
  const itKey = parseInt($('fit-IT').value);
  if (isNaN(D) || D <= 0) return;

  // Standard tolerance unit: i = 0.45*D^(1/3) + 0.001*D  (D in mm, i in µm)
  // Use geometric mean of range for D
  const i = 0.45 * Math.pow(D, 1/3) + 0.001 * D;
  const itName = itSelectMap[itKey] || 'IT7';
  const factor = itKey; // the select value IS the factor
  const IT_um = factor * i;
  const IT_mm = IT_um / 1000;

  $('fit-i').textContent = fmt(i, 3) + ' мкм';
  $('fit-IT-val').textContent = fmt(IT_um, 1) + ' мкм';
  $('fit-IT-mm').textContent = fmt(IT_mm, 4) + ' мм';
  revealResult('fit-result-box');
}


/* ===== CALC: SPEED TABLE ===== */
const stdDiameters = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400];

function calcSpeedFromN() {
  const D = parseFloat($('spd-D').value);
  const n = parseFloat($('spd-N').value);
  if (isNaN(D) || isNaN(n) || D <= 0) return;
  const V = Math.PI * D * n / 1000;
  $('spd-V').value = fmt(V, 1);
  $('spd-n-out').textContent = fmt(n, 0) + ' об/мин';
  $('spd-v-out').textContent = fmt(V, 2) + ' м/мин';
  $('spd-circ').textContent = fmt(Math.PI * D, 2) + ' мм';
}

function calcSpeedFromV() {
  const D = parseFloat($('spd-D').value);
  const V = parseFloat($('spd-V').value);
  if (isNaN(D) || isNaN(V) || D <= 0) return;
  const n = 1000 * V / (Math.PI * D);
  $('spd-N').value = fmt(n, 0);
  $('spd-n-out').textContent = fmt(n, 0) + ' об/мин';
  $('spd-v-out').textContent = fmt(V, 2) + ' м/мин';
  $('spd-circ').textContent = fmt(Math.PI * D, 2) + ' мм';
}

function calcSpeedBoth() {
  const D = parseFloat($('spd-D').value);
  const n = parseFloat($('spd-N').value);
  const V = parseFloat($('spd-V').value);
  if (isNaN(D) || D <= 0) return;
  if (!isNaN(n)) calcSpeedFromN();
  else if (!isNaN(V)) calcSpeedFromV();
}

function buildSpeedTable() {
  const tbody = $('speed-tbl-body');
  if (!tbody) return;
  const V = parseFloat($('spd-tbl-V').value) || 100;
  tbody.innerHTML = stdDiameters.map(D => {
    const n_half = 1000 * (V/2) / (Math.PI * D);
    const n_full = 1000 * V / (Math.PI * D);
    const n_dbl  = 1000 * (V*2) / (Math.PI * D);
    return `<tr>
      <td class="highlight">${D}</td>
      <td>${Math.round(n_half)}</td>
      <td style="color:var(--accent);font-weight:600">${Math.round(n_full)}</td>
      <td>${Math.round(n_dbl)}</td>
    </tr>`;
  }).join('');
}


/* ===== TAB SWITCH MOTION ===== */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    document.querySelectorAll(`.tab-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`.tab-content[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    target?.classList.add('active');
    if (target && window.gsap) {
      gsap.fromTo(target, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power1.out' });
    }
  });
});


/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Render instantly from local fallback data — zero wait, works offline
  buildRoughnessTable();
  buildHardnessTable();
  buildCncTable();
  buildCncOpsTable();
  buildPipeTable();
  buildThreadTable();
  buildSpeedTable();

  // 2. Quietly refresh from backend in the background. If the backend is
  //    asleep, slow, or unreachable, the page already works from fallback
  //    data above — user never sees a loading state or an error.
  loadHardnessFromApi();
  loadRoughnessFromApi();
  loadMetricThreadsFromApi();
  loadPipeThreadsFromApi();

  // 3. Home grid: a quiet staggered settle, like a drawing index being laid out
  if (window.gsap) {
    gsap.from('.home-card', {
      opacity: 0, y: 10, duration: 0.4, stagger: 0.035, ease: 'power2.out', delay: 0.1
    });
  }
});
