import { useCallback } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { SPACING } from '../../src/ui/spacing';
import { GuardianEventDetailContent } from '../../src/ui/drawers/GuardianEventDetail';
import { makeStyles } from '../../src/ui/appearance';

// Guardian (device calendar) event detail — same modal presentation as a kid
// event's detail (app/event/detail.tsx), ADR-008.
export default function GuardianEventRoute(): React.ReactElement {
  const styles = useStyles();
  const router = useRouter();
  const { eventId, instance, end } = useLocalSearchParams<{ eventId: string; instance: string; end?: string }>();
  const handleClose = useCallback(() => router.back(), [router]);
  return (
    <View style={styles.root}>
      <GuardianEventDetailContent
        eventId={eventId ?? ''}
        instance={instance ?? ''}
        instanceEnd={end ?? ''}
        onClose={handleClose}
      />
    </View>
  );
}

const useStyles = makeStyles((th) => ({
  root: { flex: 1, paddingTop: SPACING.sm, backgroundColor: th.t.groupedBg },
}));
