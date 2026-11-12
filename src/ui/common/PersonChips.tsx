// 참여 row value: each person as avatar + name ("[🙂] 민준  [🙂] 서연  [👤] 보호자").
// Used on the event detail, guardian event detail and the edit sheet.

import { memo } from 'react';
import { Text, View } from 'react-native';

import type { Child } from '../../domain/types';
import { IconPerson } from '../icons';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { KidAvatar } from './KidAvatar';
import { makeStyles, useTheme } from '../appearance';

/** The guardian's avatar: grey circle with a person glyph (matches the filter pill). */
export function GuardianAvatar({ size = 22 }: { size?: number }): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.guardian, { width: size, height: size }]}>
      <IconPerson size={Math.round(size * 0.62)} color={theme.t.ink} />
    </View>
  );
}

function PersonChipsImpl({
  kids,
  withGuardian = false,
  size = 22,
  active = false,
}: {
  kids: readonly Child[];
  withGuardian?: boolean;
  size?: number;
  /** The row is expanded (edit sheet) — names take the active colour. */
  active?: boolean;
}): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {kids.map((k) => (
        <View key={k.id} style={styles.chip}>
          <KidAvatar child={k} size={size} />
          <Text style={[styles.name, active ? styles.nameActive : null]} numberOfLines={1}>
            {k.name}
          </Text>
        </View>
      ))}
      {withGuardian ? (
        <View style={styles.chip}>
          <GuardianAvatar size={size} />
          <Text style={[styles.name, active ? styles.nameActive : null]}>보호자</Text>
        </View>
      ) : null}
    </View>
  );
}

export const PersonChips = memo(PersonChipsImpl);

const useStyles = makeStyles((th) => ({
  row: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', columnGap: 10, rowGap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { ...TYPE.row, color: th.t.inkSub },
  nameActive: { color: th.t.danger },
  guardian: {
    borderRadius: RADIUS.full,
    backgroundColor: th.t.guardian,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
