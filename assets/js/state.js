// assets/js/state.js
// assets/js/state.js

// O globalState guarda as informações lidas do Excel para o sistema todo usar
export const globalState = {
  workbook: null,
  activeSheet: null,
  parsedData: null,
  decimalMode: null
};

// Colunas obrigatórias nas planilhas do GEAVES
export const ID_COLS = ['TR', 'REP', 'PER'];