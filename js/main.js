const SHIPPING_FEE = 90;
const FREE_SHIPPING_THRESHOLD = 6000;

const cart = new Map();
let selectedProduct = null;

const modal = document.querySelector("#quantity-modal");
const modalTitle = document.querySelector("#modal-title");
const modalPrice = document.querySelector("#modal-price");
const quantityInput = document.querySelector("#quantity-input");
const confirmAddButton = document.querySelector("#confirm-add");
const cartPanel = document.querySelector(".cart-panel");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const subtotalText = document.querySelector("#subtotal");
const shippingText = document.querySelector("#shipping");
const totalText = document.querySelector("#total");
const freeShippingNote = document.querySelector("#free-shipping-note");

const money = new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
});

document.querySelectorAll(".add-cart-btn").forEach((button) => {
    button.addEventListener("click", () => {
        selectedProduct = {
            name: button.dataset.name,
            price: Number(button.dataset.price),
            unit: button.dataset.unit
        };

        quantityInput.value = 1;
        modalTitle.textContent = selectedProduct.name;
        modalPrice.textContent = `${money.format(selectedProduct.price)} / ${selectedProduct.unit}`;
        modal.hidden = false;
        quantityInput.focus();
        quantityInput.select();
    });
});

document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", closeModal);
});

document.querySelector("#decrease-qty").addEventListener("click", () => {
    quantityInput.value = Math.max(1, getQuantity() - 1);
});

document.querySelector("#increase-qty").addEventListener("click", () => {
    quantityInput.value = getQuantity() + 1;
});

quantityInput.addEventListener("input", () => {
    quantityInput.value = Math.max(1, getQuantity());
});

confirmAddButton.addEventListener("click", () => {
    if (!selectedProduct) return;

    const currentItem = cart.get(selectedProduct.name) || {
        ...selectedProduct,
        quantity: 0
    };

    currentItem.quantity += getQuantity();
    cart.set(selectedProduct.name, currentItem);
    cartPanel.classList.remove("collapsed");
    closeModal();
    renderCart();
});

document.querySelector(".cart-tab").addEventListener("click", () => {
    cartPanel.classList.toggle("collapsed");
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
        closeModal();
    }
});

cartPanel.classList.add("collapsed");
renderCart();

function getQuantity() {
    const quantity = Number.parseInt(quantityInput.value, 10);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function closeModal() {
    modal.hidden = true;
    selectedProduct = null;
}

function renderCart() {
    const items = [...cart.values()];
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

    cartCount.textContent = itemCount;
    subtotalText.textContent = money.format(subtotal);
    shippingText.textContent = money.format(shipping);
    totalText.textContent = money.format(subtotal + shipping);

    if (items.length === 0) {
        cartItems.className = "cart-items empty";
        cartItems.textContent = "尚未加入商品";
        freeShippingNote.textContent = `再買 ${money.format(FREE_SHIPPING_THRESHOLD)} 即可免運`;
        return;
    }

    cartItems.className = "cart-items";
    cartItems.innerHTML = "";

    items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "cart-item";
        row.innerHTML = `
            <h3>${item.name}</h3>
            <button class="remove-item" type="button" aria-label="移除 ${item.name}">x</button>
            <p>${money.format(item.price)} x ${item.quantity}</p>
            <span>${money.format(item.price * item.quantity)}</span>
        `;

        row.querySelector(".remove-item").addEventListener("click", () => {
            cart.delete(item.name);
            renderCart();
        });

        cartItems.append(row);
    });

    const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
    freeShippingNote.textContent = remaining > 0
        ? `再買 ${money.format(remaining)} 即可免運`
        : "已達免運門檻";
}
