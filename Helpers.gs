/**
 * ==========================================================
 * SITRA - Helpers
 * ==========================================================
 */

const Helpers = {

  uuid() {

    return Utilities.getUuid();

  },

  now() {

    return new Date();

  },

  formatDate(date) {

    return Utilities.formatDate(
      new Date(date),
      Session.getScriptTimeZone(),
      "dd/MM/yyyy"
    );

  },

  formatDateTime(date) {

    return Utilities.formatDate(
      new Date(date),
      Session.getScriptTimeZone(),
      "dd/MM/yyyy HH:mm:ss"
    );

  },

  onlyNumbers(value) {

    return String(value).replace(/\D/g, "");

  },

  isEmpty(value) {

    return value === null ||
           value === undefined ||
           value === "";

  },

  capitalize(text) {

    if (!text) return "";

    return text
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());

  }

};