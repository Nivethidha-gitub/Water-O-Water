import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../i18n";

import { rateOrder } from "../api/customer";
import { errorMessage } from "../api/client";
import Icon from "./Icon";
import { Button, Card, ErrorBanner, Field } from "./ui";
import { colors, fonts } from "../theme/colors";

/*
 * After delivery the customer rates the order once (1-5 stars, optional comment).
 * Shows the saved rating afterwards. onRated(order) receives the updated order.
 */
export default function RatingCard({ order, onRated }) {
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (order.rating) {
    return (
      <Card>
        <Text style={styles.title}>Your Rating</Text>
        <View style={styles.stars}>{[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" size={22} color={n <= order.rating ? colors.accent : colors.canLine} />)}</View>
        {order.feedback ? <Text style={styles.note}>{order.feedback}</Text> : null}
      </Card>
    );
  }

  const submit = async () => {
    if (!stars) { setError("Choose a rating from 1 to 5 stars"); return; }
    setBusy(true);
    setError("");
    try {
      const updated = await rateOrder(order.id, stars, feedback.trim());
      if (onRated) onRated(updated);
    } catch (e) {
      setError(errorMessage(e, "Could not save your rating."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text style={styles.title}>Rate Your Delivery</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} stars`}>
            <Icon name="star" size={30} color={n <= stars ? colors.accent : colors.canLine} />
          </Pressable>
        ))}
      </View>
      <Field placeholder="Tell us how it went (optional)" value={feedback} onChangeText={setFeedback} maxLength={300} />
      <ErrorBanner message={error} />
      <Button title="Submit Rating" small busy={busy} onPress={submit} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.primaryDark },
  stars: { flexDirection: "row", gap: 8, marginVertical: 10 },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
});
