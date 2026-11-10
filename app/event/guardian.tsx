import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { TOKENS } from '../../src/ui/palette';
import { SPACING } from '../../src/ui/spacing';
import { GuardianEventDetailContent } from '../../src/ui/drawers/GuardianEventDetail';

// Guardian (device calendar) event detail — same modal presentation as a kid
// event's detail (app/event/detail.tsx), ADR-008.
export default function GuardianEventRoute(): React.ReactElement {
  const router = useRouter();
  const { eventId, instance } = useLocalSearchParams<{ eventId: string; instance: string }>();
  const handleClose = useCallback(() => router.back(), [router]);
  return (
    <View style={styles.root}>
      <GuardianEventDetailContent eventId={eventId ?? ''} instance={instance ?? ''} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: SPACING.sm, backgroundColor: TOKENS.groupedBg },
});
