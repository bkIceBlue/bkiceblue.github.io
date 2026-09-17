window.ORDERING_PAUSED = true;
const orderingNotice = document.querySelector("#ordering-notice");
orderingNotice.showModal();
document.querySelector("#notice-lookup").addEventListener("click", () => orderingNotice.close());
