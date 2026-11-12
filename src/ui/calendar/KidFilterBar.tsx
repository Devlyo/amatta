// People filter row — ADR-007 §2. Shared by the day / week / month views.
//
// One pill per kid plus 보호자 (guardian). Border = the owner's deep tone,
// fill = owner colour at 25% (guardian 40%), avatar + name centred.
// Everyone starts active. Short tap = switch that person off/on; long press =
// that person only (long press again = everyone). Inactive pills fade to 45%,
// their blocks to 20% (see domain/people-filter).

import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Child } from '../../domain/types';
import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import { KidAvatar } from '../common/KidAvatar';
import { IconPerson } from '../icons';
import { withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { makeStyles, useTheme } from '../appearance';

export const PILL_FADED_OPACITY = 0.45;

interface Props {
  kids: readonly Child[];
  inactive: readonly PersonKey[];
  onToggle: (key: PersonKey) => void;
  onSolo: (key: PersonKey) => void;
  /** 보호자 as a person (pill / column). False while 보호자 일정 is off in 설정. */
  guardian?: boolean;
}

/** Hold time for "this person only". */
const LONG_PRESS_MS = 350;
/** From this many pills (kids + 보호자) on, pills switch to the compact size. */
const COMPACT_FROM = 5;
/** From this many pills on, names are dropped (avatar only; name stays the a11y label). */
const AVATAR_ONLY_FROM = 7;

function Pill({
  label,
  border,
  fill,
  faded,
  selected,
  onPress,
  onLongPress,
  compact,
  avatarOnly,
  testID,
  children,
}: {
  label: string;
  border: string;
  fill: string;
  faded: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  compact: boolean;
  avatarOnly: boolean;
  testID: string;
  children: React.ReactNode;
}): React.ReactElement {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="누르면 켜고 끄기, 길게 누르면 이 사람만 보기"
      accessibilityState={{ selected }}
      testID={testID}
      style={[
        styles.pill,
        compact ? styles.pillCompact : null,
        { borderColor: border, backgroundColor: fill, opacity: faded ? PILL_FADED_OPACITY : 1 },
      ]}
    >
      {children}
      {avatarOnly ? null : (
        <Text style={compact ? styles.nameCompact : styles.name} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function KidFilterBarImpl({ kids, inactive, onToggle, onSolo, guardian = true }: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const everyone: PersonKey[] = guardian ? [...kids.map((k) => k.id), 'guardian'] : kids.map((k) => k.id);
  const faded = (key: PersonKey): boolean => emphasisOf(inactive, everyone, key) === 'inactive';
  // Up to 6 people (5 kids + 보호자) must fit one row on a 375pt phone.
  const compact = everyone.length >= COMPACT_FROM;
  const avatarOnly = everyone.length >= AVATAR_ONLY_FROM;
  // Kids and 보호자 are both circles now (board AV1-B) → same size.
  const guardianDot = avatarOnly ? 24 : compact ? 18 : 22;
  const avatar = guardianDot;
  return (
    <View style={styles.row}>
      {kids.map((kid) => {
        const p = theme.kid(kid.colorIndex); // dark deep tones in dark (ADR-009)
        return (
          <Pill
            key={kid.id}
            label={kid.name}
            border={theme.scheme === 'dark' ? p.deep : p.bar}
            fill={withAlpha(p.source, 0.25)}
            faded={faded(kid.id)}
            selected={!faded(kid.id)}
            onPress={() => onToggle(kid.id)}
            onLongPress={() => onSolo(kid.id)}
            compact={compact}
            avatarOnly={avatarOnly}
            testID={`kid-filter-${kid.id}`}
          >
            <KidAvatar child={kid} size={avatar} />
          </Pill>
        );
      })}
      {guardian ? (
      <Pill
        label="보호자"
        border={theme.t.guardianDeep}
        fill={withAlpha(theme.t.guardian, 0.4)}
        faded={faded('guardian')}
        selected={!faded('guardian')}
        onPress={() => onToggle('guardian')}
        onLongPress={() => onSolo('guardian')}
        compact={compact}
        avatarOnly={avatarOnly}
        testID="kid-filter-guardian"
      >
        <View style={[styles.guardianAvatar, { width: guardianDot, height: guardianDot }]}>
          <IconPerson size={avatarOnly ? 15 : compact ? 12 : 14} color={theme.t.ink} />
        </View>
      </Pill>
      ) : null}
    </View>
  );
}

export const KidFilterBar = memo(KidFilterBarImpl);

const useStyles = makeStyles((th) => ({
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
  pillCompact: { gap: 3, paddingHorizontal: 4 },
  name: { ...TYPE.footnote, fontFamily: TYPE.caption.fontFamily, color: th.t.ink, flexShrink: 1 },
  nameCompact: { ...TYPE.caption2, color: th.t.ink, flexShrink: 1, letterSpacing: -0.4 },
  guardianAvatar: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.guardian,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
