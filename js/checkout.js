const SHIPPING_FEE = 90;
const FREE_SHIPPING_THRESHOLD = 6000;
const CART_STORAGE_KEY = "iceblue-cart";
const EMAILJS_PUBLIC_KEY = "QNMA6YsC_S3mhgRw5";
const EMAILJS_SERVICE_ID = "service_y2uc2xq";
const SHOP_TEMPLATE_ID = "template_6sv6rmb";
const CUSTOMER_TEMPLATE_ID = "template_0gmy246";
const SHOP_EMAIL = "bk.iceblue@gmail.com";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby-IJJhPh_FxLd8Gz2rfxS96J5-E0lvmeJaRdL1yaz4lDRGqaSIhoOd_ogfjT-m5AS1zg/exec";

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
const submitButton = document.querySelector(".submit-button");

const money = new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
});

let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
let totals = getTotals(cart);

if (window.emailjs) {
    emailjs.init({
        publicKey: EMAILJS_PUBLIC_KEY
    });
}

renderOrder();

document.querySelectorAll('input[name="pickupMethod"]').forEach((radio) => {
    radio.addEventListener("change", () => {
        updatePickupOtherState();
        renderOrder();
    });
});

isPaidInput.addEventListener("change", updatePaidState);

form.addEventListener("submit", async (event) => {
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
    const params = buildEmailParams(order);

    if (!window.emailjs) {
        statusText.textContent = "Email 服務尚未載入，請重新整理後再試一次。";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "送出中...";
    statusText.textContent = "訂單送出中，請稍候。";

    try {
        await emailjs.send(EMAILJS_SERVICE_ID, SHOP_TEMPLATE_ID, params);

        if (order.customerEmail) {
            await emailjs.send(EMAILJS_SERVICE_ID, CUSTOMER_TEMPLATE_ID, params);
        }

        if (GOOGLE_SCRIPT_URL) {
            await saveOrderToGoogleSheet(order, params);
        }

        localStorage.removeItem(CART_STORAGE_KEY);
        cart = [];
        totals = getTotals(cart);
        renderOrder();
        form.reset();
        updatePickupOtherState();
        updatePaidState();
        const customerMailNote = order.customerEmail ? "確認信也已寄給客人。" : "客人未填 Email，所以只寄送店家通知信。";
        const sheetNote = GOOGLE_SCRIPT_URL ? "訂單也已寫入統計表。" : "統計表尚未串接。";
        statusText.textContent = `訂單已送出，${customerMailNote}${sheetNote}`;
    } catch (error) {
        console.error(error);
        statusText.textContent = "訂單沒有成功送出，請稍後再試，或直接聯絡冰藍烘焙實驗室。";
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "送出訂單";
    }
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

    totals = getTotals(cart, getSelectedPickupMethod());
    subtotalText.textContent = money.format(totals.subtotal);
    shippingText.textContent = money.format(totals.shipping);
    totalText.textContent = money.format(totals.total);

    if (getSelectedPickupMethod() !== "宅配") {
        checkoutNote.textContent = "自取與其他取貨方式不收運費。";
    } else if (totals.subtotal >= FREE_SHIPPING_THRESHOLD) {
        checkoutNote.textContent = "已達宅配免運門檻。";
    } else {
        checkoutNote.textContent = `宅配再買 ${money.format(FREE_SHIPPING_THRESHOLD - totals.subtotal)} 即可免運。`;
    }
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

function getSelectedPickupMethod() {
    return document.querySelector('input[name="pickupMethod"]:checked')?.value || "";
}

function getTotals(items, pickupMethod = "") {
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const shipping = pickupMethod === "宅配" && subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;

    return {
        subtotal,
        shipping,
        total: subtotal + shipping
    };
}

async function saveOrderToGoogleSheet(order, params) {
    await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail || "",
            customerAddress: order.customerAddress,
            pickupMethod: order.pickupMethod,
            shipDate: order.shipDate,
            isPaid: order.isPaid,
            bankLastFive: order.bankLastFive,
            orderNote: order.orderNote,
            itemsText: params.order_items,
            subtotal: params.subtotal,
            shipping: params.shipping,
            total: params.total,
            items: order.items
        })
    });
}

function buildOrder() {
    const data = new FormData(form);
    const pickupMethod = data.get("pickupMethod") === "其他"
        ? `其他：${data.get("pickupOther")}`
        : data.get("pickupMethod");
    totals = getTotals(cart, data.get("pickupMethod"));

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

function buildEmailParams(order) {
    return {
        shop_email: SHOP_EMAIL,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        customer_email: order.customerEmail || "未填寫",
        customer_address: order.customerAddress,
        pickup_method: order.pickupMethod,
        ship_date: order.shipDate,
        paid_status: order.isPaid,
        bank_last_five: order.bankLastFive,
        order_note: order.orderNote,
        order_items: order.items.map((item) => (
            `${item.name}｜${money.format(item.price)} x ${item.quantity} = ${money.format(item.price * item.quantity)}`
        )).join("\n"),
        subtotal: money.format(order.totals.subtotal),
        shipping: money.format(order.totals.shipping),
        total: money.format(order.totals.total),
        order_text: formatOrder(order)
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
        `帳號後五碼：${order.bankLastFive}`,
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
