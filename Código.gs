/**
 * Checklist de Frota - CMTT
 * Backend em Google Apps Script.
 *
 * Como usar:
 * 1) Crie uma Planilha Google nova.
 * 2) Extensões > Apps Script.
 * 3) Apague o conteúdo padrão de "Code.gs" e cole este arquivo inteiro no lugar.
 * 4) Crie um arquivo HTML novo chamado exatamente "Index" e cole o conteúdo de Index.html nele.
 * 5) Implantar > Nova implantação > tipo "App da Web" > Executar como "Eu" > Quem pode acessar "Qualquer pessoa".
 * 6) Copie o link do App da Web gerado - é esse link que vai no QR Code genérico.
 *    Cada veículo tem também o seu próprio QR Code (link + "?v=<id do veículo>"), disponível
 *    na aba "Veículos" do painel de gestão - ele já abre o checklist com o veículo travado.
 *
 * Cada checklist enviado vira uma linha na aba "Entries" desta planilha.
 * Cada foto enviada é salva numa pasta do Google Drive chamada "Checklist Frota - Fotos"
 * (criada automaticamente na primeira foto) e o link fica gravado na coluna "photoUrl".
 * Motoristas cadastrados ficam na aba "Drivers" e os logins do painel de gestão na aba "Users"
 * (a senha nunca é gravada em texto puro, só o hash SHA-256 dela).
 *
 * IMPORTANTE (fuso horário): em Extensões > Apps Script > Configurações do projeto (ícone de
 * engrenagem), confira se o "Fuso horário" está definido como "(GMT-03:00) Horário Padrão de
 * Brasília - America/Sao_Paulo". Isso evita qualquer confusão de data/hora, mesmo que a
 * planilha continue guardando a data como texto puro (o que este arquivo já garante).
 */

var ENTRIES_SHEET = "Entries";
var VEHICLES_SHEET = "Vehicles";
var DRIVERS_SHEET = "Drivers";
var USERS_SHEET = "Users";
var PHOTOS_FOLDER_NAME = "Checklist Frota - Fotos";

var ENTRY_HEADERS = [
  "id", "createdAt", "vehicleId", "plate", "model", "matricula", "date",
  "percurso", "condutor", "horaSaida", "horaChegada", "kmOut", "kmIn",
  "macaco", "chaveRoda", "estepe", "photoUrl", "condutorId"
];
var VEHICLE_HEADERS = ["id", "plate", "model", "renavam", "chassi", "anoModelo", "anoFabricacao", "vinculo", "marca"];
// Nota: uma coluna "pinHash" existiu aqui até a matrícula substituir o PIN como confirmação
// de identidade no checklist. Removida do array de propósito (sempre no fim, então não muda
// o índice de nenhuma outra coluna) - se a planilha antiga ainda tiver essa 13ª coluna, ela
// só fica sem uso, sem quebrar nada.
var DRIVER_HEADERS = ["id", "status", "cnh", "phone", "name", "matricula", "docStatus",
  "cpf", "birthDate", "cnhRegistro", "cnhEmissao", "cnhValidade"];
// "mustChangePassword" fica com "1" enquanto o acesso ainda estiver com a senha provisória
// que o gestor cadastrou. No primeiro login o painel obriga a trocar, e aí o campo é limpo.
var USER_HEADERS = ["id", "username", "passwordHash", "name", "createdAt", "cpf", "email", "phone", "mustChangePassword"];

