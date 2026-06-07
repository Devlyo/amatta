import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useUiStore } from '../src/state/ui-store';
import { TOKENS } from '../src/ui/palette';
import { SPACING } from '../src/ui/spacing';
import { KidSwitchBody } from '../src/ui/drawers/KidSwitchDrawer';

// 자녀 선택 — native formSheet route (no gorhom). Host callback: the picked kid
// is written to ui-store.pendingKidId; /child/[id] consumes it on focus
// (useFocusEffect → router.setParams) to swap its lane.
export default function KidSwitchRoute(): React.ReactElement {
  const router = useRouter();
  const { currentKidId } = useLocalSearchParams<{ currentKidId?: string }>();
  const setPendingKidId = useUiStore((s) => s.setPendingKidId);

  return (
    <View style={styles.root}>
      <KidSwitchBody
        currentKidId={currentKidId !== undefined ? Number(currentKidId) : null}
        onPick={(kidId) => {
          setPendingKidId(kidId);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // No flex:1 — the sheet uses fitToContents, so the View hugs the body height.
  // Top padding clears the native sheet grabber.
  root: { paddingTop: SPACING.xl, backgroundColor: TOKENS.surface },
});
