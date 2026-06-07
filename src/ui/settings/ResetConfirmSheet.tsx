// Reset-all-data confirm BODY. Presented as the gorhom bottom-sheet route
// app/settings/reset-confirm.tsx (see ralplan-drawer-route-modal.md). The route
// owns presentation + the destructive wipe; this is the de-chromed content:
// 17/700 title, 13/inkSub explanation, danger CTA over an ink04 cancel.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT_FAMILIES } from '../fonts';
import { TOKENS } from '../palette';
import { SPACING } from '../spacing';

export interface ResetConfirmBodyProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResetConfirmBody({
  onCancel,
  onConfirm,
}: ResetConfirmBodyProps): React.ReactElement {
  return (
    <View style={styles.body}>
      <Text style={styles.title}>모든 데이터를 초기화할까요?</Text>
      <Text style={styles.sub}>
        자녀, 일정, 할일, 알림 설정이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.
      </Text>
      <View style={styles.ctaStack}>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel="초기화하기"
          style={({ pressed }) => [
            styles.dangerCta,
            pressed ? styles.dangerCtaPressed : null,
          ]}
        >
          <Text style={styles.dangerCtaLabel}>초기화하기</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="취소"
          style={({ pressed }) => [
            styles.cancelCta,
            pressed ? styles.cancelCtaPressed : null,
          ]}
        >
          <Text style={styles.cancelCtaLabel}>취소</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // De-chromed: the gorhom route sheet owns scrim/shape/grabber.
  body: {
    paddingHorizontal: 18,
    paddingTop: SPACING.sm,
    paddingBottom: 28,
  },
  title: {
    fontSize: 18,
    fontFamily: FONT_FAMILIES.pretendardBold,
    color: TOKENS.ink,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    lineHeight: 20,
    marginBottom: 18,
  },
  ctaStack: { gap: SPACING.sm },
  dangerCta: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: 14,
    backgroundColor: TOKENS.danger,
    alignItems: 'center',
  },
  dangerCtaPressed: { opacity: 0.85 },
  dangerCtaLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
    letterSpacing: -0.3,
  },
  cancelCta: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: 14,
    backgroundColor: TOKENS.ink04,
    alignItems: 'center',
  },
  cancelCtaPressed: { opacity: 0.85 },
  cancelCtaLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
});
