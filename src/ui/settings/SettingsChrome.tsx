// Shared chrome for the settings sub-screens — ADR-007 §10 UI 통일.
// Same look as the home / settings tab: grouped background, white RADIUS.box
// groups under bold section headings (HomeSection), iPhone-style rows. The
// top bar is the iOS navigation bar: red "‹ 설정" back, centred headline
// title, optional red right action.

import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconChevronLeft } from '../icons';
import { TOKENS } from '../palette';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';

export function DetailTopBar({
  title,
  onBack,
  backLabel = '설정',
  rightLabel,
  rightDisabled,
  onRight,
}: {
  title: string;
  onBack: () => void;
  /** Text after the back chevron (the screen it returns to). */
  backLabel?: string;
  rightLabel?: string;
  rightDisabled?: boolean;
  onRight?: () => void;
}): React.ReactElement {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        hitSlop={8}
        style={styles.side}
      >
        <View style={styles.back}>
          <IconChevronLeft size={22} color={TOKENS.danger} />
          <Text style={styles.backLabel} numberOfLines={1}>
            {backLabel}
          </Text>
        </View>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideEnd]}>
        {rightLabel !== undefined ? (
          <Pressable
            onPress={rightDisabled === true ? undefined : onRight}
            disabled={rightDisabled}
            accessibilityRole="button"
            accessibilityLabel={rightLabel}
            accessibilityState={{ disabled: rightDisabled === true }}
            hitSlop={8}
          >
            <Text style={[styles.rightLabel, rightDisabled === true ? styles.rightDisabled : null]}>
              {rightLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A settings sub-screen: safe area + top bar + the home-style scroll column. */
export function SettingsDetailScreen({
  title,
  onBack,
  rightLabel,
  rightDisabled,
  onRight,
  children,
  keyboardShouldPersistTaps,
}: {
  title: string;
  onBack: () => void;
  rightLabel?: string;
  rightDisabled?: boolean;
  onRight?: () => void;
  children: ReactNode;
  keyboardShouldPersistTaps?: 'handled';
}): React.ReactElement {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DetailTopBar
        title={title}
        onBack={onBack}
        rightLabel={rightLabel}
        rightDisabled={rightDisabled}
        onRight={onRight}
      />
      <ScrollView
        contentContainerStyle={settingsStyles.content}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Shared bits for the screens' own content. */
export const settingsStyles = StyleSheet.create({
  content: {
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    gap: 18,
  },
  /** A section plus the footnote under it. */
  block: { gap: 6 },
  footnote: { ...TYPE.footnote, color: TOKENS.inkSub, paddingHorizontal: SPACING.xs },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.groupedBg },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  side: { flex: 1, paddingVertical: SPACING.sm },
  sideEnd: { alignItems: 'flex-end', paddingRight: SPACING.sm },
  back: { flexDirection: 'row', alignItems: 'center' },
  backLabel: { ...TYPE.row, color: TOKENS.danger },
  title: { ...TYPE.headline, color: TOKENS.ink, textAlign: 'center', flexShrink: 1 },
  rightLabel: { ...TYPE.headline, color: TOKENS.danger },
  rightDisabled: { color: TOKENS.ink30 },
});
