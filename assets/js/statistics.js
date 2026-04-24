// assets/js/statistics.js
import { globalState, ID_COLS } from './state.js';

export function renderDescriptive() {
  const container = document.getElementById('descContent');
  const empty     = document.getElementById('descEmpty');
  const banner    = document.getElementById('descBanner');
  const leg       = document.getElementById('cvLegend');

  if (!globalState.parsedData || !globalState.parsedData.length) {
    empty.style.display = 'flex'; 
    container.style.display = 'none'; 
    banner.style.display = 'none'; 
    if (leg) leg.style.display = 'none';
    return;
  }

  empty.style.display = 'none'; 
  container.style.display = 'block';
  if (leg) leg.style.display = 'flex';

  const headers = Object.keys(globalState.parsedData[0]);
  const varCols = headers.filter(h => ID_COLS.indexOf(h.toUpperCase()) === -1);
  const trKey   = headers.find(h => h.toUpperCase() === 'TR') || 'TR';
  const perKey  = headers.find(h => h.toUpperCase() === 'PER') || null;

  let tSet = {}, treatments = [];
  globalState.parsedData.forEach(r => { 
    if(!tSet[r[trKey]]) { tSet[r[trKey]] = true; treatments.push(r[trKey]); } 
  });
  treatments.sort((a,b) => a - b);

  let periods = [null];
  if(perKey) { 
    let pSet = {}; 
    periods = []; 
    globalState.parsedData.forEach(r => { 
      if(!pSet[r[perKey]]) { pSet[r[perKey]] = true; periods.push(r[perKey]); } 
    }); 
    periods.sort((a,b) => a - b); 
  }

  banner.style.display = 'flex';
  banner.style.justifyContent = 'space-between';
  banner.style.alignItems = 'center';
  
  // AQUI FORAM AJUSTADAS AS CORES E ADICIONADO O ID "btnGeneratePdf"
  banner.innerHTML = `
    <div style="display:flex; align-items:center; gap:14px;">
      <span class="desc-banner-icon">📐</span>
      <div>Aba <strong>"${globalState.activeSheet}"</strong> — <strong>${treatments.length}</strong> trat. · <strong>${varCols.length}</strong> var.</div>
    </div>
    <div style="display:flex; gap:10px;">
      <button onclick="exportDescriptiveToExcel()" class="hero-btn" style="padding: 8px 16px; font-size: 0.85rem; background: var(--amber); color: #fff;">
        ⬇ Excel
      </button>
      <button onclick="generateFullPDF()" id="btnGeneratePdf" class="hero-btn" style="padding: 8px 16px; font-size: 0.85rem; background: var(--rust); color: #fff;">
        📄 Gerar Relatório PDF
      </button>
    </div>
  `;
  
  container.innerHTML = '';

  varCols.forEach(varName => {
    let section = document.createElement('div');
    section.className = 'desc-section';
    section.innerHTML = `<div class="desc-var-header"><span class="desc-var-name">${varName}</span><span class="desc-var-label">Estatística descritiva por tratamento${perKey?' e período':''}</span></div>`;
    
    periods.forEach(per => {
      let perRows = perKey ? globalState.parsedData.filter(r => String(r[perKey]) === String(per)) : globalState.parsedData;
      if(perKey && per !== null) {
        let l = document.createElement('p'); l.className = 'desc-per-label'; l.textContent = 'Período: ' + per;
        section.appendChild(l);
      }
      let statsByTR = treatments.map(tr => {
        let rows = perRows.filter(r => String(r[trKey]) === String(tr));
        let values = rows.map(r => r[varName]).filter(v => v !== 'NA' && v !== '' && v !== null && v !== undefined && typeof v === 'number');
        return { tr: tr, stats: computeStats(values), naCount: rows.length - values.length };
      });
      section.appendChild(buildDescTable(statsByTR));
    });
    container.appendChild(section);
  });
}

