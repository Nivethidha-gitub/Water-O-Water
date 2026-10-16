let orderQuantities = {
  can20: 2,
  pack1: 0,
  pack500: 0
};

const orderPrices = {
  can20: 40,
  pack1: 96,
  pack500: 120
};

function renderOrderScreen(data) {
  const container = document.getElementById("product-list");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="order-product-card">

      <div class="order-product-icon">
        <svg viewBox="0 0 24 24" fill="none"
          stroke="#0B3B4F" stroke-width="1.8">
          <path d="M7 4h10l-1 16H8L7 4Z"></path>
          <path d="M9 4V2h6v2"></path>
          <path d="M9 8h6"></path>
        </svg>
      </div>

      <div class="order-product-info">
        <h3>20L Can (returnable)</h3>
        <p>₹40 · empty can picked up</p>
      </div>

      <div class="order-stepper">
        <button onclick="changeOrderQuantity('can20', -1)">−</button>
        <span id="order-qty-can20">2</span>
        <button onclick="changeOrderQuantity('can20', 1)">+</button>
      </div>

    </div>

    <div class="order-product-card">

      <div class="order-product-icon">
        <svg viewBox="0 0 24 24" fill="none"
          stroke="#0B3B4F" stroke-width="1.8">
          <rect x="8" y="5" width="8" height="16" rx="2"></rect>
          <path d="M10 5V3h4v2"></path>
          <path d="M10 10h4"></path>
        </svg>
      </div>

      <div class="order-product-info">
        <h3>1L Bottle Pack (12)</h3>
        <p>₹96 per pack</p>
      </div>

      <div class="order-stepper">
        <button onclick="changeOrderQuantity('pack1', -1)">−</button>
        <span id="order-qty-pack1">0</span>
        <button onclick="changeOrderQuantity('pack1', 1)">+</button>
      </div>

    </div>

    <div class="order-product-card">

      <div class="order-product-icon">
        <svg viewBox="0 0 24 24" fill="none"
          stroke="#0B3B4F" stroke-width="1.8">
          <path d="M9 7h6"></path>
          <path d="M9 7v12h6V7"></path>
          <path d="M10 4h4"></path>
          <path d="M11 2h2"></path>
          <path d="M12 4v3"></path>
        </svg>
      </div>

      <div class="order-product-info">
        <h3>500ml Pack (24)</h3>
        <p>₹120 per pack</p>
      </div>

      <div class="order-stepper">
        <button onclick="changeOrderQuantity('pack500', -1)">−</button>
        <span id="order-qty-pack500">0</span>
        <button onclick="changeOrderQuantity('pack500', 1)">+</button>
      </div>

    </div>

    <div class="order-product-card">

      <div class="order-product-icon">
        <svg viewBox="0 0 24 24" fill="none"
          stroke="#0B3B4F" stroke-width="1.8">
          <path d="M3 20h18"></path>
          <path d="M5 20v-8l7-6 7 6v8"></path>
          <path d="M8 12h8"></path>
          <path d="M10 20v-5h4v5"></path>
        </svg>
      </div>

      <div class="order-product-info">
        <h3>Bulk order (events / halls)</h3>
        <p>Custom quote for 50+ cans</p>
      </div>

      <button class="order-ask-button" onclick="askBulkOrder()">
        Ask
      </button>

    </div>

    <div class="order-checkout" id="order-checkout">

      <strong id="order-checkout-text">
        2 items · ₹80
      </strong>

      <button onclick="checkoutOrder()">
        Checkout →
      </button>

    </div>
  `;

  updateOrderTotal();
}

function changeOrderQuantity(product, amount) {

  orderQuantities[product] += amount;

  if (orderQuantities[product] < 0) {
    orderQuantities[product] = 0;
  }

  const quantityElement =
    document.getElementById("order-qty-" + product);

  if (quantityElement) {
    quantityElement.textContent =
      orderQuantities[product];
  }

  updateOrderTotal();
}

function updateOrderTotal() {

  const totalItems =
    orderQuantities.can20 +
    orderQuantities.pack1 +
    orderQuantities.pack500;

  const totalPrice =
    orderQuantities.can20 * orderPrices.can20 +
    orderQuantities.pack1 * orderPrices.pack1 +
    orderQuantities.pack500 * orderPrices.pack500;

  const checkoutText =
    document.getElementById("order-checkout-text");

  if (!checkoutText) {
    return;
  }

  if (totalItems === 0) {
    checkoutText.textContent = "Cart is empty";
    return;
  }

  checkoutText.textContent =
    totalItems +
    (totalItems === 1 ? " item · ₹" : " items · ₹") +
    totalPrice;
}

function askBulkOrder() {
  alert("Bulk order enquiry for 50+ cans.");
}

function checkoutOrder() {
  alert("Checkout selected.");
}

window.renderOrderScreen = renderOrderScreen;
window.changeOrderQuantity = changeOrderQuantity;
window.updateOrderTotal = updateOrderTotal;