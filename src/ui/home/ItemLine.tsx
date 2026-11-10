// One "what is it" line on the home screen, shared by 지금 and 준비물:
//   [이름]  📖 영어학원  ~7:30PM
// name (black, bold) · gap · type icon + small gap · title (bold) · smaller
// grey detail. The title truncates; name, icon and detail never do.

import { memo } from 'react';
import { Text, View } from 'react-native';

import type { ScheduleType } from '../../domain/types';
import { TypeIcon } from '../common/TypeIcon';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { makeStyles, useTheme } from '../appearance';

interface Props {
  /** Kid name in front (omit when the row is already under the kid). */
  name?: string;
  title: string;
  type: ScheduleType | null;
  /** "~7:30PM" / "2–3:30PM"; '' = none. */
  detail: string;
}

function ItemLineImpl({ name, title, type, detail }: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.line}>
      {name !== undefined ? <Text style={styles.strong}>{name}</Text> : null}
      {type !== null ? (
        <View style={styles.icon}>
          <TypeIcon type={type} size={13} color={theme.t.inkSub} />
        </View>
      ) : null}
      <Text style={[styles.strong, styles.title]} numberOfLines={1}>
        {title}
      </Text>
      {detail !== '' ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

export const ItemLine = memo(ItemLineImpl);

const useStyles = makeStyles((th) => ({
  // Every piece centred on one 20px line box (the smaller detail too).
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minWidth: 0, minHeight: 20 },
  strong: { ...TYPE.subhead, fontFamily: TYPE.headline.fontFamily, color: th.t.ink },
  title: { flexShrink: 1 },
  // Pulls the icon a little closer to its title than the other gaps.
  icon: { marginRight: -SPACING.xs, height: 20, justifyContent: 'center' },
  detail: { ...TYPE.footnote, lineHeight: 20, color: th.t.inkSub },
}));