// ── FUNÇÃO DE EXPORTAÇÃO PARA EXCEL ──
export function exportDescriptiveToExcel() {
  if (!globalState.parsedData) return;

  const headers = Object.keys(globalState.parsedData[0]);
  const varCols = headers.filter(h => ID_COLS.indexOf(h.toUpperCase()) === -1);
  const trKey   = headers.find(h => h.toUpperCase() === 'TR') || 'TR';
  const perKey  = headers.find(h => h.toUpperCase() === 'PER') || null;

  let tSet = {}, treatments = [];
  globalState.parsedData.forEach(r => { if(!tSet[r[trKey]]) { tSet[r[trKey]] = true; treatments.push(r[trKey]); } });
  treatments.sort((a,b) => a - b);

  let periods = [null];
  if(perKey) { 
    let pSet = {}; periods = []; 
    globalState.parsedData.forEach(r => { if(!pSet[r[perKey]]) { pSet[r[perKey]] = true; periods.push(r[perKey]); } }); 
    periods.sort((a,b) => a - b); 
  }

  let aoa = [];

  varCols.forEach(varName => {
    aoa.push([`VARIÁVEL: ${varName}`]);
    
    periods.forEach(per => {
      if(perKey) aoa.push([`Período: ${per}`]);
      
      let headerRow = ["Estatística", ...treatments, "Geral"];
      aoa.push(headerRow);

      let perRows = perKey ? globalState.parsedData.filter(r => String(r[perKey]) === String(per)) : globalState.parsedData;
      let statsByTR = treatments.map(tr => {
        let rows = perRows.filter(r => String(r[trKey]) === String(tr));
        let values = rows.map(r => r[varName]).filter(v => typeof v === 'number');
        return { stats: computeStats(values), naCount: rows.length - values.length };
      });

      let totalN = statsByTR.reduce((s,x) => s + x.stats.n, 0);
      let gM = null, gSD = null, tNA = statsByTR.reduce((s,x)=>s+x.naCount, 0);
      if(totalN) {
        gM = statsByTR.reduce((s,x) => s + (x.stats.n ? x.stats.mean * x.stats.n : 0), 0) / totalN;
        let pV = statsByTR.reduce((s,x) => x.stats.n < 2 ? s : s + (x.stats.n - 1) * Math.pow(x.stats.sd, 2), 0) / Math.max(totalN - statsByTR.filter(x=>x.stats.n).length, 1);
        gSD = Math.sqrt(pV);
      }

      const metrics = [
        { l: 'n', k: 'n' }, { l: 'Média', k: 'mean' }, { l: 'DP', k: 'sd' }, 
        { l: 'EP', k: 'se' }, { l: 'CV (%)', k: 'cv' }, { l: 'Mín', k: 'min' }, 
        { l: 'Máx', k: 'max' }, { l: 'NA', k: 'na' }
      ];

      metrics.forEach(m => {
        let row = [m.l];
        statsByTR.forEach(x => { row.push(m.k === 'na' ? x.naCount : x.stats[m.k]); });
        if (m.k === 'mean') row.push(gM);
        else if (m.k === 'sd') row.push(gSD);
        else if (m.k === 'cv') row.push(gM ? (gSD/gM)*100 : null);
        else if (m.k === 'na') row.push(tNA);
        else if (m.k === 'n') row.push(totalN);
        else row.push(null);
        aoa.push(row);
      });
      aoa.push([]); 
    });
    aoa.push([]); 
  });

  const ws = window.XLSX.utils.aoa_to_sheet(aoa);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Estatística");
  window.XLSX.writeFile(wb, `DataAves_Estatistica_${globalState.activeSheet}.xlsx`);
}

window.exportDescriptiveToExcel = exportDescriptiveToExcel;

