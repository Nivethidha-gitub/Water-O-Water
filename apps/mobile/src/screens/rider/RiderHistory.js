import React, { useCallback, useState } from "react";

import { getMyDeliveries, getRiderSummary } from "../../api/rider";
import RiderActivity from "../../components/RiderActivity";
import { errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import OrderCard from "../../components/OrderCard";
import { EmptyState, ErrorBanner, Loading, PageTitle, Screen } from "../../components/ui";
import { formatDateTime, timeOf } from "../../utils/format";

export default function RiderHistory({ navigation }) {
  const [list, setList] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([getMyDeliveries(), getRiderSummary().catch(() => null)]);
      setList(d.history); setSummary(s); setError("");
    }
    catch (e) { setError(errorMessage(e, "Could not load history.")); }
  }, []);
  usePolling(load, 30000);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!list && !error) return <Screen brand scroll={false}><Loading /></Screen>;

  return (
    <Screen brand subtitle="Rider" refreshing={refreshing} onRefresh={refresh}>
      <PageTitle title="Delivery History" subtitle="Orders You Have Delivered" />
      <ErrorBanner message={error} onRetry={load} />
      <RiderActivity summary={summary} />
      {list && list.length === 0 ? (
        <EmptyState icon="clipboard" title="No Deliveries Yet" text="Completed deliveries will be listed here." />
      ) : (
        (list || []).map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            showEta={false}
            subtitle={timeOf(o, "delivered") ? `Delivered ${formatDateTime(timeOf(o, "delivered"))}` : o.customer?.name}
            onPress={() => navigation.navigate("DeliveryDetail", { orderId: o.id })}
          />
        ))
      )}
    </Screen>
  );
}
