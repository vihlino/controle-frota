/**
 * ==========================================================
 * SITRA - Auditoria
 * ==========================================================
 */

const LoggerService = {

  log(user, action, module, description) {

    const sheet = Database.getSheet(CONFIG.SHEETS.LOGS);

    sheet.appendRow([

      Helpers.uuid(),

      Helpers.now(),

      user,

      action,

      module,

      description

    ]);

  }

};