// Section on the home screen (ADR-007 §6-1): bold heading, optional count and
// a right-aligned text action, above a white grouped box.

import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';

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
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
          {count !== undefined ? <Text style={styles.count}> {count}</Text> : null}
        </Text>
        {actionLabel !== undefined ? (
          <Pressable onPress={onPressAction} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {boxed ? <View style={styles.box}>{children}</View> : children}
    </View>
  );
}

export const HomeSection = memo(HomeSectionImpl);

const styles = StyleSheet.create({
  section: { gap: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
  },
  title: { ...TYPE.headline, color: TOKENS.ink },
  count: { ...TYPE.subhead, color: TOKENS.inkSub },
  action: { ...TYPE.subhead, color: TOKENS.sunday },
  box: {
    backgroundColor: TOKENS.surface,
    borderRadius: RADIUS.box,
    overflow: 'hidden',
  },
});
