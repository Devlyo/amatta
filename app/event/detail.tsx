import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useUiStore } from '../../src/state/ui-store';
import { TOKENS } from '../../src/ui/palette';
import { SPACING } from '../../src/ui/spacing';
import type { ISODate } from '../../src/domain/types';
import { EventDetailContent } from '../../src/ui/drawers/EventDetailDrawer';
import { useModalRouteShell } from '../../src/ui/navigation/useModalRouteShell';

// Read-only event detail — native formSheet route (no gorhom). The shell drives
// the ui-store eventDetail open/close so EventDetailContent (which reads the
// store) has its scheduleId/occurrenceDate. iOS swipe-down + router.back dismiss.
export default function EventDetailRoute(): React.ReactElement {
  const router = useRouter();
  const { scheduleId: sidParam, occurrenceDate } = useLocalSearchParams<{
    scheduleId: string;
    occurrenceDate: string;
  }>();
  const scheduleId = Number(sidParam);
  const openEventDetail = useUiStore((s) => s.openEventDetail);
  const closeEventDetail = useUiStore((s) => s.closeEventDetail);

  useModalRouteShell(
    () => openEventDetail({ scheduleId, occurrenceDate: occurrenceDate as ISODate }),
    closeEventDetail,
    [scheduleId, occurrenceDate],
  );

  const handleClose = useCallback(() => router.back(), [router]);

  return (
    <View style={styles.root}>
      <EventDetailContent onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Top padding so the header isn't flush against the modal's top edge.
  root: { flex: 1, paddingTop: SPACING.xl, backgroundColor: TOKENS.surfaceWarm },
});
