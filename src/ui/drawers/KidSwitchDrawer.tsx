// Kid-switch BODY (자녀 선택). Presented as the gorhom bottom-sheet route
// app/kid-switch.tsx (see ralplan-drawer-route-modal.md). Lists the user's kids;
// tapping one commits via the `onPick` callback. Active kid gets an ink04
// background + a black checkmark chip.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useChildrenStore } from '../../state/children-store';
import type { Child } from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { FONT_FAMILIES } from '../fonts';
import { IconCheck } from '../icons';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';

export interface KidSwitchBodyProps {
  currentKidId: number | null;
  onPick: (kidId: number) => void;
}

export function KidSwitchBody({
  currentKidId,
  onPick,
}: KidSwitchBodyProps): React.ReactElement {
  const children = useChildrenStore((s) => s.children);

  return (
    <View style={styles.body} testID="kid-switch-drawer">
      <Text style={styles.title}>자녀 선택</Text>
      <View style={styles.list}>
        {children.map((k: Child) => {
          const isActive = k.id === currentKidId;
          return (
            <Pressable
              key={k.id}
              onPress={() => onPick(k.id)}
              accessibilityRole="button"
              accessibilityLabel={`${k.name} 선택`}
              accessibilityState={{ selected: isActive }}
              style={[styles.row, isActive ? styles.rowActive : null]}
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
  );
}

const styles = StyleSheet.create({
  // De-chromed: the gorhom route sheet owns scrim/shape/grabber.
  body: { paddingBottom: 18 },
  title: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  list: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  rowActive: {
    backgroundColor: TOKENS.ink04,
  },
  nameWrap: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  checkChip: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
