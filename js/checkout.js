const SHIPPING_FEE = 90;
const FREE_SHIPPING_THRESHOLD = 6000;
const CART_STORAGE_KEY = "iceblue-cart";

const form = document.querySelector("#checkout-form");
const orderList = document.querySelector("#order-list");
const subtotalText = document.querySelector("#checkout-subtotal");
const shippingText = document.querySelector("#checkout-shipping");
const totalText = document.querySelector("#checkout-total");
const checkoutNote = document.querySelector("#checkout-note");
const statusText = document.querySelector("#form-status");
const pickupOtherRadio = document.querySelector("#pickup-other-radio");
const pickupOtherInput = document.querySelector("#pickup-other");
const isPaidInput = document.querySelector("#is-paid");
const bankLastFiveInput = document.querySelector("#bank-last-five");

const money = new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
});

const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
const totals = getTotals(cart);

renderOrder();

document.querySelectorAll('input[name="pickupMethod"]').forEach((radio) => {
    radio.addEventListener("change", updatePickupOtherState);
});

isPaidInput.addEventListener("change", updatePaidState);

form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (cart.length === 0) {
        statusText.textContent = "購物車是空的，請先回商品頁選購。";
        return;
    }

    updatePickupOtherState();
    updatePaidState();

    if (!form.reportValidity()) {
        statusText.textContent = "請確認必填欄位都已填寫。";
        return;
    }

    const order = buildOrder();

    statusText.textContent = "訂單內容已整理完成。自動寄信與 Google 表單統計尚未串接，請先不要把這版當正式收單使用。";
    console.log(formatOrder(order));
});

function renderOrder() {
    if (cart.length === 0) {
        orderList.className = "order-message";
        orderList.textContent = "購物車是空的，請先回商品頁選購。";
    } else {
        orderList.className = "order-list";
        orderList.innerHTML = "";

        cart.forEach((item) => {
            const line = document.createElement("div");
            line.className = "order-line";
            line.innerHTML = `
                <strong>${item.name}</strong>
                <span>${money.format(item.price)} x ${item.quantity} = ${money.format(item.price * item.quantity)}</span>
            `;
            orderList.append(line);
        });
    }

    subtotalText.textContent = money.format(totals.subtotal);
    shippingText.textContent = money.format(totals.shipping);
    totalText.textContent = money.format(totals.total);
    checkoutNote.textContent = totals.subtotal >= FREE_SHIPPING_THRESHOLD
        ? "已達免運門檻"
        : `再買 ${money.format(FREE_SHIPPING_THRESHOLD - totals.subtotal)} 即可免運`;
}

function updatePickupOtherState() {
    const isOther = pickupOtherRadio.checked;
    pickupOtherInput.disabled = !isOther;
    pickupOtherInput.required = isOther;

    if (!isOther) {
        pickupOtherInput.value = "";
    }
}

function updatePaidState() {
    bankLastFiveInput.disabled = !isPaidInput.checked;
    bankLastFiveInput.required = isPaidInput.checked;

    if (!isPaidInput.checked) {
        bankLastFiveInput.value = "";
    }
}

function getTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

    return {
        subtotal,
        shipping,
        total: subtotal + shipping
    };
}

function buildOrder() {
    const data = new FormData(form);
    const pickupMethod = data.get("pickupMethod") === "其他"
        ? `其他：${data.get("pickupOther")}`
        : data.get("pickupMethod");

    return {
        customerName: data.get("customerName"),
        customerPhone: data.get("customerPhone"),
        customerAddress: data.get("customerAddress") || "未填寫",
        customerEmail: data.get("customerEmail"),
        pickupMethod,
        shipDate: data.get("shipDate"),
        isPaid: data.get("isPaid") ? "已付款" : "尚未付款",
        bankLastFive: data.get("bankLastFive") || "未填寫",
        orderNote: data.get("orderNote") || "無",
        items: cart,
        totals
    };
}

function formatOrder(order) {
    const itemLines = order.items.map((item) => (
        `${item.name}｜${money.format(item.price)} x ${item.quantity} = ${money.format(item.price * item.quantity)}`
    )).join("\n");

    return [
        "冰藍烘焙實驗室訂單確認",
        "",
        `姓名：${order.customerName}`,
        `電話：${order.customerPhone}`,
        `地址：${order.customerAddress}`,
        `Email：${order.customerEmail || "未填寫"}`,
        `取貨方式：${order.pickupMethod}`,
        `出貨日期：${order.shipDate}`,
        `付款狀態：${order.isPaid}`,
        `銀行後五碼：${order.bankLastFive}`,
        `備註：${order.orderNote}`,
        "",
        "訂購內容：",
        itemLines,
        "",
        `商品金額：${money.format(order.totals.subtotal)}`,
        `運費：${money.format(order.totals.shipping)}`,
        `合計：${money.format(order.totals.total)}`
    ].join("\n");
}
