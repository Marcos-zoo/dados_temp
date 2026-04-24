
// assets/js/app.js
import { setupDropzone } from './dados.js';
import { renderDescriptive } from './statistics.js';
import { renderCharts } from './charts.js'; // <-- Novo import!

function switchTab(tabId, btnEl) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');
  if (btnEl) btnEl.classList.add('active');

  // Direcionamento das abas
  if (tabId === 'descriptive') {
    renderDescriptive();
  }
  if (tabId === 'charts') {
    // Usamos um pequeno atraso (setTimeout) porque o Plotly precisa que a div
    // já esteja visível na tela para calcular a largura do gráfico corretamente.
    setTimeout(() => renderCharts(), 50); 
  }
}

document.addEventListener('DOMContentLoaded', () => {
    setupDropzone();
});

window.switchTab = switchTab;

console.log("App carregado. Todos os módulos online!");