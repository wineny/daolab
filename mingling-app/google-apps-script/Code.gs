/**
 * DaoLab Mingling — Apps Script Web App
 *
 * 시트는 'participants' 시트에 다음 헤더가 있어야 함:
 *   id | session_id | name | original_team | created_at | updated_at
 *
 * Script Properties (프로젝트 설정 → 스크립트 속성)에 ADMIN_KEY 등록.
 */

const SHEET_NAME = "participants";
const HEADER = ["id", "session_id", "name", "original_team", "created_at", "updated_at"];

function doGet(e) {
  try {
    const sessionId = (e && e.parameter && e.parameter.session_id) || "default";
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonResponse({ participants: [] });
    const header = data[0];
    const idx = mapIndex(header);
    const participants = data
      .slice(1)
      .filter((r) => r[idx.session_id] === sessionId && r[idx.name])
      .map((r) => ({
        id: r[idx.id],
        session_id: r[idx.session_id],
        name: r[idx.name],
        original_team: Number(r[idx.original_team]),
        created_at: toIso(r[idx.created_at]),
        updated_at: toIso(r[idx.updated_at]),
      }));
    return jsonResponse({ participants });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = body.action || "submit";
    const sessionId = body.session_id || "default";

    if (action === "submit") return handleSubmit(body, sessionId);
    if (action === "clear") return handleClear(body, sessionId);
    return jsonResponse({ error: "unknown action" });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function handleSubmit(body, sessionId) {
  const name = String(body.name || "").trim();
  const team = Number(body.original_team);
  if (!name || name.length > 20) return jsonResponse({ error: "이름은 1~20자" });
  if (!Number.isInteger(team) || team < 1 || team > 6)
    return jsonResponse({ error: "조는 1~6" });

  const sheet = getSheet();
  const lock = LockService.getDocumentLock();
  lock.waitLock(5000);
  try {
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const idx = mapIndex(header);
    const now = new Date();

    let rowNumberInSheet = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idx.session_id] === sessionId && data[i][idx.name] === name) {
        rowNumberInSheet = i + 1;
        break;
      }
    }
    if (rowNumberInSheet > 0) {
      sheet.getRange(rowNumberInSheet, idx.original_team + 1).setValue(team);
      sheet.getRange(rowNumberInSheet, idx.updated_at + 1).setValue(now);
    } else {
      const newRow = new Array(header.length).fill("");
      newRow[idx.id] = Utilities.getUuid();
      newRow[idx.session_id] = sessionId;
      newRow[idx.name] = name;
      newRow[idx.original_team] = team;
      newRow[idx.created_at] = now;
      newRow[idx.updated_at] = now;
      sheet.appendRow(newRow);
    }
    return jsonResponse({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function handleClear(body, sessionId) {
  const adminKey = String(body.key || "");
  const expected = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!expected || adminKey !== expected) return jsonResponse({ error: "forbidden" });

  const sheet = getSheet();
  const lock = LockService.getDocumentLock();
  lock.waitLock(5000);
  try {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonResponse({ ok: true, deleted: 0 });
    const header = data[0];
    const sessionIdx = header.indexOf("session_id");

    const toDelete = [];
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][sessionIdx] === sessionId) toDelete.push(i + 1);
    }
    toDelete.forEach((rowNum) => sheet.deleteRow(rowNum));
    return jsonResponse({ ok: true, deleted: toDelete.length });
  } finally {
    lock.releaseLock();
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function mapIndex(header) {
  const o = {};
  HEADER.forEach((key) => {
    o[key] = header.indexOf(key);
  });
  return o;
}

function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value || "");
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * 시트 초기 설정용. 한 번 실행하면 헤더 자동 생성.
 * Apps Script 편집기에서 함수 선택 후 ▶ 실행.
 */
function setupSheet() {
  const sheet = getSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }
  Logger.log("Sheet ready: " + SHEET_NAME);
}
