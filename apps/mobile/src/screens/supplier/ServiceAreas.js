import React, { useCallback, useState } from "react";
import Icon from "../../components/Icon";
import { StyleSheet, View } from "react-native";
import { Text } from "../../i18n";
import { Alert } from "../../utils/alert";

import { addServiceArea, getServiceAreas } from "../../api/supplier";
import { errorMessage } from "../../api/client";
import usePolling from "../../hooks/usePolling";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, Screen, SectionTitle } from "../../components/ui";
import { colors, fonts } from "../../theme/colors";

export default function ServiceAreas({ navigation }) {
  const [areas, setAreas] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setAreas(await getServiceAreas()); setError(""); }
    catch (e) { setError(errorMessage(e, "Could not load service areas.")); }
  }, []);
  usePolling(load, 60000);

  const add = async () => {
    if (name.trim().length < 2) return Alert.alert("Enter an area", "For example: RS Puram, Coimbatore");
    setBusy(true);
    try { await addServiceArea(name.trim()); setName(""); await load(); }
    catch (e) { Alert.alert("Could Not Add Area", errorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Screen title="Service Areas" subtitle="Where You Deliver" onBack={() => navigation.goBack()} keyboard>
      <ErrorBanner message={error} onRetry={load} />
      {!areas && !error ? <Loading /> : areas && areas.length === 0 ? (
        <EmptyState icon="map-pin" title="No Service Areas Yet" text="Add the neighbourhoods you deliver to." />
      ) : (
        (areas || []).map((a) => (
          <Card key={a.id} style={styles.area}><Icon name="map-pin" size={18} /><Text style={styles.areaName}>{a.name}</Text></Card>
        ))
      )}
      <SectionTitle>Add an Area</SectionTitle>
      <Card>
        <Field label="Area Name" value={name} onChangeText={setName} placeholder="e.g. Peelamedu, Coimbatore" />
        <Button title="Add Area" onPress={add} busy={busy} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  area: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 },
  areaName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
});
