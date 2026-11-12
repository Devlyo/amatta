import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { SPACING } from '../../src/ui/spacing';
import { SearchContent } from '../../src/ui/drawers/SearchDrawer';
import { makeStyles } from '../../src/ui/appearance';

// Search — full native modal route (no gorhom; was a formSheet). SearchContent owns its query
// state + result navigation; iOS handles the keyboard for the plain TextInput
// inside via the ScrollView's automaticallyAdjustKeyboardInsets.
export default function SearchRoute(): React.ReactElement {
  const styles = useStyles();
  const router = useRouter();
  const handleClose = useCallback(() => router.back(), [router]);
  return (
    <View style={styles.root}>
      <SearchContent onClose={handleClose} />
    </View>
  );
}

const useStyles = makeStyles((th) => ({
  root: { flex: 1, paddingTop: SPACING.lg, backgroundColor: th.t.groupedBg },
}));
