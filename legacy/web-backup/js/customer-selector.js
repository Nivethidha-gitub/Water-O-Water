function renderCustomerSelector(data) {
  const select = document.getElementById("customerSelect");

  if (!select) {
    return;
  }

  select.innerHTML = "";

  data.customers.forEach((customer) => {
    const option = document.createElement("option");

    option.value = customer.id;
    option.textContent = customer.name;

    if (customer.id === data.customer.id) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

window.renderCustomerSelector = renderCustomerSelector;