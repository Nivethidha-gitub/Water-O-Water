async function loadFallbackQueue() {
  const rows = await window.apiGet("/ops/fallback-queue");
  const el = document.getElementById("fallback-list");
  if (rows.length === 0) {
    el.innerHTML = "<p class='muted'>No stalled orders. Trigger timeout from a placed order first.</p>";
    return;
  }
  el.innerHTML = rows
    .map((order) => {
      return (
        "<div class='cat-item'><div><h4>" +
        order.code +
        "</h4><span class='muted'>consent=" +
        order.customerConsentedFallback +
        "</span></div>" +
        "<button class='btn btn-primary' data-id='" +
        order.id +
        "'>Assign Sri Balaji</button></div>"
      );
    })
    .join("");
}

async function onFallbackClick(event) {
  const btn = event.target.closest("button[data-id]");
  if (!btn) {
    return;
  }
  await window.apiPost("/ops/orders/" + btn.dataset.id + "/fallback-assign", {
    supplierId: "sup-balaji",
  });
  window.showToast("Backup assigned");
  await loadFallbackQueue();
}

window.addEventListener("DOMContentLoaded", loadFallbackQueue);
