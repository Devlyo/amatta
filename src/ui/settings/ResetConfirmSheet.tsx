// 1:1 port of docs/design/amatta-v1/app-settings.jsx ResetConfirmSheet
// (line 440-487). Bottom-sheet modal with a handle grabber, a 17/700
// title, a 13/inkSub explanation, and two stacked CTAs — danger fill
// (초기화하기) over an ink04 secondary (취소).

import { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT_FAMILIES } from '../fonts';
import { TOKENS } from '../palette';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ResetConfirmSheetImpl({
  visible,
  onCancel,
  onConfirm,
}: Props): React.ReactElement {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        <Text style={styles.title}>모든 데이터를 초기화할까요?</Text>
        <Text style={styles.sub}>
          자녀, 일정, 할일, 알림 설정이 모두 삭제돼요. 이 작업은 되돌릴 수
          없어요.
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
    </Modal>
  );
}

export const ResetConfirmSheet = memo(ResetConfirmSheetImpl);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,29,27,0.40)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
  },
  handleArea: { alignItems: 'center', marginBottom: 16 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKENS.ink12,
  },
  title: {
    fontSize: 17,
    fontFamily: FONT_FAMILIES.pretendardBold,
    color: TOKENS.ink,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    lineHeight: 20,
    marginBottom: 18,
  },
  ctaStack: { gap: 8 },
  dangerCta: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: TOKENS.danger,
    alignItems: 'center',
  },
  dangerCtaPressed: { opacity: 0.85 },
  dangerCtaLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
    letterSpacing: -0.3,
  },
  cancelCta: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: TOKENS.ink04,
    alignItems: 'center',
  },
  cancelCtaPressed: { opacity: 0.85 },
  cancelCtaLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
});
