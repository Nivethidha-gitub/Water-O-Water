let currentCustomerId = null;

async function refreshApp(customerId = currentCustomerId) {
  let url = "/bootstrap";

  if (customerId) {
    url += "?customerId=" + encodeURIComponent(customerId);
  }

  const data = await window.apiGet(url);

  currentCustomerId = data.customer.id;

  window.renderHome(data);
  window.renderOrderScreen(data);
  window.renderTrack(data);
  await window.renderProfile(data);
  window.renderSupplier(data);

  window.renderCustomerSelector(data);
}

function setMode(mode) {
  document
    .getElementById("customerPhone")
    .classList.toggle("hidden", mode !== "customer");

  document
    .getElementById("supplierDash")
    .classList.toggle("active", mode === "supplier");

  document
    .getElementById("supplierDash")
    .classList.toggle("hidden", mode !== "supplier");

  document.querySelectorAll(".mode-switch button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
}

async function startApp() {
  try {
    await refreshApp();
  } catch (err) {
    window.showToast("API error: " + err.message);
    console.error(err);
  }
}

window.refreshApp = refreshApp;
window.setMode = setMode;

window.changeCustomer = async function (customerId) {
  try {
    await refreshApp(customerId);
  } catch (err) {
    window.showToast("Unable to change customer: " + err.message);
    console.error(err);
  }
};

window.addEventListener("DOMContentLoaded", startApp);