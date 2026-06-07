// Daily schedule tab — empty state when the viewed day has zero occurrences
// across all visible kids (kids exist, but nothing scheduled today). Uses the
// pink mascot Image (works in Expo Go too — no react-native-svg). Swiping to a
// day with events still shows the grid; this only fills an otherwise-blank day.

import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { MASCOTS } from '../assets';
import { FONT_FAMILIES } from '../fonts';
import { TOKENS } from '../palette';
import { SPACING } from '../spacing';

function EmptyDayStateImpl(): React.ReactElement {
  return (
    <View style={styles.wrap} testID="daily-empty-state">
      <Image
        source={MASCOTS.pink}
        style={styles.mascot}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.title}>오늘은 등록된 일정이 없어요</Text>
      <Text style={styles.sub}>아래 + 버튼으로 일정을 추가해보세요</Text>
    </View>
  );
}

export const EmptyDayState = memo(EmptyDayStateImpl);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    // lift the centred content above the floating BottomDock.
    paddingBottom: 80,
  },
  mascot: {
    width: 96,
    height: 96,
    opacity: 0.9,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: SPACING.xs,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