// ---------------- Web app entry point ----------------
function doGet(e) {
  var tpl = HtmlService.createTemplateFromFile("Index");
  // Se o link tiver "?v=<id do veiculo>" (QR Code individual), o formulário
  // já abre com esse veículo travado, sem opção de trocar.
  tpl.presetVehicleId = (e && e.parameter && e.parameter.v) ? String(e.parameter.v) : "";
  return tpl.evaluate()
    .setTitle("Checklist de Frota - CMTT")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

// ---------------- Sheet helpers ----------------
function getSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(name, headers) {
  var ss = getSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  // Reforça o formato "texto puro" nessas colunas TODA VEZ (não só na criação da aba),
  // pra evitar que o Sheets "corrija" data/hora/matrícula sozinho - inclusive em abas
  // que já existiam antes desse cuidado ter sido adicionado aqui.
  if (name === ENTRIES_SHEET) {
    sh.getRange("F:F").setNumberFormat("@"); // matricula
    sh.getRange("G:G").setNumberFormat("@"); // date
    sh.getRange("J:J").setNumberFormat("@"); // horaSaida
    sh.getRange("K:K").setNumberFormat("@"); // horaChegada
  }
  if (name === DRIVERS_SHEET) {
    sh.getRange("F:F").setNumberFormat("@"); // matricula
    sh.getRange("H:H").setNumberFormat("@"); // cpf
    sh.getRange("I:I").setNumberFormat("@"); // birthDate
    sh.getRange("J:J").setNumberFormat("@"); // cnhRegistro
    sh.getRange("K:K").setNumberFormat("@"); // cnhEmissao
    sh.getRange("L:L").setNumberFormat("@"); // cnhValidade
  }
  if (name === VEHICLES_SHEET) {
    sh.getRange("D:D").setNumberFormat("@"); // renavam
    sh.getRange("E:E").setNumberFormat("@"); // chassi
    sh.getRange("F:F").setNumberFormat("@"); // anoModelo
    sh.getRange("G:G").setNumberFormat("@"); // anoFabricacao
  }
  return sh;
}

// Sempre devolve a data no formato "AAAA-MM-DD", em horário de Brasília, não importa se o
// valor que veio da planilha é um Date "de verdade" (Sheets convertendo sozinho, apesar da
// formatação em texto) ou já um texto. É o que corrige o desencontro entre os filtros
// "Hoje" e "Tudo" no painel, e garante que a data seja sempre a de Brasília.
function normalizeDate_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, "America/Sao_Paulo", "yyyy-MM-dd");
  }
  var s = String(v || "").trim();
  var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  if (s) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, "America/Sao_Paulo", "yyyy-MM-dd");
  }
  return s;
}

function ensureDefaultVehicles_() {
  var sh = getOrCreateSheet_(VEHICLES_SHEET, VEHICLE_HEADERS);
  if (sh.getLastRow() < 2) {
    sh.appendRow([Utilities.getUuid(), "ABC-1234", "Fiat Strada"]);
    sh.appendRow([Utilities.getUuid(), "DEF-5678", "Chevrolet S10"]);
  }
}

// ---------------- Vehicles API ----------------
function getVehicles() {
  ensureDefaultVehicles_();
  var sh = getOrCreateSheet_(VEHICLES_SHEET, VEHICLE_HEADERS);
  var values = sh.getDataRange().getValues();
  var rows = values.slice(1).filter(function (r) { return r[0]; });
  return rows.map(function (r) {
    return {
      id: String(r[0]), plate: String(r[1]), model: String(r[2]),
      renavam: String(r[3] || ""), chassi: String(r[4] || ""),
      anoModelo: String(r[5] || ""), anoFabricacao: String(r[6] || ""),
      vinculo: String(r[7] || ""), marca: String(r[8] || "")
    };
  });
}

// Aceita tanto o formato antigo addVehicle("PLACA","MODELO") quanto um objeto com todos os
// campos novos - assim uma implantação antiga do Index.html não quebra durante a atualização.
function addVehicle(plate, model) {
  var v = (plate && typeof plate === "object") ? plate : {plate: plate, model: model};
  if (!v.plate || !String(v.plate).trim()) return getVehicles();
  var sh = getOrCreateSheet_(VEHICLES_SHEET, VEHICLE_HEADERS);
  sh.appendRow([
    Utilities.getUuid(),
    String(v.plate).trim().toUpperCase(),
    (v.model && String(v.model).trim()) || "—",
    (v.renavam && String(v.renavam).trim()) || "",
    (v.chassi && String(v.chassi).trim().toUpperCase()) || "",
    (v.anoModelo && String(v.anoModelo).trim()) || "",
    (v.anoFabricacao && String(v.anoFabricacao).trim()) || "",
    v.vinculo || "",
    (v.marca && String(v.marca).trim().toUpperCase()) || ""
  ]);
  // Renavam e chassi são códigos, não números/datas - trava como texto pra o Sheets não
  // "arredondar" nem virar notação científica.
  var lastRow = sh.getLastRow();
  sh.getRange(lastRow, 4, 1, 5).setNumberFormat("@");
  return getVehicles();
}

