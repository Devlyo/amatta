import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { TOKENS } from '../../src/ui/palette';
import { SPACING } from '../../src/ui/spacing';
import { CalendarBody } from '../../src/ui/drawers/CalendarDrawer';

// Calendar as a native SHORT sheet (formSheet route, registered in _layout).
// No gorhom (its backdrop/gesture ate the first tap after dismiss). CalendarBody
// is flex:1, so render it in a plain flex View — NOT a ScrollView (that collapses
// the flex child) and NOT a SafeAreaView (the formSheet owns its insets).
export default function CalendarRoute(): React.ReactElement {
  const router = useRouter();
  const handleClose = useCallback(() => router.back(), [router]);
  return (
    <View style={styles.root}>
      <CalendarBody onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Top padding clears the native sheet grabber so content isn't flush under it.
  root: { flex: 1, paddingTop: SPACING.xl, backgroundColor: TOKENS.surface },
});
