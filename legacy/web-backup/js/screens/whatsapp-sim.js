async function sendWa() {
  const input = document.getElementById("wa-text");
  const result = await window.apiPost("/webhooks/whatsapp", {
    text: input.value,
    customerId: "cust-ayesha",
  });
  const log = document.getElementById("wa-log");
  log.innerHTML +=
    "<p><b>You:</b> " +
    input.value +
    "</p><p><b>Bot:</b> " +
    result.reply +
    "</p>";
  input.value = "";
}

window.sendWa = sendWa;
