/**
 * ==========================================================
 * SITRA - Plataforma de Gestão Pública
 * ----------------------------------------------------------
 * Arquivo: Database.gs
 * ----------------------------------------------------------
 * Responsabilidade:
 * Centralizar todo o acesso ao Google Sheets.
 *
 * Nenhum outro arquivo poderá acessar
 * SpreadsheetApp diretamente.
 *
 * Autor: Vitória Lino
 * Arquitetura: ChatGPT + Vitória
 * Versão: 1.0.0
 * ==========================================================
 */

const Database = (() => {

  /**
   * Cache interno das planilhas.
   * Evita chamadas repetidas ao Google Sheets.
   */
  const cache = {};

  /**
   * Retorna a planilha principal.
   */
  function getSpreadsheet() {

    return SpreadsheetApp.getActiveSpreadsheet();

  }

  /**
   * Retorna uma aba pelo nome.
   * Utiliza cache para melhorar desempenho.
   */
  function getSheet(sheetName) {

    if (!cache[sheetName]) {

      cache[sheetName] =
        getSpreadsheet().getSheetByName(sheetName);

      if (!cache[sheetName]) {

        throw new Error(
          `A aba "${sheetName}" não foi encontrada.`
        );

      }

    }

    return cache[sheetName];

  }

  /**
   * Limpa o cache.
   */
  function clearCache() {

    Object.keys(cache).forEach(key => delete cache[key]);

  }

  /**
   * Retorna todas as linhas da planilha.
   */
  function getAll(sheetName) {

    const sheet = getSheet(sheetName);

    return sheet.getDataRange().getValues();

  }

  /**
   * Insere uma nova linha.
   */
  function append(sheetName, row) {

    getSheet(sheetName).appendRow(row);

  }

  /**
   * Última linha utilizada.
   */
  function getLastRow(sheetName) {

    return getSheet(sheetName).getLastRow();

  }

  /**
   * Última coluna utilizada.
   */
  function getLastColumn(sheetName) {

    return getSheet(sheetName).getLastColumn();

  }

  /**
   * Atualiza uma linha inteira.
   */
  function updateRow(sheetName, rowNumber, values) {

    getSheet(sheetName)
      .getRange(rowNumber, 1, 1, values.length)
      .setValues([values]);

  }

  /**
   * Remove uma linha.
   */
  function deleteRow(sheetName, rowNumber) {

    getSheet(sheetName)
      .deleteRow(rowNumber);

  }

  /**
   * Limpa o conteúdo de uma aba.
   */
  function clear(sheetName) {

    getSheet(sheetName).clearContents();

  }

  return {

    getSpreadsheet,

    getSheet,

    getAll,

    append,

    updateRow,

    deleteRow,

    getLastRow,

    getLastColumn,

    clear,

    clearCache

  };

})();