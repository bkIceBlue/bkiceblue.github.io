const SHEET_NAME = "訂單";

function doGet() {
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

  sheet.appendRow([
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
    order.total
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
      "合計"
    ]);
  }

  return sheet;
}
