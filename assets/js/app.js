// assets/js/app.js
import { setupDropzone } from './dados.js';
import { renderDescriptive } from './statistics.js';
import { renderCharts } from './charts.js';
import { generateFullPDF } from './report.js'; // O PDF é importado aqui!

function switchTab(tabId, btnEl) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');
  if (btnEl) btnEl.classList.add('active');

  if (tabId === 'descriptive') {
    renderDescriptive();
  }
  if (tabId === 'charts') {
    setTimeout(() => renderCharts(), 50); 
  }
}

document.addEventListener('DOMContentLoaded', () => {
    setupDropzone();
});

window.switchTab = switchTab;

console.log("App carregado. Todos os botões e PDF estão online!");