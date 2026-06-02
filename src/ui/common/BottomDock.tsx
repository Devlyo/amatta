// 1:1 port of BottomDockB in docs/design/amatta-v1/app-daily-b.jsx:810–841.
//
// Wrapper: absolute, left 14, right 14, bottom 22.
// Inner: white pill, radius 99, padding '6 16', gap 10.
//   CSS grid '1fr auto 1fr' → flex row with first/last flex:1, FAB auto.
//   Shadow: '0 10px 26px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.04),
//            0 0 0 1px rgba(0,0,0,0.04)' →
//   RN: shadowColor+Offset+Opacity+Radius for the soft drop, plus a
//   StyleSheet.hairlineWidth border for the 1px outline.
// LEFT: home button — IconHome 26, primary (active).
// CENTER: 44×44, radius 99, bg ink (#1D1D1B), IconPlus 24 white. Shadow
//   '0 4px 10px rgba(29,29,27,0.25)'.
// RIGHT: gear button — IconGear 26 inkSub.

import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconGear, IconHome, IconPlus } from '../icons';
import { TOKENS } from '../palette';

interface Props {
  onPressHome?: () => void; // active tab — no-op in R2 (already on home)
  onPressAdd: () => void;   // opens NewEventDrawer (=> openEditSheet('create'))
  onPressGear: () => void;  // navigates to /(tabs)/settings
}

function BottomDockImpl({ onPressHome, onPressAdd, onPressGear }: Props): React.ReactElement {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.bar}>
        <Pressable
          onPress={onPressHome}
          accessibilityRole="button"
          accessibilityLabel="홈"
          style={styles.sideBtn}
        >
          <IconHome size={26} color={TOKENS.primary} />
        </Pressable>
        <Pressable
          onPress={onPressAdd}
          accessibilityRole="button"
          accessibilityLabel="일정 추가"
          style={styles.fab}
        >
          <IconPlus size={24} color={TOKENS.surface} />
        </Pressable>
        <Pressable
          onPress={onPressGear}
          accessibilityRole="button"
          accessibilityLabel="설정"
          style={styles.sideBtn}
        >
          <IconGear size={26} color={TOKENS.inkSub} />
        </Pressable>
      </View>
    </View>
  );
}

export const BottomDock = memo(BottomDockImpl);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 22,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.surface,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 10,
    // 0 10px 26px rgba(0,0,0,0.10) — main drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 8,
    // 0 0 0 1px rgba(0,0,0,0.04) — 1px outline; RN can't stack shadows so we
    // emulate the outline with a hairline border.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  // First/last column are 1fr each in the prototype grid; center is auto.
  // dockBtnB helper just gives padding 2 with column flex.
  sideBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D1D1B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
});