// Atualiza um veículo já cadastrado (botão "Editar" na aba Veículos).
function updateVehicle(id, v) {
  if (!v || !String(v.plate || "").trim()) {
    throw new Error("Informe ao menos a placa do veículo.");
  }
  var sh = getOrCreateSheet_(VEHICLES_SHEET, VEHICLE_HEADERS);
  var values = sh.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.getRange(i + 1, 2, 1, 8).setValues([[
        String(v.plate).trim().toUpperCase(),
        (v.model && String(v.model).trim()) || "—",
        (v.renavam && String(v.renavam).trim()) || "",
        (v.chassi && String(v.chassi).trim().toUpperCase()) || "",
        (v.anoModelo && String(v.anoModelo).trim()) || "",
        (v.anoFabricacao && String(v.anoFabricacao).trim()) || "",
        v.vinculo || "",
        (v.marca && String(v.marca).trim().toUpperCase()) || ""
      ]]);
      sh.getRange(i + 1, 4, 1, 5).setNumberFormat("@");
      found = true;
      break;
    }
  }
  if (!found) throw new Error("Veículo não encontrado (pode já ter sido removido).");
  return getVehicles();
}

function removeVehicle(id) {
  var sh = getOrCreateSheet_(VEHICLES_SHEET, VEHICLE_HEADERS);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      break;
    }
  }
  return getVehicles();
}

// ---------------- Drivers API (Motoristas) ----------------
function getDrivers() {
  var sh = getOrCreateSheet_(DRIVERS_SHEET, DRIVER_HEADERS);
  var values = sh.getDataRange().getValues();
  var rows = values.slice(1).filter(function (r) { return r[0]; });
  var list = rows.map(function (r) {
    return {
      id: String(r[0]), status: String(r[1]), cnh: String(r[2]), phone: String(r[3]),
      name: String(r[4]), matricula: String(r[5]), docStatus: String(r[6]),
      cpf: String(r[7] || ""), birthDate: normalizeDate_(r[8]),
      cnhRegistro: String(r[9] || ""), cnhEmissao: normalizeDate_(r[10]), cnhValidade: normalizeDate_(r[11])
    };
  });
  list.sort(function (a, b) { return a.name.localeCompare(b.name, "pt-BR"); });
  return list;
}

function addDriver(driver) {
  if (!driver || !String(driver.name || "").trim()) return getDrivers();
  var sh = getOrCreateSheet_(DRIVERS_SHEET, DRIVER_HEADERS);
  var birthDate = normalizeDate_(driver.birthDate);
  var cnhEmissao = normalizeDate_(driver.cnhEmissao);
  var cnhValidade = normalizeDate_(driver.cnhValidade);
  sh.appendRow([
    Utilities.getUuid(),
    driver.status || "disponivel",
    (driver.cnh && String(driver.cnh).trim()) || "",
    (driver.phone && String(driver.phone).trim()) || "",
    String(driver.name).trim(),
    (driver.matricula && String(driver.matricula).trim()) || "",
    driver.docStatus || "valido",
    (driver.cpf && String(driver.cpf).trim()) || "",
    birthDate,
    (driver.cnhRegistro && String(driver.cnhRegistro).trim()) || "",
    cnhEmissao,
    cnhValidade
  ]);
  // Reforça as três colunas de data como texto puro, mesmo se o Sheets tentar converter.
  var lastRow = sh.getLastRow();
  sh.getRange(lastRow, 9).setNumberFormat("@").setValue(birthDate);
  sh.getRange(lastRow, 11).setNumberFormat("@").setValue(cnhEmissao);
  sh.getRange(lastRow, 12).setNumberFormat("@").setValue(cnhValidade);
  return getDrivers();
}

