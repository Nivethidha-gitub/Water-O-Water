/*
 * Background / mobile push hook (not enabled by default).
 *
 * The ordering system never talks to a push provider directly. It only calls
 * notifier.notify(...), which fans out to every registered channel. To add
 * Web Push, FCM or Expo push later:
 *
 *   1. store device tokens for a user (e.g. a `device_tokens` table),
 *   2. implement `deliver` below to look up the recipient's tokens and call
 *      the provider,
 *   3. set PUSH_PROVIDER in the environment.
 *
 * No change to orders, routes or the UI is needed.
 */
function createPushChannel(config, log = console) {
  return {
    name: "push",
    enabled: Boolean(config.pushProvider),
    async deliver(notification) {
      log.info(
        "[push:" + config.pushProvider + "] would notify " +
          notification.recipientType + " " + notification.recipientId +
          ": " + notification.title
      );
    },
  };
}

module.exports = { createPushChannel };
