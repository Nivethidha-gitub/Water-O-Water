function formatPaise(paise) {
  const rupees = Number(paise || 0) / 100;
  return "₹" + rupees.toFixed(0);
}

function statusLabel(status) {
  if (status === "out_for_delivery") {
    return "Out for delivery";
  }
  if (status === "fallback_offered") {
    return "Fallback offered";
  }
  return status;
}

function statusClass(status) {
  if (status === "delivered" || status === "settled") {
    return "p-delivered";
  }
  if (status === "out_for_delivery" || status === "fallback_offered") {
    return "p-transit";
  }
  return "p-new";
}

window.formatPaise = formatPaise;
window.statusLabel = statusLabel;
window.statusClass = statusClass;