// Atualiza um motorista já cadastrado (usado pelo botão "Editar" na aba Motoristas).
function updateDriver(id, driver) {
  if (!driver || !String(driver.name || "").trim()) {
    throw new Error("Informe ao menos o nome do motorista.");
  }
  var sh = getOrCreateSheet_(DRIVERS_SHEET, DRIVER_HEADERS);
  var values = sh.getDataRange().getValues();
  var birthDate = normalizeDate_(driver.birthDate);
  var cnhEmissao = normalizeDate_(driver.cnhEmissao);
  var cnhValidade = normalizeDate_(driver.cnhValidade);
  var found = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.getRange(i + 1, 2, 1, 11).setValues([[
        driver.status || "disponivel",
        (driver.cnh && String(driver.cnh).trim()) || "",
        (driver.phone && String(driver.phone).trim()) || "",
        String(driver.name).trim(),
        (driver.matricula && String(driver.matricula).trim()) || "",
        values[i][6], // docStatus não é mais editável pelo painel (status agora vem da validade da CNH) - mantém o valor antigo
        (driver.cpf && String(driver.cpf).trim()) || "",
        birthDate,
        (driver.cnhRegistro && String(driver.cnhRegistro).trim()) || "",
        cnhEmissao,
        cnhValidade
      ]]);
      sh.getRange(i + 1, 9).setNumberFormat("@").setValue(birthDate);
      sh.getRange(i + 1, 11).setNumberFormat("@").setValue(cnhEmissao);
      sh.getRange(i + 1, 12).setNumberFormat("@").setValue(cnhValidade);
      found = true;
      break;
    }
  }
  if (!found) throw new Error("Motorista não encontrado (pode já ter sido removido).");
  return getDrivers();
}

function removeDriver(id) {
  var sh = getOrCreateSheet_(DRIVERS_SHEET, DRIVER_HEADERS);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      break;
    }
  }
  return getDrivers();
}

// ---------------- Users API (login do painel de gestão) ----------------
function hashPassword_(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password), Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function ensureDefaultUser_() {
  var sh = getOrCreateSheet_(USERS_SHEET, USER_HEADERS);
  if (sh.getLastRow() < 2) {
    // Usuário inicial - troque a senha assim que possível pela aba "Usuários" do painel.
    sh.appendRow([Utilities.getUuid(), "admin", hashPassword_("frota2026"), "Administrador", new Date().getTime()]);
  }
}

function getUsers() {
  ensureDefaultUser_();
  var sh = getOrCreateSheet_(USERS_SHEET, USER_HEADERS);
  var values = sh.getDataRange().getValues();
  var rows = values.slice(1).filter(function (r) { return r[0]; });
  return rows.map(function (r) {
    return {
      id: String(r[0]), username: String(r[1]), name: String(r[3]),
      cpf: String(r[5] || ""), email: String(r[6] || ""), phone: String(r[7] || "")
    };
  });
}

// Aceita tanto os argumentos antigos addUser(username, password, name) quanto um objeto com
// todos os campos (username, password, name, cpf, email, phone) - assim uma implantação
// antiga do Index.html não quebra durante a atualização.
function addUser(username, password, name) {
  var u = (username && typeof username === "object") ? username : {username: username, password: password, name: name};
  var uname = String(u.username || "").trim().toLowerCase();
  if (!uname || !u.password || String(u.password).length < 4) {
    throw new Error("Informe usuário e senha (mínimo 4 caracteres).");
  }
  var sh = getOrCreateSheet_(USERS_SHEET, USER_HEADERS);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === uname) {
      throw new Error("Já existe um usuário com esse nome.");
    }
  }
  sh.appendRow([
    Utilities.getUuid(), uname, hashPassword_(u.password),
    (u.name && String(u.name).trim()) || uname, new Date().getTime(),
    (u.cpf && String(u.cpf).trim()) || "",
    (u.email && String(u.email).trim().toLowerCase()) || "",
    (u.phone && String(u.phone).trim()) || "",
    "1" // senha provisória: no primeiro login o painel vai obrigar a trocar
  ]);
  return getUsers();
}

