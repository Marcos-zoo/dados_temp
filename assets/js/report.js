// assets/js/report.js
import { globalState } from './state.js';

export async function generateFullPDF() {
  // Muda o texto do botão para avisar que está carregando
  const btn = document.getElementById('btnGeneratePdf');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) btn.innerHTML = '⏳ Gerando PDF... Aguarde.';

  try {
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.color = '#2A1005';
    element.style.fontFamily = 'Source Sans 3, sans-serif';

    // --- CABEÇALHO DO RELATÓRIO ---
    const header = `
      <div style="text-align: center; border-bottom: 2px solid #8B1A1A; margin-bottom: 30px; padding-bottom: 10px;">
        <h1 style="margin: 0; color: #8B1A1A;">Relatório Técnico DataAves</h1>
        <p style="margin: 5px 0;">GEAVES - Grupo de Estudos em Avicultura (UFRPE)</p>
        <p style="font-size: 0.85rem; color: #6B3A1F;">Data do Relatório: ${new Date().toLocaleDateString('pt-BR')} | Aba: ${globalState.activeSheet}</p>
      </div>
    `;
    element.innerHTML += header;

    // --- SEÇÃO 1: ESTATÍSTICA ---
    element.innerHTML += '<h2 style="border-left: 5px solid #E8900A; padding-left: 10px; color: #8B1A1A;">1. Estatística Descritiva</h2>';
    const statsContent = document.getElementById('descContent').innerHTML;
    // Diminuímos um pouco a fonte da tabela para caber melhor no A4
    element.innerHTML += `<div class="pdf-stats-section" style="font-size: 0.80rem;">${statsContent}</div>`;

    // Quebra de página
    element.innerHTML += '<div style="page-break-before: always;"></div>';

    // --- SEÇÃO 2: GRÁFICOS ---
    element.innerHTML += '<h2 style="border-left: 5px solid #E8900A; padding-left: 10px; color: #8B1A1A; margin-top: 30px;">2. Análise Gráfica</h2>';
    
    // Procura todos os gráficos que foram renderizados na tela
    const chartDivs = document.querySelectorAll('.chart-card-body div[id^="chart_"]');
    
    if (chartDivs.length > 0) {
      for (let i = 0; i < chartDivs.length; i++) {
        // Pede ao Plotly para transformar o gráfico numa imagem PNG de alta qualidade
        const dataUrl = await window.Plotly.toImage(chartDivs[i], { format: 'png', width: 800, height: 450 });
        element.innerHTML += `
          <div style="margin-bottom: 24px; text-align: center;">
            <img src="${dataUrl}" style="max-width: 100%; border: 1px solid #e0e0e0; border-radius: 8px;" />
          </div>
        `;
      }
    } else {
      // Se a pessoa não abriu a aba gráficos ainda, eles não existem na memória.
      element.innerHTML += `
        <div style="padding: 20px; background: #fdf8f0; border: 1px solid #f0c870; border-radius: 8px; color: #7a4a00;">
          ⚠️ <strong>Aviso:</strong> Nenhum gráfico foi encontrado.<br>
          Para incluir os gráficos no PDF, você precisa visitar a aba "Gráficos" pelo menos uma vez para que o sistema os desenhe.
        </div>`;
    }

    // --- CONFIGURAÇÃO DO PDF ---
    const opt = {
      margin:       10,
      filename:     `DataAves_Relatorio_${globalState.activeSheet}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Gera e salva o PDF
    await window.html2pdf().set(opt).from(element).save();
    
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Ocorreu um erro ao gerar o PDF. Verifique se os gráficos carregaram corretamente.");
  } finally {
    // Restaura o botão ao normal
    if (btn) btn.innerHTML = '📄 Gerar Relatório PDF';
  }
}

// Expõe para o HTML
window.generateFullPDF = generateFullPDF;