import api from "./client";

/** { items: [{ id, type, orderId, title, body, createdAt, readAt }], unreadCount } */
export const getNotifications = async () => (await api.get("/notifications")).data.data;
export const markAllNotificationsRead = async () => (await api.post("/notifications/read-all")).data.data;
export const markNotificationRead = async (id) => (await api.post(`/notifications/${id}/read`)).data.data;
