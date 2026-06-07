import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { TOKENS } from '../../src/ui/palette';
import { SPACING } from '../../src/ui/spacing';
import { SearchContent } from '../../src/ui/drawers/SearchDrawer';

// Search — native formSheet route (no gorhom). SearchContent owns its query
// state + result navigation; iOS handles the keyboard for the plain TextInput
// inside via the ScrollView's automaticallyAdjustKeyboardInsets.
export default function SearchRoute(): React.ReactElement {
  const router = useRouter();
  const handleClose = useCallback(() => router.back(), [router]);
  return (
    <View style={styles.root}>
      <SearchContent onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Top padding clears the native sheet grabber so content isn't flush under it.
  root: { flex: 1, paddingTop: SPACING.xl, backgroundColor: TOKENS.surface },
});
