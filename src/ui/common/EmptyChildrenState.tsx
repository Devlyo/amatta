import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { MASCOTS } from '../assets';
import { FONT_FAMILIES } from '../fonts';
import { TOKENS } from '../palette';

export function EmptyChildrenState(): React.ReactElement {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image
        source={MASCOTS.pink}
        style={styles.mascot}
        resizeMode="contain"
        accessibilityLabel="아마따 캐릭터"
      />
      <Text style={styles.title} accessibilityRole="header">
        자녀를 추가하고 시작해요
      </Text>
      <Text style={styles.body} accessibilityRole="text">
        자녀별 일정을 한눈에 관리할 수 있어요.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="자녀 추가하기"
        onPress={() => router.push('/(tabs)/settings')}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: pressed ? TOKENS.primaryDeep : TOKENS.primary },
        ]}
      >
        <Text style={styles.ctaLabel}>자녀 추가하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: TOKENS.surfaceWarm,
  },
  mascot: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: FONT_FAMILIES.pretendardBold,
    color: TOKENS.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  cta: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
  },
});
