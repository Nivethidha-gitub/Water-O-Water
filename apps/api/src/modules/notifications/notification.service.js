const db = require("../../db/database");
const { newId } = require("../../store/ids");

const COLUMNS = `
  id, recipient_type AS recipientType, recipient_id AS recipientId, type,
  order_id AS orderId, title, body, created_at AS createdAt, read_at AS readAt
`;

/*
 * Notification service: persists a notification for exactly one recipient
 * and fans it out to every registered channel (SSE now, push later).
 */
function createNotificationService() {
  const channels = [];

  function addChannel(channel) {
    if (channel.enabled === false) return;
    channels.push(channel);
  }

  /*
   * `dedupeKey` (optional) makes the call idempotent: the same key for the same recipient is stored
   * and delivered once. Returns the notification, or null when it had already been sent.
   */
  function notify({ recipientType, recipientId, type, orderId, title, body, event, order, dedupeKey }) {
    if (!recipientType || !recipientId) return null; // never send to "nobody"
    const notification = {
      id: newId(),
      recipientType,
      recipientId,
      type,
      orderId: orderId || null,
      title,
      body: body || "",
      createdAt: new Date().toISOString(),
      readAt: null,
    };

    const stored = db
      .prepare(
        `INSERT OR IGNORE INTO notifications
           (id, recipient_type, recipient_id, type, order_id, title, body, created_at, dedupe_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        notification.id,
        recipientType,
        recipientId,
        type,
        notification.orderId,
        title,
        notification.body,
        notification.createdAt,
        dedupeKey ? recipientType + ":" + recipientId + ":" + dedupeKey : null
      );
    if (stored.changes === 0) return null; // already sent for this event

    for (const channel of channels) {
      try {
        const result = channel.deliver(notification, { event: event || type, order });
        if (result && typeof result.catch === "function") {
          result.catch((err) => console.error("notification channel " + channel.name + ":", err.message));
        }
      } catch (err) {
        console.error("notification channel " + channel.name + ":", err.message);
      }
    }
    return notification;
  }

  function listFor(recipientType, recipientId, limit = 50) {
    const items = db
      .prepare(
        `SELECT ${COLUMNS} FROM notifications
          WHERE recipient_type = ? AND recipient_id = ?
          ORDER BY created_at DESC, rowid DESC LIMIT ?`
      )
      .all(recipientType, recipientId, limit);
    const unread = db
      .prepare(
        `SELECT COUNT(*) AS n FROM notifications
          WHERE recipient_type = ? AND recipient_id = ? AND read_at IS NULL`
      )
      .get(recipientType, recipientId).n;
    return { items, unreadCount: unread };
  }

  function markRead(recipientType, recipientId, id) {
    const result = db
      .prepare(
        `UPDATE notifications SET read_at = ?
          WHERE id = ? AND recipient_type = ? AND recipient_id = ? AND read_at IS NULL`
      )
      .run(new Date().toISOString(), id, recipientType, recipientId);
    const row = db
      .prepare(
        `SELECT ${COLUMNS} FROM notifications
          WHERE id = ? AND recipient_type = ? AND recipient_id = ?`
      )
      .get(id, recipientType, recipientId);
    return { updated: result.changes > 0, notification: row || null };
  }

  function markAllRead(recipientType, recipientId) {
    return db
      .prepare(
        `UPDATE notifications SET read_at = ?
          WHERE recipient_type = ? AND recipient_id = ? AND read_at IS NULL`
      )
      .run(new Date().toISOString(), recipientType, recipientId).changes;
  }

  return { addChannel, notify, listFor, markRead, markAllRead };
}

module.exports = { createNotificationService };
