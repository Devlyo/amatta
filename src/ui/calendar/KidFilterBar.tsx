// Kid filter row — ADR-007 §2. Shared by the day / week / month views.
//
// One pill per kid plus 보호자 (guardian). Border = the owner's deep tone,
// fill = owner colour at 25% (guardian 40%), avatar + name centred.
// Tapping a pill focuses it (other pills fade to 45%, other kids' blocks to
// 20%); tapping the focused pill again clears focus.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Child } from '../../domain/types';
import type { FocusKey } from '../../state/ui-store';
import { KidAvatar } from '../common/KidAvatar';
import { IconPerson } from '../icons';
import { getKidPalette, TOKENS, withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';

export const PILL_FADED_OPACITY = 0.45;

interface Props {
  kids: readonly Child[];
  focusKey: FocusKey | null;
  onToggle: (key: FocusKey) => void;
}

function Pill({
  label,
  border,
  fill,
  faded,
  selected,
  onPress,
  testID,
  children,
}: {
  label: string;
  border: string;
  fill: string;
  faded: boolean;
  selected: boolean;
  onPress: () => void;
  testID: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} 일정만 강조`}
      accessibilityState={{ selected }}
      testID={testID}
      style={[
        styles.pill,
        { borderColor: border, backgroundColor: fill, opacity: faded ? PILL_FADED_OPACITY : 1 },
      ]}
    >
      {children}
      <Text style={styles.name} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function KidFilterBarImpl({ kids, focusKey, onToggle }: Props): React.ReactElement {
  const faded = (key: FocusKey): boolean => focusKey !== null && focusKey !== key;
  return (
    <View style={styles.row}>
      {kids.map((kid) => {
        const p = getKidPalette(kid.colorIndex);
        return (
          <Pill
            key={kid.id}
            label={kid.name}
            border={p.deep}
            fill={withAlpha(p.source, 0.25)}
            faded={faded(kid.id)}
            selected={focusKey === kid.id}
            onPress={() => onToggle(kid.id)}
            testID={`kid-filter-${kid.id}`}
          >
            <KidAvatar child={kid} size={22} />
          </Pill>
        );
      })}
      <Pill
        label="보호자"
        border={TOKENS.guardianDeep}
        fill={withAlpha(TOKENS.guardian, 0.4)}
        faded={faded('guardian')}
        selected={focusKey === 'guardian'}
        onPress={() => onToggle('guardian')}
        testID="kid-filter-guardian"
      >
        <View style={styles.guardianAvatar}>
          <IconPerson size={14} color={TOKENS.ink} />
        </View>
      </Pill>
    </View>
  );
}

export const KidFilterBar = memo(KidFilterBarImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },
  name: { ...TYPE.footnote, fontFamily: TYPE.caption.fontFamily, color: TOKENS.ink, flexShrink: 1 },
  guardianAvatar: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.guardian,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
