import api from "./client";

export const loginUser = async (identifier, password, role) => {
  const response = await api.post("/auth/login", { identifier, password, role });
  return response.data.data;
};

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data.data;
};

export const logoutUser = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

/** Public list used by the rider sign-up ("which supplier do you deliver for?"). */
export const getPublicSuppliers = async () => {
  const response = await api.get("/auth/suppliers");
  return response.data.data;
};

export const sendSignupOtp = async (phone) => (await api.post("/auth/otp/send", { phone })).data.data;
export const verifySignupOtp = async (phone, code) => (await api.post("/auth/otp/verify", { phone, code })).data.data;
