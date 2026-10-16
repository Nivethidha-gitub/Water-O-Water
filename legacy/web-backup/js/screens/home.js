let quickQuantities = {
  can20: 1,
  pack1: 0,
};

function renderHome(data) {
  const customer = data.customer;
  const order = data.orders && data.orders.length
    ? data.orders[0]
    : null;

  // Customer name
  document.getElementById("greet-name").textContent =
    "Hi, " + customer.name + " 👋";

  // Address
  document.getElementById("home-address").textContent =
    data.address ? data.address.line : "";

  // Avatar
  const avatar = document.getElementById("customer-avatar");

  if (avatar) {
    avatar.textContent = customer.name
      ? customer.name.charAt(0).toUpperCase()
      : "A";
  }

  // Latest order
  if (order) {
    document.getElementById("home-banner").textContent =
      "Order " +
      order.code +
      " · " +
      window.statusLabel(order.status) +
      " · " +
      order.eta;

    // Delivery text
    const deliveryText = document.getElementById("delivery-text");

    if (deliveryText) {
      deliveryText.textContent =
        "Arriving today by " +
        order.eta +
        " · Tap Track to follow along";
    }
  } else {
    document.getElementById("home-banner").textContent =
      "No orders yet.";

    const deliveryText = document.getElementById("delivery-text");

    if (deliveryText) {
      deliveryText.textContent =
        "No active delivery";
    }
  }

  // Restore current quantities
  updateQuickQuantity("can20");
  updateQuickQuantity("pack1");
}

function changeQuickQty(product, change) {
  if (!(product in quickQuantities)) {
    return;
  }

  quickQuantities[product] += change;

  // Never allow quantity below 0
  if (quickQuantities[product] < 0) {
    quickQuantities[product] = 0;
  }

  updateQuickQuantity(product);
}

function updateQuickQuantity(product) {
  const element = document.getElementById("qty-" + product);

  if (element) {
    element.textContent = quickQuantities[product];
  }
}

window.renderHome = renderHome;
window.changeQuickQty = changeQuickQty;