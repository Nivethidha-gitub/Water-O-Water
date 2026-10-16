import { createNavigationContainerRef } from "@react-navigation/native";

// One navigation handle for the whole app, so things drawn outside a screen
// (the notification bell, the pop-up banner) can open a screen.
export const navRef = createNavigationContainerRef();

/** Opens the order a notification is about, or the Notifications list when it has no order. */
export function openNotification(role, data = {}) {
  const go = (tries = 0) => {
    if (!navRef.isReady()) { if (tries < 10) setTimeout(() => go(tries + 1), 300); return; }
    if (data.orderId) {
      const target = role === "CUSTOMER" ? "TrackOrder" : role === "SUPPLIER" ? "SupplierOrder" : "DeliveryDetail";
      navRef.navigate(target, { orderId: data.orderId });
    } else navRef.navigate("Notifications");
  };
  go();
}

export const openNotificationList = () => { if (navRef.isReady()) navRef.navigate("Notifications"); };