// Atualiza usuário/nome/CPF/e-mail/telefone de um acesso já existente (usado pelo botão
// "Editar" na aba Usuários). Não mexe na senha - isso é feito por changeUserPassword().
// Aceita tanto updateUser(id, username, name) quanto updateUser(id, dadosObjeto).
function updateUser(id, username, name) {
  var u = (username && typeof username === "object") ? username : {username: username, name: name};
  var uname = String(u.username || "").trim().toLowerCase();
  if (!uname) throw new Error("Informe o nome de usuário.");
  var sh = getOrCreateSheet_(USERS_SHEET, USER_HEADERS);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === uname && String(values[i][0]) !== String(id)) {
      throw new Error("Já existe outro usuário com esse nome.");
    }
  }
  var found = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.getRange(i + 1, 2).setValue(uname);
      sh.getRange(i + 1, 4).setValue((u.name && String(u.name).trim()) || uname);
      sh.getRange(i + 1, 6).setValue((u.cpf && String(u.cpf).trim()) || "");
      sh.getRange(i + 1, 7).setValue((u.email && String(u.email).trim().toLowerCase()) || "");
      sh.getRange(i + 1, 8).setValue((u.phone && String(u.phone).trim()) || "");
      found = true;
      break;
    }
  }
  if (!found) throw new Error("Usuário não encontrado (pode já ter sido removido).");
  return getUsers();
}

// Define uma nova senha para um usuário do painel (usado pelo botão "Alterar Senha").
// Só troca se a senha ATUAL informada bater com o hash já salvo pra esse usuário - trava
// proposital pra ninguém trocar a senha de outro acesso sem saber a senha antiga dele.
// A tela já confere força da senha nova antes de chamar - isso aqui é a segunda trava, do
// lado do servidor, pra valer mesmo se alguém chamar essa função direto (fora da tela).
var STRONG_PASSWORD_RE_ = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
function changeUserPassword(id, oldPassword, newPassword) {
  var pw = String(newPassword || "");
  if (!STRONG_PASSWORD_RE_.test(pw)) {
    throw new Error("A senha precisa ter pelo menos 8 caracteres, com letra maiúscula, minúscula, número e símbolo.");
  }
  var sh = getOrCreateSheet_(USERS_SHEET, USER_HEADERS);
  var values = sh.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      if (String(values[i][2]) !== hashPassword_(oldPassword)) {
        throw new Error("Senha atual incorreta.");
      }
      if (hashPassword_(pw) === String(values[i][2])) {
        throw new Error("A senha nova precisa ser diferente da atual.");
      }
      sh.getRange(i + 1, 3).setValue(hashPassword_(pw));
      // Trocou a senha: deixa de ser provisória, então o painel para de exigir a troca.
      sh.getRange(i + 1, 9).setValue("");
      found = true;
      break;
    }
  }
  if (!found) throw new Error("Usuário não encontrado (pode já ter sido removido).");
  return { ok: true };
}

// Remove um usuário do painel. Exige a senha do usuário atualmente logado como
// confirmação extra (mesmo padrão de segunda senha usado em updateEntry/deleteEntry).
function removeUser(id, confirmUsername, confirmPassword) {
  if (!verifyPassword_(confirmUsername, confirmPassword)) {
    throw new Error("Senha incorreta. O usuário não foi removido.");
  }
  var sh = getOrCreateSheet_(USERS_SHEET, USER_HEADERS);
  var values = sh.getDataRange().getValues();
  if (values.length <= 2) { // só o cabeçalho + 1 usuário
    throw new Error("Não é possível remover o último usuário do painel.");
  }
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      break;
    }
  }
  return getUsers();
}

function login(username, password) {
  ensureDefaultUser_();
  var sh = getOrCreateSheet_(USERS_SHEET, USER_HEADERS);
  var values = sh.getDataRange().getValues();
  var uname = String(username || "").trim().toLowerCase();
  var hash = hashPassword_(password);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === uname && String(values[i][2]) === hash) {
      return {
        ok: true,
        id: String(values[i][0]),
        username: String(values[i][1]),
        name: String(values[i][3]) || String(values[i][1]),
        // Enquanto isso for true, o painel abre travado na troca de senha.
        mustChangePassword: String(values[i][8] || "") === "1"
      };
    }
  }
  return { ok: false };
}

