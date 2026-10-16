function renderSupplier(data) {
  const table = document.getElementById("live-orders");
  table.innerHTML = data.orders
    .map((order) => {
      const customer = data.customer.name;
      return (
        "<tr><td>" +
        order.code +
        "</td><td>" +
        customer +
        "</td><td>" +
        order.qty +
        " × 20L</td><td>" +
        (order.riderName || "—") +
        "</td><td><span class='status-pill " +
        window.statusClass(order.status) +
        "'>" +
        window.statusLabel(order.status) +
        "</span></td><td>" +
        actionButtons(order) +
        "</td></tr>"
      );
    })
    .join("");
}

function actionButtons(order) {
  if (order.status === "placed") {
    return "<button class='btn btn-light' data-act='accept' data-id='" + order.id + "'>Accept</button>";
  }
  if (order.status === "accepted") {
    return "<button class='btn btn-light' data-act='start' data-id='" + order.id + "'>Start route</button>";
  }
  if (order.status === "out_for_delivery") {
    return "<button class='btn btn-light' data-act='deliver' data-id='" + order.id + "'>Deliver</button>";
  }
  return "";
}

async function onSupplierClick(event) {
  const btn = event.target.closest("button[data-act]");
  if (!btn) {
    return;
  }
  const id = btn.dataset.id;
  if (btn.dataset.act === "accept") {
    await window.apiPost("/orders/" + id + "/accept", {});
  }
  if (btn.dataset.act === "start") {
    await window.apiPost("/orders/" + id + "/start", {});
  }
  if (btn.dataset.act === "deliver") {
    await window.apiPost("/deliveries", {
      orderId: id,
      fullOut: 2,
      emptyIn: 2,
      paymentMode: "upi",
      amountCollectedPaise: 8000,
    });
  }
  window.showToast("Updated " + id.slice(0, 8));
  await window.refreshApp();
}

window.renderSupplier = renderSupplier;
window.onSupplierClick = onSupplierClick;
