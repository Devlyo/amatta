// 1:1 port of docs/design/amatta-v1/app-weekly-drawers.jsx KidDrawer.
// Bottom sheet listing the user's kids; tapping a kid commits the choice
// via the `onPick` callback supplied by the parent screen. The active
// kid gets an ink04 background + a black checkmark chip.
//
// Driven by useUiStore.kidSwitchDrawerOpen; parent screens (currently
// /child/[id]) bridge their local `currentKidId` and `setKidId` to the
// drawer via the onPick prop.

import { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useChildrenStore } from '../../state/children-store';
import { useUiStore } from '../../state/ui-store';
import type { Child } from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { FONT_FAMILIES } from '../fonts';
import { IconCheck } from '../icons';
import { TOKENS } from '../palette';

interface Props {
  currentKidId: number | null;
  onPick: (kidId: number) => void;
}

function KidSwitchDrawerImpl({
  currentKidId,
  onPick,
}: Props): React.ReactElement {
  const open = useUiStore((s) => s.kidSwitchDrawerOpen);
  const close = useUiStore((s) => s.closeKidSwitch);
  const children = useChildrenStore((s) => s.children);

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={close}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet} testID="kid-switch-drawer">
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        <Text style={styles.title}>자녀 선택</Text>
        <View style={styles.list}>
          {children.map((k: Child) => {
            const isActive = k.id === currentKidId;
            return (
              <Pressable
                key={k.id}
                onPress={() => {
                  onPick(k.id);
                  close();
                }}
                accessibilityRole="button"
                accessibilityLabel={`${k.name} 선택`}
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.row,
                  isActive ? styles.rowActive : null,
                ]}
              >
                <KidAvatar child={k} size={28} />
                <View style={styles.nameWrap}>
                  <Text style={styles.name}>{k.name}</Text>
                </View>
                {isActive ? (
                  <View style={styles.checkChip}>
                    <IconCheck size={12} color={TOKENS.surface} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

export const KidSwitchDrawer = memo(KidSwitchDrawerImpl);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,29,27,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 18,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKENS.ink30,
  },
  title: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 12,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  rowActive: {
    backgroundColor: TOKENS.ink04,
  },
  nameWrap: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  checkChip: {
    width: 22,
    height: 22,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