// Confere usuário/senha sem criar sessão - usado como "segunda senha" de confirmação
// antes de editar ou apagar um checklist já enviado (aba "Gerenciar checklists").
function verifyPassword_(username, password) {
  var sh = getOrCreateSheet_(USERS_SHEET, USER_HEADERS);
  var values = sh.getDataRange().getValues();
  var uname = String(username || "").trim().toLowerCase();
  var hash = hashPassword_(password);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === uname && String(values[i][2]) === hash) return true;
  }
  return false;
}

// ---------------- Photos (Google Drive) ----------------
function getOrCreatePhotosFolder_() {
  var folders = DriveApp.getFoldersByName(PHOTOS_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(PHOTOS_FOLDER_NAME);
}

function savePhoto_(dataUrl, filename) {
  if (!dataUrl) return "";
  var match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) return "";
  var contentType = match[1];
  var base64 = match[2];
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, contentType, filename);
  var folder = getOrCreatePhotosFolder_();
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
}

// ---------------- Entries API ----------------
// Confere a matrícula digitada no checklist contra a matrícula cadastrada desse motorista
// (aba Motoristas) - é a confirmação de que foi ele mesmo quem preencheu, e não outra
// pessoa usando o nome dele. Só bloqueia se ESSE motorista tiver matrícula cadastrada;
// sem cadastro, passa direto (não tem o que conferir).
function verifyDriverMatricula_(driverId, typedMatricula) {
  if (!driverId) return true; // checklist antigo/sem condutor vinculado por id - não trava
  var sh = getOrCreateSheet_(DRIVERS_SHEET, DRIVER_HEADERS);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(driverId)) {
      var registered = String(values[i][5] || "").trim();
      if (!registered) return true; // esse motorista não tem matrícula cadastrada ainda
      return String(typedMatricula || "").trim() === registered;
    }
  }
  return true; // motorista não encontrado (cadastro removido) - não bloqueia o envio
}

function saveEntry(entry) {
  if (!entry) throw new Error("Checklist vazio.");
  if (!verifyDriverMatricula_(entry.condutorId, entry.matricula)) {
    throw new Error("Sua matrícula está errada. Tente novamente.");
  }
  var sh = getOrCreateSheet_(ENTRIES_SHEET, ENTRY_HEADERS);
  var id = Utilities.getUuid();
  var createdAt = new Date().getTime();
  var dateStr = normalizeDate_(entry.date);
  var photoUrl = "";
  try {
    if (entry.photoData) {
      photoUrl = savePhoto_(entry.photoData, id + ".jpg");
    }
  } catch (err) {
    photoUrl = ""; // não deixa a foto quebrar o registro do checklist
  }
  sh.appendRow([
    id, createdAt, entry.vehicleId || "", entry.plate || "", entry.model || "",
    entry.matricula || "", dateStr, entry.percurso || "", entry.condutor || "",
    entry.horaSaida || "", entry.horaChegada || "", entry.kmOut, entry.kmIn,
    entry.macaco || "", entry.chaveRoda || "", entry.estepe || "", photoUrl,
    entry.condutorId || ""
  ]);
  // Reforça a célula da data como texto puro (coluna G = 7), mesmo que o Sheets
  // tente "ajudar" convertendo pra Date por conta do formato da coluna ter mudado.
  sh.getRange(sh.getLastRow(), 7).setNumberFormat("@").setValue(dateStr);
  return { id: id, createdAt: createdAt, photoUrl: photoUrl, date: dateStr };
}

function getEntries() {
  var sh = getOrCreateSheet_(ENTRIES_SHEET, ENTRY_HEADERS);
  var values = sh.getDataRange().getValues();
  var rows = values.slice(1).filter(function (r) { return r[0]; });
  var list = rows.map(function (r) {
    return {
      id: String(r[0]),
      createdAt: Number(r[1]) || 0,
      vehicleId: String(r[2]),
      plate: String(r[3]),
      model: String(r[4]),
      matricula: String(r[5]),
      date: normalizeDate_(r[6]),
      percurso: String(r[7]),
      condutor: String(r[8]),
      horaSaida: String(r[9]),
      horaChegada: String(r[10]),
      kmOut: Number(r[11]) || 0,
      kmIn: Number(r[12]) || 0,
      macaco: String(r[13]),
      chaveRoda: String(r[14]),
      estepe: String(r[15]),
      photo: String(r[16] || ""),
      condutorId: String(r[17] || "")
    };
  });
  list.sort(function (a, b) { return b.createdAt - a.createdAt; });
  return list;
}

