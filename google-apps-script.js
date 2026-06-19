const SHEET_NAME = "訂單";
const ORDER_SEQUENCE_KEY = "BK26_ORDER_SEQUENCE";

function doGet(e) {
  if (e && e.parameter.action === "nextOrderNumber") {
    const callback = String(e.parameter.callback || "").replace(/[^\w.$]/g, "");
    const payload = JSON.stringify({
      ok: true,
      orderNumber: createOrderNumber()
    });

    if (callback) {
      return ContentService
        .createTextOutput(`${callback}(${payload});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getOrderSheet();

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: "冰藍烘焙實驗室訂單系統已連線",
      sheetName: sheet.getName()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = getOrderSheet();
  const order = JSON.parse(e.postData.contents || "{}");

  if (order.orderNumber && hasOrderNumber(sheet, order.orderNumber)) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, duplicate: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  sheet.appendRow([
    order.orderNumber,
    new Date(),
    order.customerName,
    order.customerPhone,
    order.customerEmail,
    order.customerAddress,
    order.pickupMethod,
    order.shipDate,
    order.isPaid,
    order.bankLastFive,
    order.orderNote,
    order.itemsText,
    order.subtotal,
    order.shipping,
    order.total,
    order.paymentMethod,
    order.paymentReference
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrderSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("找不到目前綁定的試算表。請從 Google 試算表的「擴充功能 > Apps Script」建立這份程式。");
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "訂單編號",
      "建立時間",
      "姓名",
      "電話",
      "Email",
      "地址",
      "取貨方式",
      "出貨日期",
      "付款狀態",
      "帳號後五碼",
      "備註",
      "訂購內容",
      "商品金額",
      "運費",
      "合計",
      "付款方式",
      "付款核對資訊"
    ]);
  } else if (sheet.getRange(1, 1).getValue() !== "訂單編號") {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue("訂單編號");
  }

  if (sheet.getRange(1, 16).getValue() !== "付款方式") {
    sheet.getRange(1, 16, 1, 2).setValues([["付款方式", "付款核對資訊"]]);
  }

  return sheet;
}

function createOrderNumber() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getOrderSheet();
    const properties = PropertiesService.getScriptProperties();
    const savedSequence = Number(properties.getProperty(ORDER_SEQUENCE_KEY) || 0);
    const existingOrders = Math.max(0, sheet.getLastRow() - 1);
    const nextSequence = Math.max(savedSequence, existingOrders) + 1;

    properties.setProperty(ORDER_SEQUENCE_KEY, String(nextSequence));
    return `BK26-${String(nextSequence).padStart(3, "0")}`;
  } finally {
    lock.releaseLock();
  }
}

function hasOrderNumber(sheet, orderNumber) {
  if (sheet.getLastRow() < 2) return false;

  const match = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(orderNumber)
    .matchEntireCell(true)
    .findNext();

  return Boolean(match);
}
