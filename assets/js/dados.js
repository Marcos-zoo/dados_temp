// assets/js/dados.js
import { globalState, ID_COLS } from './state.js';

/* ══ CONFIGURAÇÃO DO UPLOAD (ARRASTAR E CLICAR) ══ */
export function setupDropzone() {
  const dz = document.getElementById('dropzone');
  const fi = document.getElementById('fileInput');

  if (!dz || !fi) return;

  // Quando clica no retângulo, simula o clique no input de arquivo oculto
  dz.addEventListener('click', () => fi.click());
  
  // Efeitos visuais ao arrastar o arquivo por cima
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dz-hover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dz-hover'));
  
  // Quando solta o arquivo
  dz.addEventListener('drop', e => {
    e.preventDefault(); 
    dz.classList.remove('dz-hover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  // Quando escolhe pelo clique
  fi.addEventListener('change', e => { 
    if (e.target.files[0]) handleFile(e.target.files[0]); 
  });
}

function handleFile(file) {
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    showFileInfo('Arquivo inválido. Envie um .xlsx ou .xls.', 'error'); return;
  }
  const r = new FileReader();
  r.onload = e => {
    try {
      // O window.XLSX vem da biblioteca que importamos no index.html
      globalState.workbook = window.XLSX.read(e.target.result, { type: 'array' });
      showFileInfo('<strong>' + file.name + '</strong> — ' + (file.size/1024).toFixed(1) + ' KB', 'ok');
      populateSheetButtons(globalState.workbook.SheetNames);
      resetResults();
    } catch(err) { showFileInfo('Não foi possível ler o arquivo.', 'error'); }
  };
  r.readAsArrayBuffer(file);
}

function showFileInfo(html, type) {
  const el = document.getElementById('fileInfo');
  el.innerHTML = html;
  el.className = 'file-info ' + type;
}

function populateSheetButtons(names) {
  document.getElementById('sheetCount').textContent = names.length;
  const c = document.getElementById('sheetButtons');
  c.innerHTML = '';
  names.forEach(name => {
    const btn = document.createElement('button');
    btn.className   = 'sheet-pill';
    btn.textContent = name;
    btn.onclick     = () => selectSheet(name, btn);
    c.appendChild(btn);
  });
  document.getElementById('sheetSection').style.display   = 'block';
  document.getElementById('decimalSection').style.display = 'none';
  document.getElementById('btnValidate').classList.add('hidden');
  globalState.activeSheet = null;
  globalState.parsedData  = null;
}

function selectSheet(name, btnEl) {
  document.querySelectorAll('.sheet-pill').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  globalState.activeSheet = name;
  
  const raw = window.XLSX.utils.sheet_to_json(globalState.workbook.Sheets[name], { header:1, raw:false, defval:'' });
  if (raw.length < 2) {
    showDecimalBadge('none');
    globalState.parsedData = null;
    document.getElementById('btnValidate').classList.add('hidden');
    return;
  }
  const result = normalizeDecimals(raw);
  globalState.decimalMode = result.mode;
  globalState.parsedData  = result.data;
  showDecimalBadge(globalState.decimalMode);
  document.getElementById('btnValidate').classList.remove('hidden');
  document.getElementById('btnReset').classList.add('hidden');
  resetResults();
}

function normalizeDecimals(raw) {
  let commas = 0, points = 0;
  for (let r = 1; r < raw.length; r++)
    for (let c = 0; c < raw[r].length; c++) {
      let v = String(raw[r][c]).trim();
      if (!v || v.toUpperCase() === 'NA') continue;
      if (/^\d+,\d+$/.test(v)) commas++;
      if (/^\d+\.\d+$/.test(v)) points++;
    }
  let mode = commas && !points ? 'comma' : points && !commas ? 'point' : commas && points ? 'mixed' : 'none';
  let headers = raw[0].map(h => String(h).trim());
  let data = [];
  for (let r = 1; r < raw.length; r++) {
    let row = raw[r];
    if (row.every(c => !String(c).trim())) continue;
    let obj = {};
    headers.forEach((h, i) => {
      let cell = String(row[i] !== undefined && row[i] !== null ? row[i] : '').trim();
      if (cell.toUpperCase() === 'NA') obj[h] = 'NA';
      else if (!cell)                  obj[h] = '';
      else {
        let n = parseFloat(cell.replace(',', '.'));
        obj[h] = isNaN(n) ? cell : n;
      }
    });
    data.push(obj);
  }
  return { mode: mode, data: data };
}

function showDecimalBadge(mode) {
  const M = {
    comma: { cls:'dec-warn', text:'Vírgula detectada. Convertido para ponto automaticamente.' },
    point: { cls:'dec-ok',   text:'Ponto decimal. Nenhuma conversão necessária.' },
    mixed: { cls:'dec-err',  text:'Mistura de vírgula e ponto! Verifique a planilha.' },
    none:  { cls:'dec-info', text:'Nenhum decimal encontrado nesta aba.' }
  };
  const m = M[mode] || M.none;
  const el = document.getElementById('decimalInfo');
  el.className   = 'decimal-badge ' + m.cls;
  el.textContent = m.text;
  document.getElementById('decimalSection').style.display = 'block';
}

/* ══ VALIDAÇÃO (REGRAS GEAVES) ══ */
function runValidationAndRender() {
  if (!globalState.parsedData || !globalState.parsedData.length) return;
  const headers = Object.keys(globalState.parsedData[0]);
  let checks = [], errors = [];

  const hasTR  = headers.some(h => h.toUpperCase()==='TR');
  const hasREP = headers.some(h => h.toUpperCase()==='REP');
  checks.push({ label:'Colunas obrigatórias TR e REP presentes', ok: hasTR && hasREP,
    detail: !hasTR&&!hasREP?'TR e REP ausentes.':!hasTR?'TR ausente.':!hasREP?'REP ausente.':null });
  if (!hasTR||!hasREP) errors.push({ rule:'Colunas obrigatórias', message:'TR e/ou REP não encontradas.' });

  const badSym = headers.filter(h => /[%$*@#!?&()/\\]/.test(h));
  checks.push({ label:'Cabeçalhos sem símbolos proibidos', ok:!badSym.length,
    detail: badSym.length ? 'Colunas: '+badSym.join(', ') : null });
  if (badSym.length) errors.push({ rule:'Símbolos proibidos', message:badSym.join(', ') });

  const badFmt = headers.filter(h => /[áéíóúãõâêîôûàçÁÉÍÓÚÃÕÂÊÎÔÛÀÇ]/.test(h) || / /.test(h));
  checks.push({ label:'Cabeçalhos sem espaços ou acentos', ok:!badFmt.length,
    detail: badFmt.length ? 'Colunas: '+badFmt.join(', ') : null });
  if (badFmt.length) errors.push({ rule:'Espaços/acentos', message:badFmt.join(', ') });

  let seen={}, dupes=[];
  headers.forEach(h => { let k=h.toUpperCase(); if(seen[k]) dupes.push(h); seen[k]=true; });
  checks.push({ label:'Sem siglas duplicadas', ok:!dupes.length,
    detail: dupes.length ? 'Duplicatas: '+dupes.join(', ') : null });
  if (dupes.length) errors.push({ rule:'Siglas duplicadas', message:dupes.join(', ') });

  let empRows=[];
  globalState.parsedData.forEach((row,i) => {
    let ec=headers.filter(h => { let v=row[h]; return v===''||v===null||v===undefined; });
    if(ec.length) empRows.push({row:i+2,cols:ec});
  });
  checks.push({ label:'Sem células vazias — parcelas perdidas devem ser NA', ok:!empRows.length,
    detail: empRows.length ? empRows.length+' linha(s) com célula vazia' : null });
  empRows.forEach(r => { errors.push({ rule:'Célula vazia', message:'Linha '+r.row+': use NA.' }); });

  const varCols = headers.filter(h => ID_COLS.indexOf(h.toUpperCase())===-1);
  let nonNum=[];
  globalState.parsedData.forEach((row,i) => {
    varCols.forEach(col => {
      let v=row[col];
      if(v==='NA'||v===''||v===null||v===undefined) return;
      if(typeof v!=='number') nonNum.push({row:i+2,col:col,val:v});
    });
  });
  checks.push({ label:'Variáveis de resposta numéricas (ou NA)', ok:!nonNum.length,
    detail: nonNum.length ? nonNum.length+' não-numérica(s)' : null });
  nonNum.slice(0,20).forEach(r => { errors.push({ rule:'Valor não-numérico', message:'Linha '+r.row+', "'+r.col+'": "'+r.val+'"' }); });

  checks.push({ label:'Separador decimal consistente', ok: globalState.decimalMode!=='mixed',
    detail: globalState.decimalMode==='mixed' ? 'Mistura de vírgula e ponto detectada.' : null });
  if (globalState.decimalMode==='mixed') errors.push({ rule:'Decimal misto', message:'Mistura detectada.' });

  renderResults(checks, errors, headers);
  document.getElementById('btnReset').classList.remove('hidden');
}

function renderResults(checks, errors, headers) {
  document.getElementById('resultsEmpty').style.display   = 'none';
  document.getElementById('resultsContent').style.display = 'block';
  const allOk  = !errors.length;
  const banner = document.getElementById('summaryBanner');
  banner.className = 'summary-banner ' + (allOk ? 'banner-ok' : 'banner-err');
  banner.innerHTML = allOk
    ? '<span class="banner-icon">✅</span><div><strong>Todas as '+checks.length+' regras GEAVES satisfeitas.</strong></div>'
    : '<span class="banner-icon">⚠️</span><div><strong>'+errors.length+' problema(s)</strong> em '+checks.filter(c=>!c.ok).length+' regra(s). Corrija antes de prosseguir.</div>';
  document.getElementById('previewSheetName').textContent  = globalState.activeSheet;
  document.getElementById('previewDimensions').textContent = globalState.parsedData.length+' linha(s) x '+headers.length+' coluna(s) — aba: "'+globalState.activeSheet+'"';
  renderPreviewTable(headers);
  document.getElementById('checklistItems').innerHTML = checks.map(c => 
    `<div class="check-item ${c.ok?'check-ok':'check-fail'}"><span class="check-icon">${c.ok?'OK':'ERRO'}</span><div><span class="check-label">${c.label}</span>${c.detail?`<span class="check-detail">${c.detail}</span>`:''}</div></div>`
  ).join('');
  const eb = document.getElementById('errorDetails');
  if (errors.length) {
    eb.style.display='block';
    document.getElementById('errorList').innerHTML = errors.map(e => 
      `<div class="error-item"><span class="error-rule">${e.rule}</span><span class="error-msg">${e.message}</span></div>`
    ).join('');
  } else { eb.style.display='none'; }
}

function renderPreviewTable(headers) {
  let html=`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  globalState.parsedData.slice(0,8).forEach(row => {
    html+=`<tr>${headers.map(h => {
      let v=row[h];
      if(v==='NA') return '<td class="cell-na">NA</td>';
      if(v===''||v===null||v===undefined) return '<td class="cell-empty">vazio</td>';
      return `<td>${v}</td>`;
    }).join('')}</tr>`;
  });
  if(globalState.parsedData.length>8) html+=`<tr><td colspan="${headers.length}" style="text-align:center;padding:8px;font-style:italic;">... mais ${globalState.parsedData.length-8} linha(s)</td></tr>`;
  document.getElementById('previewTableWrap').innerHTML=html+'</tbody></table>';
}

function resetResults() {
  document.getElementById('resultsEmpty').style.display   = 'flex';
  document.getElementById('resultsContent').style.display = 'none';
}

function resetUpload() {
  globalState.workbook = globalState.activeSheet = globalState.parsedData = globalState.decimalMode = null;
  document.getElementById('fileInput').value              = '';
  document.getElementById('fileInfo').className           = 'file-info hidden';
  document.getElementById('sheetSection').style.display   = 'none';
  document.getElementById('decimalSection').style.display = 'none';
  document.getElementById('btnValidate').classList.add('hidden');
  document.getElementById('btnReset').classList.add('hidden');
  resetResults();
}

// Como os botões HTML usam onclick="runValidationAndRender()" e onclick="resetUpload()",
// precisamos deixá-los visíveis globalmente.
window.runValidationAndRender = runValidationAndRender;
window.resetUpload = resetUpload;