// Devolve só o último Km de chegada registrado pra esse veículo (o mais recente pelo
// createdAt), ou null se ele nunca teve checklist - usado pra sugerir automaticamente o
// Km de saída do próximo checklist. De propósito não usa getEntries()/verifyPassword_ aqui:
// essa função é chamada pela tela do motorista, que não tem login, então só devolve esse
// número (não expõe os outros dados dos checklists anteriores do veículo).
function getLastKmForVehicle(vehicleId) {
  if (!vehicleId) return null;
  var sh = getOrCreateSheet_(ENTRIES_SHEET, ENTRY_HEADERS);
  var values = sh.getDataRange().getValues();
  var lastCreatedAt = null;
  var lastKmIn = null;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][2]) === String(vehicleId)) {
      var createdAt = Number(values[i][1]) || 0;
      if (lastCreatedAt === null || createdAt > lastCreatedAt) {
        lastCreatedAt = createdAt;
        lastKmIn = Number(values[i][12]) || 0;
      }
    }
  }
  return lastKmIn;
}

// Edita um checklist já enviado (aba "Gerenciar checklists" do painel). Exige usuário+senha
// de um acesso válido do painel como confirmação extra, já que altera um registro que o
// motorista preencheu.
function updateEntry(id, entry, confirmUsername, confirmPassword) {
  if (!verifyPassword_(confirmUsername, confirmPassword)) {
    throw new Error("Senha incorreta. A alteração não foi salva.");
  }
  if (!entry) throw new Error("Dados do checklist vazios.");
  var sh = getOrCreateSheet_(ENTRIES_SHEET, ENTRY_HEADERS);
  var values = sh.getDataRange().getValues();
  var dateStr = normalizeDate_(entry.date);
  var found = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.getRange(i + 1, 3, 1, 14).setValues([[
        entry.vehicleId || "", entry.plate || "", entry.model || "",
        entry.matricula || "", dateStr, entry.percurso || "", entry.condutor || "",
        entry.horaSaida || "", entry.horaChegada || "", entry.kmOut, entry.kmIn,
        entry.macaco || "", entry.chaveRoda || "", entry.estepe || ""
      ]]);
      sh.getRange(i + 1, 7).setNumberFormat("@").setValue(dateStr);
      found = true;
      break;
    }
  }
  if (!found) throw new Error("Checklist não encontrado (pode já ter sido apagado).");
  return getEntries();
}

// Apaga um checklist já enviado (aba "Gerenciar checklists" do painel). Mesma confirmação
// de senha usada em updateEntry().
function deleteEntry(id, confirmUsername, confirmPassword) {
  if (!verifyPassword_(confirmUsername, confirmPassword)) {
    throw new Error("Senha incorreta. O checklist não foi apagado.");
  }
  var sh = getOrCreateSheet_(ENTRIES_SHEET, ENTRY_HEADERS);
  var values = sh.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      found = true;
      break;
    }
  }
  if (!found) throw new Error("Checklist não encontrado (pode já ter sido apagado).");
  return getEntries();
}

/**
 * Rode esta função uma vez manualmente pelo editor do Apps Script (Executar > setup)
 * antes do primeiro deploy, só pra disparar a tela de autorização de permissões
 * (Planilhas + Drive) de uma vez. Não é obrigatório, mas evita surpresa no primeiro
 * acesso de um fiscal. Também já cria o usuário inicial do painel (usuário "admin",
 * senha "frota2026" - troque assim que puder, pela aba "Usuários" do painel).
 */
function setup() {
  ensureDefaultVehicles_();
  getOrCreateSheet_(ENTRIES_SHEET, ENTRY_HEADERS);
  getOrCreateSheet_(DRIVERS_SHEET, DRIVER_HEADERS);
  ensureDefaultUser_();
  Logger.log("Setup concluído.");
}
