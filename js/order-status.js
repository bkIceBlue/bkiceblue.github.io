const ORDER_SERVICE_URL = "https://script.google.com/macros/s/AKfycby-IJJhPh_FxLd8Gz2rfxS96J5-E0lvmeJaRdL1yaz4lDRGqaSIhoOd_ogfjT-m5AS1zg/exec";

const lookupForm = document.querySelector("#order-lookup-form");
const lookupButton = document.querySelector("#lookup-button");
const lookupStatus = document.querySelector("#lookup-status");
const orderResult = document.querySelector("#order-result");
const paymentReportForm = document.querySelector("#payment-report-form");
const paymentMethod = document.querySelector("#report-payment-method");
const bankReferenceField = document.querySelector("#bank-reference-field");
const bankLastFive = document.querySelector("#report-bank-last-five");
const linePayReferenceField = document.querySelector("#linepay-reference-field");
const linePayName = document.querySelector("#report-linepay-name");
const paymentReportButton = document.querySelector("#payment-report-button");
const paymentReportStatus = document.querySelector("#payment-report-status");

let verifiedOrder = null;

lookupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!lookupForm.reportValidity()) return;

    const phone = normalizePhone(document.querySelector("#lookup-phone").value);
    lookupButton.disabled = true;
    lookupStatus.textContent = "正在查詢訂單...";
    orderResult.hidden = true;
    verifiedOrder = null;

    try {
        const phoneHash = await hashText(phone);
        const result = await queryOrders(phoneHash);

        if (!result.ok || !result.found || !result.orders?.length) {
            lookupStatus.textContent = result.message || "查無符合資料，請確認訂購時填寫的手機號碼。";
            return;
        }

        renderOrderList(result.orders, phone);
        lookupStatus.textContent = `已找到 ${result.orders.length} 筆訂單。`;
    } catch (error) {
        console.error(error);
        lookupStatus.textContent = "目前無法查詢，請稍後再試。";
    } finally {
        lookupButton.disabled = false;
    }
});

paymentMethod.addEventListener("change", updatePaymentFields);

paymentReportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!verifiedOrder || !paymentReportForm.reportValidity()) return;

    paymentReportButton.disabled = true;
    lookupButton.disabled = true;
    document.querySelectorAll("#order-list button").forEach((button) => { button.disabled = true; });
    paymentReportStatus.textContent = "正在送出付款資訊...";

    const reference = paymentMethod.value === "LINE Pay Money"
        ? `付款人：${linePayName.value.trim()}`
        : `轉出帳號後五碼：${bankLastFive.value}`;

    try {
        await fetch(ORDER_SERVICE_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "reportPayment",
                orderNumber: verifiedOrder.orderNumber,
                customerPhone: verifiedOrder.phone,
                paymentMethod: paymentMethod.value,
                paymentReference: reference
            })
        });

        paymentReportForm.reset();
        updatePaymentFields();
        paymentReportStatus.textContent = "付款資訊已送出，等待店家確認。";
        setStatusBadge("#result-payment-status", "已回報待確認", "pending");
    } catch (error) {
        console.error(error);
        paymentReportStatus.textContent = "付款資訊未能送出，請稍後再試。";
    } finally {
        paymentReportButton.disabled = false;
        lookupButton.disabled = false;
        document.querySelectorAll("#order-list button").forEach((button) => { button.disabled = false; });
    }
});

function renderOrderResult(order) {
    const paymentStatus = order.paymentStatus || "尚未付款";
    const shippingStatus = order.shippingStatus || "處理中";
    const trackingNumber = order.trackingNumber || "尚未提供";

    setStatusBadge("#result-payment-status", paymentStatus, getPaymentStatusTone(paymentStatus));
    setStatusBadge("#result-shipping-status", shippingStatus, getShippingStatusTone(shippingStatus));
    setStatusBadge("#result-ship-date", formatDisplayDate(order.shipDate), "info");
    setStatusBadge("#result-tracking-number", trackingNumber, order.trackingNumber ? "info" : "neutral");
    paymentReportForm.hidden = !["尚未付款", "未選擇", ""].includes(order.paymentStatus || "");
    paymentReportStatus.textContent = "";
    orderResult.hidden = false;
}

