// BridgeSense SPA — hash routing + localStorage + chart
const STATE_KEY = 'bridgeSenseState';
let chartRef = null;

// State helpers
function getState(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }catch(e){ return {}; } }
function setState(patch){
  const cur = getState();
  const next = { ...cur, ...patch, lastUpdated: Date.now() };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  return next;
}

// Models
const weights = { age: 0.30, crack: 0.20, load: 0.30, env: 0.20 };
function computeBHS({ age=0, crack=0, actualLoad=0, designLoad=1, envYears=0 }){
  const ageScore = Math.max(0, 100 - (age * 0.8));
  const crackScore = Math.max(0, 100 - ((crack / 3) * 50)); // safe crack 3 cm
  const loadRatio = actualLoad / Math.max(1, designLoad);
  const loadScore = loadRatio <= 1 ? 100 : Math.max(0, 100 - ((loadRatio - 1) * 100));
  const envScore = Math.max(0, 100 - (envYears * 6));
  const bhs = Math.round(ageScore*weights.age + crackScore*weights.crack + loadScore*weights.load + envScore*weights.env);
  let condition = 'High Risk'; if (bhs >= 81) condition = 'Safe'; else if (bhs >= 41) condition = 'Moderate';
  return { bhs, scores:{ageScore, crackScore, loadScore, envScore}, condition };
}
function computeCurve({ R=0, V=0 }){
  const idx = (V / Math.max(1, R)) * 10;
  let status = 'Unsafe'; if (idx <= 6) status = 'Safe'; else if (idx <= 12) status = 'Moderate';
  const safeSpeed = Math.round(6 * R / 10);
  return { idx, status, safeSpeed };
}

