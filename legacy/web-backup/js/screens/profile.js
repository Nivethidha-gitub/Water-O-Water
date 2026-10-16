async function renderProfile(data) {
  const bal = await window.apiGet(
    "/balances/" + encodeURIComponent(data.customer.householdId)
  );

  document.getElementById("profile-balance").textContent =
    "Due " +
    window.formatPaise(bal.duePaise) +
    " · cans held " +
    bal.cansHeld;
}

window.renderProfile = renderProfile;