// assets/js/statistics.js
import { globalState, ID_COLS } from './state.js';

export function renderDescriptive() {
  const container = document.getElementById('descContent');
  const empty     = document.getElementById('descEmpty');
  const banner    = document.getElementById('descBanner');
  const leg       = document.getElementById('cvLegend');

  // Se não houver dados, mostra o estado vazio
  if (!globalState.parsedData || !globalState.parsedData.length) {
    empty.style.display = 'flex'; 
    container.style.display = 'none'; 
    banner.style.display = 'none'; 
    if (leg) leg.style.display = 'none';
    return;
  }

  // Se houver dados, mostra a interface
  empty.style.display = 'none'; 
  container.style.display = 'block';
  if (leg) leg.style.display = 'flex';

  const headers = Object.keys(globalState.parsedData[0]);
  const varCols = headers.filter(h => ID_COLS.indexOf(h.toUpperCase()) === -1);
  const trKey   = headers.find(h => h.toUpperCase() === 'TR') || 'TR';
  const perKey  = headers.find(h => h.toUpperCase() === 'PER') || null;

  // Extrai tratamentos únicos e ordena
  let tSet = {}, treatments = [];
  globalState.parsedData.forEach(r => { 
    if(!tSet[r[trKey]]) { tSet[r[trKey]] = true; treatments.push(r[trKey]); } 
  });
  treatments.sort((a,b) => a - b);

  // Extrai períodos (se houver)
  let periods = [null];
  if(perKey) { 
    let pSet = {}; 
    periods = []; 
    globalState.parsedData.forEach(r => { 
      if(!pSet[r[perKey]]) { pSet[r[perKey]] = true; periods.push(r[perKey]); } 
    }); 
    periods.sort((a,b) => a - b); 
  }

  // Atualiza o Banner com o resumo
  banner.style.display = 'block';
  banner.innerHTML = `<span class="desc-banner-icon">📐</span><div>Aba <strong>"${globalState.activeSheet}"</strong> — <strong>${treatments.length}</strong> trat. · <strong>${varCols.length}</strong> var. · <strong>${globalState.parsedData.length}</strong> linhas</div>`;
  
  container.innerHTML = '';

  // Gera as tabelas para cada variável
  varCols.forEach(varName => {
    let section = document.createElement('div');
    section.className = 'desc-section';
    section.innerHTML = `<div class="desc-var-header"><span class="desc-var-name">${varName}</span><span class="desc-var-label">Estatística descritiva por tratamento${perKey?' e periodo':''}</span></div>`;
    
    periods.forEach(per => {
      let perRows = perKey ? globalState.parsedData.filter(r => String(r[perKey]) === String(per)) : globalState.parsedData;
      
      if(perKey && per !== null) {
        let l = document.createElement('p');
        l.className = 'desc-per-label';
        l.textContent = 'Período: ' + per;
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

// === FUNÇÕES MATEMÁTICAS E DE CONSTRUÇÃO DE TABELA ===

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
  
  return {
    n: n, 
    mean: fmt(mean, 3), 
    median: fmt(median, 3), 
    sd: fmt(sd, 3), 
    se: fmt(se, 3), 
    cv: cv !== null ? fmt(cv, 2) : null, 
    min: fmt(sorted[0], 3), 
    max: fmt(sorted[n-1], 3)
  };
}

function buildDescTable(statsByTR) {
  let wrap = document.createElement('div');
  wrap.className = 'desc-table-wrap';

  let h = '<table class="desc-table"><thead><tr>';
  h += '<th class="stat-col-hdr">Tratamentos</th>';
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
    { key:'n',      label:'n',       decimals:0, isCV:false },
    { key:'mean',   label:'Média',   decimals:4, isCV:false },
    { key:'median', label:'Mediana', decimals:4, isCV:false },
    { key:'sd',     label:'DP',      decimals:4, isCV:false },
    { key:'se',     label:'EP',      decimals:6, isCV:false },
    { key:'cv',     label:'CV (%)',  decimals:2, isCV:true  },
    { key:'min',    label:'Mín',     decimals:4, isCV:false },
    { key:'max',    label:'Máx',     decimals:4, isCV:false },
    { key:'na',     label:'NA',      decimals:0, isCV:false },
  ];

  const generalVals = { n: totalN, mean: gM, median: null, sd: pSD, se: totalSE, cv: gCV, min: gMin, max: gMax, na: tNA };

  rows.forEach((row, rowIdx) => {
    h += `<tr><td class="stat-row-label">${row.label}</td>`;

    statsByTR.forEach(x => {
      let val = row.key === 'na' ? x.naCount : x.stats[row.key];
      let s   = x.stats;

      if (row.isCV) {
        if (val !== null && val !== '—' && !isNaN(val)) {
          h += `<td><span class="cv-badge ${cvCls(val)}">${parseFloat(val).toFixed(row.decimals)}%</span></td>`;
        } else { h += '<td>—</td>'; }
      } else if (row.key === 'na') {
        h += `<td class="${val > 0 ? 'na-cell' : ''}">${val}</td>`;
      } else if (val === null || val === undefined || val === '—' || !s.n) {
        h += '<td>—</td>';
      } else {
        h += `<td>${parseFloat(val).toFixed(row.decimals)}</td>`;
      }
    });

    let gVal = generalVals[row.key];
    if (row.isCV) {
      if (gVal !== null && !isNaN(gVal)) {
        h += `<td class="global-col"><span class="cv-badge ${cvCls(gVal)}">${parseFloat(gVal).toFixed(row.decimals)}%</span></td>`;
      } else { h += '<td class="global-col">—</td>'; }
    } else if (row.key === 'na') {
      h += `<td class="global-col ${gVal > 0 ? 'na-cell' : ''}">${gVal}</td>`;
    } else if (row.key === 'median') {
      h += '<td class="global-col">—</td>';
    } else if (gVal === null || gVal === undefined || !totalN) {
      h += '<td class="global-col">—</td>';
    } else {
      h += `<td class="global-col">${parseFloat(gVal).toFixed(row.decimals)}</td>`;
    }
    h += '</tr>';
  });

  wrap.innerHTML = h + '</tbody></table>';
  return wrap;
}

function cvCls(cv) { return cv < 10 ? 'cv-low' : cv < 20 ? 'cv-medium' : cv < 30 ? 'cv-high' : 'cv-veryhigh'; }
function fmt(v, d) { if(v === null || v === undefined || isNaN(v)) return '—'; return parseFloat(v.toFixed(d)); }