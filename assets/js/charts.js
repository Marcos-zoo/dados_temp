// assets/js/charts.js
import { globalState, ID_COLS } from './state.js';

let chartType   = 'bar';    // 'bar' | 'line' | 'box' | 'violin'
let chartLayout = 'grid';   // 'grid' | 'single'
let errorType   = 'sd';     // 'sd' | 'se'
let perMode     = 'treatments'; // 'treatments' | 'periods'
let currentIdx  = 0;
let chartVars   = [];

const COLORS = ['#8B1A1A','#C8540A','#E8900A','#5A3E1B','#A0522D', '#D2691E','#6B3A1F','#CD853F','#B8860B','#8B4513'];

export function renderCharts() {
  const empty = document.getElementById('chartsEmpty');
  const main  = document.getElementById('chartsMain');
  
  if (!globalState.parsedData || !globalState.parsedData.length) {
    empty.style.display = 'flex'; main.style.display = 'none'; return;
  }
  
  empty.style.display = 'none'; main.style.display = 'block';

  const headers = Object.keys(globalState.parsedData[0]);
  chartVars = headers.filter(h => ID_COLS.indexOf(h.toUpperCase()) === -1);

  const perKey = headers.find(h => h.toUpperCase()==='PER');
  document.getElementById('perModeGroup').style.display = perKey ? 'flex' : 'none';

  refreshCharts();
}

function refreshCharts() {
  if (!globalState.parsedData || !chartVars.length) return;
  const grid = document.getElementById('chartsGrid');
  const nav  = document.getElementById('chartsNav');
  grid.innerHTML = '';

  const headers = Object.keys(globalState.parsedData[0]);
  const trKey   = headers.find(h => h.toUpperCase()==='TR') || 'TR';
  const perKey  = headers.find(h => h.toUpperCase()==='PER') || null;

  let tSet={}, treatments=[];
  globalState.parsedData.forEach(r => { if(!tSet[r[trKey]]){tSet[r[trKey]]=true;treatments.push(r[trKey]);} });
  treatments.sort((a,b) => a-b);

  let periods = [null];
  if (perKey) {
    let pSet={}; periods=[];
    globalState.parsedData.forEach(r => { if(!pSet[r[perKey]]){pSet[r[perKey]]=true;periods.push(r[perKey]);} });
    periods.sort((a,b) => a-b);
  }

  const varsToRender = chartLayout === 'single' ? [chartVars[currentIdx]] : chartVars;

  if (chartLayout === 'single') {
    grid.className = 'charts-grid single-mode';
    nav.style.display = 'flex';
    document.getElementById('navInfo').textContent = (currentIdx+1) + ' / ' + chartVars.length + ' — ' + chartVars[currentIdx];
  } else {
    grid.className = 'charts-grid';
    nav.style.display = 'none';
  }

  varsToRender.forEach(varName => {
    const card = document.createElement('div');
    card.className = 'chart-card';
    const divId  = 'chart_' + varName.replace(/[^a-zA-Z0-9]/g,'_');
    const yMinId = 'ymin_' + divId;
    const yMaxId = 'ymax_' + divId;

    card.innerHTML = `
      <div class="chart-card-title">
        <span>${varName}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="font-size:0.68rem;opacity:0.85;">Y:</label>
          <input type="number" id="${yMinId}" placeholder="mín" class="card-axis-input" oninput="applyCardAxis('${divId}','${yMinId}','${yMaxId}')">
          <span style="font-size:0.75rem;opacity:0.7;">–</span>
          <input type="number" id="${yMaxId}" placeholder="máx" class="card-axis-input" oninput="applyCardAxis('${divId}','${yMinId}','${yMaxId}')">
          <button class="chart-dl-btn" onclick="downloadChart('${divId}','${varName}')">⬇ PNG</button>
        </div>
      </div>
      <div class="chart-card-body">
        <div id="${divId}" style="width:100%;height:${chartLayout==='single'?'500':'320'}px;"></div>
      </div>`;

    grid.appendChild(card);

    let traces = [];
    let layout = buildPlotLayout(varName, treatments, periods);

    if (chartType === 'box') {
      traces = buildDistributionTraces(varName, trKey, perKey, treatments, periods, 'box');
    } else if (chartType === 'violin') {
      traces = buildDistributionTraces(varName, trKey, perKey, treatments, periods, 'violin');
    } else if (perKey && perMode === 'periods') {
      traces = buildPeriodTraces(varName, trKey, perKey, treatments, periods);
    } else {
      traces = buildTreatmentTraces(varName, trKey, perKey, treatments, periods);
    }

    window.Plotly.newPlot(divId, traces, layout, {
      responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d','select2d','autoScale2d']
    });

    const gYMin = parseFloat(document.getElementById('yMin').value);
    const gYMax = parseFloat(document.getElementById('yMax').value);
    if (!isNaN(gYMin) && !isNaN(gYMax)) {
      document.getElementById(yMinId).value = gYMin;
      document.getElementById(yMaxId).value = gYMax;
    }
  });
}