function setStatusBadge(selector, text, tone) {
    const element = document.querySelector(selector);
    element.textContent = text;
    element.className = `status-badge status-${tone}`;
}

function getPaymentStatusTone(status) {
    if (["付款已確認", "已付款"].includes(status)) return "complete";
    if (["已退款", "訂單取消"].includes(status)) return "cancelled";
    if (status === "已回報待確認") return "pending";
    return "incomplete";
}

function getShippingStatusTone(status) {
    if (status === "已出貨") return "complete";
    if (["訂單取消", "取消出貨"].includes(status)) return "cancelled";
    if (["備貨中", "暫緩出貨"].includes(status)) return "pending";
    return "processing";
}

function updatePaymentFields() {
    const isBank = ["中華郵政轉帳", "玉山銀行轉帳"].includes(paymentMethod.value);
    const isLinePay = paymentMethod.value === "LINE Pay Money";

    bankReferenceField.hidden = !isBank;
    bankLastFive.required = isBank;
    bankLastFive.disabled = !isBank;
    linePayReferenceField.hidden = !isLinePay;
    linePayName.required = isLinePay;
    linePayName.disabled = !isLinePay;
}

function queryOrders(phoneHash) {
    return new Promise((resolve, reject) => {
        const callbackName = `iceblueOrderLookup_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const script = document.createElement("script");
        const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error("查詢逾時"));
        }, 12000);

        const cleanup = () => {
            window.clearTimeout(timeout);
            script.remove();
            delete window[callbackName];
        };

        window[callbackName] = (result) => {
            cleanup();
            resolve(result);
        };
        script.onerror = () => {
            cleanup();
            reject(new Error("查詢服務連線失敗"));
        };
        script.src = `${ORDER_SERVICE_URL}?action=queryOrders&phoneHash=${encodeURIComponent(phoneHash)}&callback=${encodeURIComponent(callbackName)}`;
        document.head.append(script);
    });
}

function renderOrderList(orders, phone) {
    const list = document.querySelector("#order-list");
    list.replaceChildren();
    const selectOrder = (order) => {
        verifiedOrder = { orderNumber: order.orderNumber, phone };
        paymentReportForm.reset();
        updatePaymentFields();
        document.querySelector("#selected-order-title").textContent = `訂單 ${order.orderNumber}`;
        renderOrderResult(order);
    };
    orders.forEach((order) => {
        const card = document.createElement("section");
        card.className = "lookup-order-card";
        const heading = document.createElement("h3");
        heading.textContent = order.orderNumber;
        card.append(heading);
        const details = document.createElement("dl");
        const fields = [
            ["姓名", order.maskedName], ["手機", order.maskedPhone],
            ["地址", order.maskedAddress], ["付款狀態", order.paymentStatus],
            ["出貨狀態", order.shippingStatus], ["預定出貨日期", formatDisplayDate(order.shipDate)],
            ["出貨單號", order.trackingNumber || "尚未提供"]
        ];
        fields.forEach(([label, value]) => {
            const row = document.createElement("div");
            const term = document.createElement("dt");
            const description = document.createElement("dd");
            term.textContent = label;
            description.textContent = value || "尚未提供";
            row.append(term, description);
            details.append(row);
        });
        card.append(details);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "submit-button";
        button.textContent = "選擇此訂單／回報付款";
        button.addEventListener("click", () => {
            selectOrder(order);
            document.querySelector("#selected-order-title").scrollIntoView({ block: "center", behavior: "smooth" });
        });
        card.append(button);
        list.append(card);
    });
    selectOrder(orders[0]);
}

async function hashText(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(value) {
    return value.replace(/\D/g, "");
}

function formatDisplayDate(value) {
    if (!value) return "尚未提供";
    const parts = String(value).slice(0, 10).split("-");
    return parts.length === 3 ? `${parts[0]}/${Number(parts[1])}/${Number(parts[2])}` : value;
}

updatePaymentFields();