function computeStats(values) {
  let n = values.length;
  if(!n) return {n:0, mean:null, median:null, sd:null, cv:null, min:null, max:null, se:null};
  let sorted = values.slice().sort((a,b) => a - b);
  let sum = values.reduce((a,v) => a + v, 0);
  let mean = sum / n;
  let mid = Math.floor(n/2);
  let median = n % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  let variance = n > 1 ? values.reduce((a,v) => a + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
  let sd = Math.sqrt(variance);
  let se = n > 1 ? sd / Math.sqrt(n) : 0;
  let cv = mean ? (sd / Math.abs(mean)) * 100 : null;
  return { n, mean, median, sd, se, cv, min: sorted[0], max: sorted[n-1] };
}

function buildDescTable(statsByTR) {
  let wrap = document.createElement('div');
  wrap.className = 'desc-table-wrap';
  let h = '<table class="desc-table"><thead><tr><th class="stat-col-hdr">Tratamentos</th>';
  statsByTR.forEach(x => { h += `<th>${x.tr}</th>`; });
  h += '<th class="global-col-hdr">Geral</th></tr></thead><tbody>';
  let totalN = statsByTR.reduce((s,x) => s + x.stats.n, 0);
  let gM = null, gMin = null, gMax = null, tNA = 0, pSD = null, gCV = null, totalSE = null;
  if (totalN) {
    gM = statsByTR.reduce((s,x) => s + (x.stats.n ? x.stats.mean * x.stats.n : 0), 0) / totalN;
    let validSt = statsByTR.filter(x => x.stats.n);
    gMin = Math.min(...validSt.map(x => x.stats.min));
    gMax = Math.max(...validSt.map(x => x.stats.max));
    tNA  = statsByTR.reduce((s,x) => s + x.naCount, 0);
    let pV = statsByTR.reduce((s,x) => x.stats.n < 2 ? s : s + (x.stats.n - 1) * Math.pow(x.stats.sd, 2), 0) / Math.max(totalN - validSt.length, 1);
    pSD  = Math.sqrt(pV);
    gCV  = gM ? (pSD / Math.abs(gM)) * 100 : null;
    totalSE = totalN > 1 ? pSD / Math.sqrt(totalN) : null;
  }
  const rows = [
    { key:'n', label:'n', decimals:0 }, { key:'mean', label:'Média', decimals:4 },
    { key:'median', label:'Mediana', decimals:4 }, { key:'sd', label:'DP', decimals:4 },
    { key:'se', label:'EP', decimals:6 }, { key:'cv', label:'CV (%)', decimals:2, isCV:true },
    { key:'min', label:'Mín', decimals:4 }, { key:'max', label:'Máx', decimals:4 },
    { key:'na', label:'NA', decimals:0 }
  ];
  const generalVals = { n: totalN, mean: gM, median: null, sd: pSD, se: totalSE, cv: gCV, min: gMin, max: gMax, na: tNA };
  rows.forEach(row => {
    h += `<tr><td class="stat-row-label">${row.label}</td>`;
    statsByTR.forEach(x => {
      let val = row.key === 'na' ? x.naCount : x.stats[row.key];
      if (row.isCV && val !== null) h += `<td><span class="cv-badge ${cvCls(val)}">${parseFloat(val).toFixed(row.decimals)}%</span></td>`;
      else if (val === null || (row.key !== 'na' && !x.stats.n)) h += '<td>—</td>';
      else h += `<td>${parseFloat(val).toFixed(row.decimals)}</td>`;
    });
    let gVal = generalVals[row.key];
    if (row.isCV && gVal !== null) h += `<td class="global-col"><span class="cv-badge ${cvCls(gVal)}">${parseFloat(gVal).toFixed(row.decimals)}%</span></td>`;
    else if (gVal === null) h += '<td class="global-col">—</td>';
    else h += `<td class="global-col">${parseFloat(gVal).toFixed(row.decimals)}</td>`;
    h += '</tr>';
  });
  wrap.innerHTML = h + '</tbody></table>';
  return wrap;
}

function cvCls(cv) { return cv < 10 ? 'cv-low' : cv < 20 ? 'cv-medium' : cv < 30 ? 'cv-high' : 'cv-veryhigh'; }
function fmt(v, d) { if(v === null || v === undefined || isNaN(v)) return '—'; return parseFloat(v.toFixed(d)); }