// Helper matemático local para os gráficos
function getChartStats(values) {
  const n = values.length;
  if(!n) return {n:0, mean:null, sd:null, se:null};
  const sum = values.reduce((a,v)=>a+v,0);
  const mean = sum/n;
  const variance = n>1 ? values.reduce((a,v)=>a+Math.pow(v-mean,2),0)/(n-1) : 0;
  const sd = Math.sqrt(variance);
  return { n, mean, sd, se: n>1 ? sd/Math.sqrt(n) : 0 };
}

function buildTreatmentTraces(varName, trKey, perKey, treatments, periods) {
  const traces = [];
  const xLabels = treatments.map(String);
  const seriesList = perKey ? periods : [null];

  seriesList.forEach((per, pIdx) => {
    const rows = perKey ? globalState.parsedData.filter(r => String(r[perKey])===String(per)) : globalState.parsedData;
    let means=[], errors=[], ns=[];
    
    treatments.forEach(tr => {
      const vals = rows.filter(r => String(r[trKey])===String(tr)).map(r => r[varName]).filter(v => typeof v==='number');
      const st = getChartStats(vals);
      means.push(st.n ? st.mean : null);
      errors.push(st.n ? (errorType==='sd' ? st.sd : st.se) : null);
      ns.push(st.n);
    });

    const color  = COLORS[pIdx % COLORS.length];
    const sName  = perKey ? 'Período ' + per : varName;
    const hoverT = xLabels.map((x,i) => `Trat: ${x}<br>Média: ${means[i]!==null?means[i].toFixed(4):'NA'}<br>${errorType==='sd'?'DP':'EP'}: ${errors[i]!==null?errors[i].toFixed(4):'NA'}<br>n: ${ns[i]}`);

    if (chartType === 'bar') {
      traces.push({
        type: 'bar', name: sName, x: xLabels, y: means,
        error_y: { type:'data', array: errors, visible:true, color: color, thickness:2, width:8 },
        marker: { color: color, opacity: 0.88, line:{color:'rgba(0,0,0,0.15)',width:1} },
        hovertext: hoverT, hoverinfo: 'text',
        hoverlabel: { bgcolor: '#fff', bordercolor: color, font:{color:'#2A1005'} }
      });
    } else {
      traces.push({
        type: 'scatter', mode: 'lines+markers', name: sName, x: xLabels, y: means,
        error_y: { type:'data', array: errors, visible:true, color: color, thickness:2, width:8 },
        line: { color: color, width:2.5 },
        marker: { color: color, size:9, symbol:'circle', line:{color:'#fff',width:1.5} },
        hovertext: hoverT, hoverinfo: 'text'
      });
    }
  });
  if (traces.length) traces[0]._categoryarray = xLabels;
  return traces;
}

function buildPeriodTraces(varName, trKey, perKey, treatments, periods) {
  const traces = [];
  const xLabels = periods.map(String);

  treatments.forEach((tr, tIdx) => {
    const trRows = globalState.parsedData.filter(r => String(r[trKey])===String(tr));
    let means=[], errors=[], ns=[];

    periods.forEach(per => {
      const vals = trRows.filter(r => String(r[perKey])===String(per)).map(r => r[varName]).filter(v => typeof v==='number');
      const st = getChartStats(vals);
      means.push(st.n ? st.mean : null);
      errors.push(st.n ? (errorType==='sd' ? st.sd : st.se) : null);
      ns.push(st.n);
    });

    const color = COLORS[tIdx % COLORS.length];
    traces.push({
      type: chartType==='bar'?'bar':'scatter', mode: chartType==='bar'?'none':'lines+markers', name: 'Trat. '+tr,
      x: xLabels, y: means,
      error_y: {type:'data',array:errors,visible:true,color:color,thickness:2,width:6},
      marker: chartType==='bar' ? {color:color,opacity:0.85} : {color:color,size:8},
      line: chartType==='bar' ? undefined : {color:color,width:2.5}
    });
  });
  return traces;
}

// Essa função agora constrói tanto o Boxplot quanto o Violino
function buildDistributionTraces(varName, trKey, perKey, treatments, periods, type) {
  const traces = [];
  const seriesList = perKey ? periods : [null];

  seriesList.forEach((per, pIdx) => {
    const rows = perKey ? globalState.parsedData.filter(r => String(r[perKey])===String(per)) : globalState.parsedData;

    treatments.forEach((tr, tIdx) => {
      const vals = rows.filter(r => String(r[trKey])===String(tr)).map(r => r[varName]).filter(v => typeof v==='number');
      if (!vals.length) return;

      const color = COLORS[(perKey ? pIdx : tIdx) % COLORS.length];
      const lbl   = perKey ? `T${tr} P${per}` : String(tr);

      let traceObj = {
        name: lbl, y: vals, x: vals.map(()=>lbl),
        marker: { color: color, size: 4, opacity: 0.7 },
        line: { color: color, width: 2 }
      };

      if (type === 'violin') {
        traceObj.type = 'violin';
        traceObj.box = { visible: true }; // Mostra um mini-boxplot dentro do violino
        traceObj.meanline = { visible: true };
        traceObj.points = 'all';
        traceObj.jitter = 0.3;
        traceObj.fillcolor = color.replace(')', ',0.15)').replace('rgb','rgba');
      } else {
        traceObj.type = 'box';
        traceObj.boxpoints = 'all';
        traceObj.jitter = 0.35;
        traceObj.fillcolor = color.replace(')', ',0.15)').replace('rgb','rgba');
      }

      traces.push(traceObj);
    });
  });
  return traces;
}

