import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../i18n";

import { getVerification, submitVerification } from "../../api/rider";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useSignOut } from "../../components/Header";
import usePolling from "../../hooks/usePolling";
import Icon from "../../components/Icon";
import IdUploadForm, { validateId } from "../../components/IdUploadForm";
import { Button, Card, ErrorBanner, Loading, Row, Screen } from "../../components/ui";
import { colors, fonts, radius } from "../../theme/colors";
import { formatDateTime } from "../../utils/format";

/*
 * Shown instead of the deliveries until the rider's supplier approves the ID they uploaded.
 *  pending  -> waiting for the supplier (checks every 15 seconds)
 *  rejected -> the reason, and a form to upload the ID again
 * When the status becomes "approved" the user is refreshed and the normal rider app opens.
 */
export default function RiderVerification() {
  const { refreshUser } = useAuth();
  const signOut = useSignOut();
  const [v, setV] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [doc, setDoc] = useState({ idType: "", idNumber: "", idPhoto: "", idUri: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const status = await getVerification();
      setV(status);
      setError("");
      if (status.status === "approved") await refreshUser(); // opens the rider app
    } catch (e) {
      setError(errorMessage(e, "Could not check your approval."));
    }
  }, [refreshUser]);
  usePolling(load, 15000);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resubmit = async () => {
    const found = validateId(doc);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      setV(await submitVerification({ idType: doc.idType, idNumber: doc.idNumber.trim(), idPhoto: doc.idPhoto }));
      setDoc({ idType: "", idNumber: "", idPhoto: "", idUri: "" });
    } catch (e) {
      setError(errorMessage(e, "Could not upload your ID."));
    } finally {
      setBusy(false);
    }
  };

  if (!v && !error) return <Screen brand scroll={false}><Loading /></Screen>;
  const rejected = v && v.status === "rejected";

  return (
    <Screen brand subtitle="Rider" refreshing={refreshing} onRefresh={refresh}>
      <ErrorBanner message={error} onRetry={load} />
      {v ? (
        <>
          <View style={styles.hero}>
            <View style={[styles.badge, rejected && styles.badgeBad]}>
              <Icon name={rejected ? "alert-circle" : "clock"} size={30} color={rejected ? colors.danger : colors.primary} />
            </View>
            <Text style={styles.title}>{rejected ? "Your ID Was Not Accepted" : "Waiting for Approval"}</Text>
            <Text style={styles.text}>
              {rejected
                ? v.note || "Please upload your ID again."
                : `${v.supplierName || "Your supplier"} is checking the ID you uploaded. You can start deliveries as soon as it is approved.`}
            </Text>
          </View>

          <Card>
            <Row label="Supplier" value={v.supplierName || "—"} />
            <Row label="ID Type" value={v.idTypeLabel || "—"} />
            <Row label="ID Number" value={v.idLast4 ? `•••• ${v.idLast4}` : "—"} />
            <Row label="Submitted" value={v.submittedAt ? formatDateTime(v.submittedAt) : "—"} />
          </Card>

          {rejected ? (
            <View style={{ marginTop: 16 }}>
              <IdUploadForm value={doc} onChange={(patch) => setDoc((d) => ({ ...d, ...patch }))} errors={errors} />
              <Button title="Upload ID Again" busy={busy} onPress={resubmit} style={{ marginTop: 14 }} />
            </View>
          ) : (
            <Text style={styles.foot}>This page updates by itself. You can also pull down to refresh.</Text>
          )}
        </>
      ) : null}
      <Button title="Sign Out" variant="outline" onPress={signOut} style={{ marginTop: 18 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", backgroundColor: colors.can, borderRadius: radius.xl, padding: 22, marginBottom: 14, borderWidth: 1, borderColor: colors.canLine },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  badgeBad: { backgroundColor: colors.dangerBg },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.primaryDark, textAlign: "center" },
  text: { fontFamily: fonts.body, fontSize: 13.5, color: colors.inkSoft, textAlign: "center", marginTop: 6, lineHeight: 20 },
  foot: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint, textAlign: "center", marginTop: 14 },
});
