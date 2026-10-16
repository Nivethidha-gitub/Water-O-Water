const API_BASE_URL = "http://10.75.85.7:3001/v1";

export async function getBootstrap(customerId = "cust-ayesha") {
  const response = await fetch(
    `${API_BASE_URL}/bootstrap?customerId=${customerId}`
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error?.message || "Failed to load app data"
    );
  }

  return json.data;
}

export async function checkHealth() {
  const response = await fetch(
    `${API_BASE_URL}/health`
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error("Backend is not reachable");
  }

  return json.data;
}

export async function createOrder(orderData) {
  const response = await fetch(
    `${API_BASE_URL}/orders`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(orderData),
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error?.message || "Failed to create order"
    );
  }

  return json.data;
}
export async function getProducts() {
  const response = await fetch(
    `${API_BASE_URL}/products`
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error?.message || "Failed to load products"
    );
  }

  return json.data;
}