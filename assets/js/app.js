// assets/js/app.js
import { setupDropzone } from './dados.js';
import { renderDescriptive } from './statistics.js';
import { renderCharts } from './charts.js';

// ── NOVA FUNÇÃO DE CARREGAMENTO DE VIEWS ──
async function loadView(elementId, filePath) {
  try {
    const response = await fetch(filePath);
    if (response.ok) {
      const html = await response.text();
      document.getElementById(elementId).innerHTML = html;
    } else {
      console.error("Erro ao carregar o arquivo:", filePath);
    }
  } catch (error) {
    console.error("Erro de rede ao tentar carregar a view:", error);
  }
}

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
    
    // Assim que a página abre, ele vai buscar o arquivo silenciosamente no fundo
    loadView('tab-instructions', 'assets/views/instrucoes.html');
});

window.switchTab = switchTab;

console.log("App carregado. Sistema de Views ativado.");