// Routing
function setActiveNav(page){
  document.querySelectorAll('.nav a').forEach(a=>{
    if (a.dataset.page === page) a.classList.add('active'); else a.classList.remove('active');
  });
}
function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`); if (el) el.classList.add('active');
  setActiveNav(page);
  if (page === 'bhs') initBHSPage();
  if (page === 'curve') initCurvePage();
  if (page === 'summary') initSummaryPage();
}
function route(){
  const hash = (location.hash || '#bhs').replace('#','');
  const page = ['bhs','curve','summary'].includes(hash) ? hash : 'bhs';
  showPage(page);
}
window.addEventListener('hashchange', route);

// Page: BHS
function initBHSPage(){
  const st = getState();
  const nameEl = document.getElementById('bridgeName');
  const ageEl = document.getElementById('age');
  const crackEl = document.getElementById('crack');
  const actualEl = document.getElementById('actualLoad');
  const designEl = document.getElementById('designLoad');
  const envEl = document.getElementById('envYears');
  const outBHS = document.getElementById('bhsOutput');
  const outCond = document.getElementById('condOutput');
  const toast = document.getElementById('toastBHS');

  if (st?.bhs){
    nameEl.value = st.bhs.name || '';
    ageEl.value = st.bhs.age ?? 25;
    crackEl.value = st.bhs.crack ?? 2;
    actualEl.value = st.bhs.actualLoad ?? 120;
    designEl.value = st.bhs.designLoad ?? 150;
    envEl.value = st.bhs.envYears ?? 5;

    if (typeof st.bhs.bhs === 'number'){
      const cls = st.bhs.bhs >= 81 ? 'result-green' : st.bhs.bhs >= 41 ? 'result-yellow' : 'result-red';
      const txt = st.bhs.bhs >= 81 ? 'Safe' : st.bhs.bhs >= 41 ? 'Moderate' : 'High Risk';
      outBHS.innerHTML = `<span class="result-badge ${cls}">${st.bhs.bhs}</span>`;
      outCond.innerHTML = `<span class="result-badge ${cls}">${txt}</span>`;
    }
  }

  document.getElementById('btnComputeBHS').onclick = ()=>{
    const name = nameEl.value.trim() || 'Unnamed Bridge';
    const params = {
      age: Number(ageEl.value || 0),
      crack: Number(crackEl.value || 0),
      actualLoad: Number(actualEl.value || 0),
      designLoad: Number(designEl.value || 1),
      envYears: Number(envEl.value || 0)
    };
    const res = computeBHS(params);

    const cls = res.bhs >= 81 ? 'result-green' : res.bhs >= 41 ? 'result-yellow' : 'result-red';
    const txt = res.bhs >= 81 ? 'Safe' : res.bhs >= 41 ? 'Moderate' : 'High Risk';
    outBHS.innerHTML = `<span class="result-badge ${cls}">${res.bhs}</span>`;
    outCond.innerHTML = `<span class="result-badge ${cls}">${txt}</span>`;

    setState({ bhs: { name, ...params, ...res } });
    toast.textContent = 'Saved! Go to Summary & Charts.';
    toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 2000);
  };
}

// Page: Curve
function initCurvePage(){
  const st = getState();
  const rEl = document.getElementById('curveR');
  const vEl = document.getElementById('curveV');
  const outBadge = document.getElementById('curveOutput');
  const outSpeed = document.getElementById('curveSafeSpeed');
  const toast = document.getElementById('toastCurve');

  if (st?.curve){
    rEl.value = st.curve.R ?? 30;
    vEl.value = st.curve.V ?? 40;
    if (st.curve.status){
      const cls = st.curve.status === 'Safe' ? 'result-green' : st.curve.status === 'Moderate' ? 'result-yellow' : 'result-red';
      outBadge.innerHTML = `<span class="result-badge ${cls}">${st.curve.status}</span>`;
      outSpeed.textContent = `${st.curve.safeSpeed} km/h (${st.curve.status})`;
    }
  }

  document.getElementById('btnCurve').onclick = ()=>{
    const R = Number(rEl.value || 0);
    const V = Number(vEl.value || 0);
    const res = computeCurve({ R, V });

    const cls = res.status === 'Safe' ? 'result-green' : res.status === 'Moderate' ? 'result-yellow' : 'result-red';
    outBadge.innerHTML = `<span class="result-badge ${cls}">${res.status}</span>`;
    outSpeed.textContent = `${res.safeSpeed} km/h (${res.status})`;

    setState({ curve: { R, V, ...res } });
    toast.textContent = 'Saved! Go to Summary & Charts.';
    toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 2000);
  };
}

// Page: Summary
function initSummaryPage(){
  const st = getState();
  const name = st?.bhs?.name || '—';
  const bhs = st?.bhs?.bhs;
  const curveSafe = st?.curve?.safeSpeed;
  const curveStatus = st?.curve?.status;

  document.getElementById('s_name').textContent = name;
  document.getElementById('s_bhs').textContent = (typeof bhs === 'number') ? bhs : '—';

  const cEl = document.getElementById('s_cond');
  cEl.innerHTML = '—';
  if (typeof bhs === 'number'){
    const cls = bhs >= 81 ? 'result-green' : bhs >= 41 ? 'result-yellow' : 'result-red';
    const txt = bhs >= 81 ? 'Safe' : bhs >= 41 ? 'Moderate' : 'High Risk';
    cEl.innerHTML = `<span class="result-badge ${cls}">${txt}</span>`;
  }

  const sEl = document.getElementById('s_speed');
  sEl.textContent = (typeof curveSafe === 'number') ? `${curveSafe} km/h (${curveStatus})` : '—';

  const noDataNote = document.getElementById('noDataNote');
  const scores = st?.bhs?.scores;
  if (!scores || !window.Chart){ noDataNote.style.display = 'block'; return; }
  noDataNote.style.display = 'none';

  const ctx = document.getElementById('bhsChart').getContext('2d');
  if (chartRef) chartRef.destroy();
  chartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Age','Crack','Load','Environment'],
      datasets: [{
        label:'Parameter Score (0–100)',
        data: [scores.ageScore, scores.crackScore, scores.loadScore, scores.envScore].map(x=>Math.round(x)),
        borderRadius:8,
        backgroundColor: ['#6ea8ff','#7bdff2','#a78bfa','#fbbf24']
      }]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{
        y:{ beginAtZero:true, max:100, grid:{ color:'rgba(255,255,255,0.08)'} },
        x:{ grid:{ color:'rgba(255,255,255,0.06)'} }
      }
    }
  });
}

// Start
document.addEventListener('DOMContentLoaded', ()=>{
  // nav pills
  document.querySelectorAll('.nav a').forEach(a=>{
    a.addEventListener('click', ()=>{/* hashchange will route */});
  });
  // initial route
  route();
});