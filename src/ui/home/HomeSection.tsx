// Section on the home screen (ADR-007 §6-1): bold heading, optional count and
// a right-aligned text action, above a white grouped box.

import { memo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { IconChevronRight } from '../icons';
import { makeStyles, useTheme } from '../appearance';

interface Props {
  title: string;
  /** Muted text after the title, e.g. "1/3". */
  count?: string;
  actionLabel?: string;
  onPressAction?: () => void;
  /** Wrap children in the white grouped box (default true). */
  boxed?: boolean;
  children: ReactNode;
  testID?: string;
}

function HomeSectionImpl({
  title,
  count,
  actionLabel,
  onPressAction,
  boxed = true,
  children,
  testID,
}: Props): React.ReactElement {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
          {count !== undefined ? <Text style={styles.count}> {count}</Text> : null}
        </Text>
        {actionLabel !== undefined ? (
          <Pressable onPress={onPressAction} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={8} style={styles.actionRow}>
            <Text style={styles.action}>{actionLabel}</Text>
            <IconChevronRight size={14} color={theme.t.primaryDeep} />
          </Pressable>
        ) : null}
      </View>
      {boxed ? <View style={styles.box}>{children}</View> : children}
    </View>
  );
}

export const HomeSection = memo(HomeSectionImpl);

const useStyles = makeStyles((th) => ({
  section: { gap: SPACING.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
  },
  // ADR-014: iOS-style big section headings + an orange "캘린더 ›" link.
  title: { ...TYPE.title2, color: th.t.ink },
  count: { ...TYPE.footnote, color: th.t.inkSub },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action: { ...TYPE.subhead, color: th.t.primaryDeep },
  box: {
    backgroundColor: th.t.surface,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
}));
