
const API_BASE_URL = "http://127.0.0.1:3001/v1";

export async function getOrders() {
  const response = await fetch(
    `${API_BASE_URL}/orders`
  );

  if (!response.ok) {
    throw new Error("Failed to load orders");
  }

  const result = await response.json();

  return result.data;
}

export async function getProducts() {
  const response = await fetch(
    `${API_BASE_URL}/products`
  );

  if (!response.ok) {
    throw new Error("Failed to load products");
  }

  const result = await response.json();

  return result.data;
}

export async function acceptOrder(orderId, expectedVersion) {
  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/accept`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedVersion,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "Failed to accept order"
    );
  }

  return result.data;
}

export async function startDelivery(orderId) {
  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/start`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "Failed to start delivery"
    );
  }

  return result.data;
}

export async function createProduct(product) {
  const response = await fetch(
    `${API_BASE_URL}/products`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(product),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "Failed to create product"
    );
  }

  return result.data;
}
export async function deleteProduct(productId) {
  const response = await fetch(
    `${API_BASE_URL}/products/${productId}`,
    {
      method: "DELETE",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "Failed to delete product"
    );
  }

  return result.data;
}
export async function getServiceAreas() {
  const response = await fetch(
    `${API_BASE_URL}/service-areas`
  );

  if (!response.ok) {
    throw new Error("Failed to load service areas");
  }

  const result = await response.json();

  return result.data;
}

export async function createServiceArea(name) {
  const response = await fetch(
    `${API_BASE_URL}/service-areas`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "Failed to create service area"
    );
  }

  return result.data;
}

