import { useCallback } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useUiStore, type EditSheetMode } from '../../src/state/ui-store';
import { SPACING } from '../../src/ui/spacing';
import type { ISODate } from '../../src/domain/types';
import { ScheduleEditContent } from '../../src/ui/sheets/ScheduleEditSheet';
import { useModalRouteShell } from '../../src/ui/navigation/useModalRouteShell';
import { makeStyles } from '../../src/ui/appearance';

// New/Edit schedule — native formSheet route (no gorhom). The shell drives the
// ui-store editSheet open/close from route params; ScheduleEditContent reads the
// store. iOS handles the keyboard for the form's TextInputs via the ScrollView's
// automaticallyAdjustKeyboardInsets. The in-place editAll→editOccurrence switch
// mutates the store directly, so the open effect runs once on mount.
export default function ScheduleEditRoute(): React.ReactElement {
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    scheduleId?: string;
    occurrenceDate?: string;
    childId?: string;
    date?: string;
    start?: string;
    guardian?: string;
    eventId?: string;
    instance?: string;
  }>();
  const openEditSheet = useUiStore((s) => s.openEditSheet);
  const closeEditSheet = useUiStore((s) => s.closeEditSheet);

  useModalRouteShell(
    () => {
      const mode = (params.mode ?? 'create') as Exclude<EditSheetMode, 'closed'>;
      openEditSheet(mode, {
        scheduleId:
          params.scheduleId !== undefined ? Number(params.scheduleId) : undefined,
        occurrenceDate: params.occurrenceDate as ISODate | undefined,
        preFill: {
          childId: params.childId !== undefined ? Number(params.childId) : undefined,
          date: params.date as ISODate | undefined,
          startMinutes: params.start !== undefined ? Number(params.start) : undefined,
          guardian: params.guardian === '1',
        },
        guardianEventId: params.eventId,
        guardianInstance: params.instance,
      });
    },
    closeEditSheet,
    [params.mode, params.scheduleId, params.occurrenceDate, params.childId, params.date, params.start, params.guardian, params.eventId, params.instance],
  );

  const handleClose = useCallback(() => router.back(), [router]);

  return (
    <View style={styles.root}>
      <ScheduleEditContent onClose={handleClose} />
    </View>
  );
}

const useStyles = makeStyles((th) => ({
  // Top padding so the header isn't flush against the modal's top edge.
  root: { flex: 1, paddingTop: SPACING.sm, backgroundColor: th.t.groupedBg },
}));
