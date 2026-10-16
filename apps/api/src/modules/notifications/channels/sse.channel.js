/* Real-time delivery to open browser tabs via the SSE hub. */
function createSseChannel(hub) {
  return {
    name: "sse",
    deliver(notification, payload) {
      hub.publish(
        notification.recipientType,
        notification.recipientId,
        payload.event,
        { notification, order: payload.order }
      );
    },
  };
}

module.exports = { createSseChannel };
