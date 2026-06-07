// 1:1 port of the kid header row in docs/design/amatta-v1/app-daily-b.jsx:499–528.
//
// Layout: CSS grid `gridTemplateColumns: '40px repeat(N, minmax(0, 1fr))'`,
//   gap 4, padding '10px 12px 8px'. RN equivalent: a flex row with the first
//   child a 40px spacer (= GUTTER), then N children with `flex: 1`.
//
// Each kid pill: Pressable, flex-row, alignItems: center, gap 5,
//   padding '5px 6px', background ink04, borderRadius 99, minWidth 0.
//   Inside: KidAvatar size=30, then a row [name + chev-down 12 inkSub].
//   Name: 13/500/Pretendard, letterSpacing -0.3, single line.
//
// Tap → router.push(`/child/${childId}`).
//
// NOTE: amatta-v1 KIDS has `grade` and `age` strings ("초3", 10). Our domain
// `Child` has no such fields. TODO(v2-schema): when grade/age land, render the
// caption right after the name.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Child } from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { FONT_FAMILIES } from '../fonts';
import { IconChevronDown } from '../icons';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';

const GUTTER = 40;

interface Props {
  kids: Child[];
  onPressKid: (childId: number) => void;
}

function KidPillsHeaderImpl({ kids, onPressKid }: Props): React.ReactElement {
  // At the 4-kid cap each pill is ~1/4 of the row, so the avatar + name + chev
  // no longer fit and the name collapses to a single char. Shrink the avatar
  // and name one notch ONLY at 4 kids; 1–3 kids keep the comfortable sizing.
  const compact = kids.length >= 4;
  const avatarSize = compact ? 24 : 30;
  return (
    <View style={styles.row}>
      <View style={{ width: GUTTER }} />
      {kids.map((k) => (
        <Pressable
          key={k.id}
          onPress={() => onPressKid(k.id)}
          accessibilityRole="button"
          accessibilityLabel={`${k.name} 주간 보기`}
          style={[styles.pill, compact ? styles.pillCompact : null]}
        >
          <KidAvatar child={k} size={avatarSize} />
          {/* name takes the remaining width so the chevron is pinned to the
              right edge of the pill regardless of name length. */}
          <Text
            style={[styles.name, compact ? styles.nameCompact : null]}
            numberOfLines={1}
          >
            {k.name}
          </Text>
          <IconChevronDown size={12} color={TOKENS.inkSub} />
          {/* TODO(v2-schema): amatta-v1 also shows grade ("초3") next to the
              name. Domain Child has no `grade` field yet — omit until v2. */}
        </Pressable>
      ))}
    </View>
  );
}

export const KidPillsHeader = memo(KidPillsHeaderImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingTop: 10,
    paddingRight: SPACING.md,
    paddingBottom: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: TOKENS.ink04,
    borderRadius: RADIUS.full,
  },
  pillCompact: {
    gap: 3,
    paddingHorizontal: SPACING.xs,
  },
  name: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendardMedium, // 500
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  nameCompact: {
    fontSize: 11,
  },
});