function buildPlotLayout(varName, treatments, periods) {
  const yMin = parseFloat(document.getElementById('yMin').value);
  const yMax = parseFloat(document.getElementById('yMax').value);
  const isBoxOrViolin = chartType === 'box' || chartType === 'violin';
  const hasPer = document.getElementById('perModeGroup').style.display !== 'none';
  const xTitle = isBoxOrViolin ? '' : (perMode === 'periods' && hasPer ? 'Período' : 'Tratamento');

  const catArray = perMode === 'periods' && hasPer && periods ? periods.map(String) : treatments.map(String);

  const layout = {
    margin: { l:56, r:20, t:18, b:60 },
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#fdf9f5',
    font: { family:'Source Sans 3, sans-serif', size:12, color:'#2A1005' },
    legend: { orientation:'h', y:-0.28, x:0.5, xanchor:'center' },
    xaxis: { type: 'category', categoryorder: 'array', categoryarray: catArray, title: { text: xTitle, standoff:10 } },
    yaxis: { title: { text: varName } }
  };
  if (!isNaN(yMin) && !isNaN(yMax)) layout.yaxis.range = [yMin, yMax];
  return layout;
}

// ══ EXPOSIÇÃO GLOBAL PARA OS BOTÕES DO HTML ══
window.setChartType = (type, btn) => {
  chartType = type;
  document.querySelectorAll('#chartTypeGroup .toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('errorBarGroup').style.display = (type === 'box' || type === 'violin') ? 'none' : 'flex';
  refreshCharts();
};

window.setLayout = (layout, btn) => {
  chartLayout = layout;
  document.querySelectorAll('#layoutGroup .toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentIdx = 0; refreshCharts();
};

window.setErrorType = (type, btn) => {
  errorType = type;
  document.querySelectorAll('#errorTypeGroup .toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  refreshCharts();
};

window.setPerMode = (mode, btn) => {
  perMode = mode;
  document.querySelectorAll('#perModeButtons .toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  refreshCharts();
};

window.navigateChart = (dir) => {
  currentIdx = Math.max(0, Math.min(chartVars.length - 1, currentIdx + dir));
  refreshCharts();
};

window.applyCardAxis = (divId, yMinId, yMaxId) => {
  const yMin = parseFloat(document.getElementById(yMinId).value);
  const yMax = parseFloat(document.getElementById(yMaxId).value);
  const update = (!isNaN(yMin) && !isNaN(yMax) && yMax > yMin) ? {'yaxis.range':[yMin, yMax], 'yaxis.autorange':false} : {'yaxis.autorange':true};
  window.Plotly.relayout(divId, update);
};

window.propagateGlobalY = () => {
  const gYMin = parseFloat(document.getElementById('yMin').value);
  const gYMax = parseFloat(document.getElementById('yMax').value);
  if (isNaN(gYMin) || isNaN(gYMax) || gYMax <= gYMin) return;
  chartVars.forEach(varName => {
    const divId = 'chart_' + varName.replace(/[^a-zA-Z0-9]/g,'_');
    const yMinEl = document.getElementById('ymin_'+divId);
    const yMaxEl = document.getElementById('ymax_'+divId);
    if (!yMinEl || !yMaxEl) return;
    yMinEl.value = gYMin; yMaxEl.value = gYMax;
    window.applyCardAxis(divId, 'ymin_'+divId, 'ymax_'+divId);
  });
};

window.downloadChart = (divId, varName) => {
  window.Plotly.downloadImage(document.getElementById(divId), { format:'png', filename: 'DataAves_'+varName, width:1200, height:700, scale:2 });
};

window.exportCurrentPNG = () => {
  const varName = chartLayout==='single' ? chartVars[currentIdx] : chartVars[0];
  window.downloadChart('chart_' + varName.replace(/[^a-zA-Z0-9]/g,'_'), varName);
};

window.exportAllPNG = () => {
  chartVars.forEach(varName => {
    const el = document.getElementById('chart_' + varName.replace(/[^a-zA-Z0-9]/g,'_'));
    if (el) window.Plotly.downloadImage(el, { format:'png', filename:'DataAves_'+varName, width:1200, height:700, scale:2 });
  });
};