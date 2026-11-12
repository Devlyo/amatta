// Onboarding 1 — Welcome. Hero = the owner's illustration of the kids around a
// calendar (2026-11-12, replaced the floating 3D face cluster), bobbing gently.

import { memo, useEffect, useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { APP_NAME } from '../../src/domain/constants';
import { defaultRestoreSteps, restoreFromBackup } from '../../src/state/restore';
import { WELCOME_HERO, WELCOME_HERO_ASPECT, WORDMARK, WORDMARK_ASPECT } from '../../src/ui/assets';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';
import { makeStyles } from '../../src/ui/appearance';

/** The hero illustration, floating gently (one slow bob). */
function Hero({ width }: { width: number }): React.ReactElement {
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [lift]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return (
    <Animated.View style={[{ alignSelf: 'center' }, anim]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image
        source={WELCOME_HERO}
        style={{ width, height: width / WELCOME_HERO_ASPECT }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

function OnbWelcomeImpl(): React.ReactElement {
  const styles = useStyles();
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);

  // ADR-012: start from a backup instead of adding kids — the backup always
  // has ≥ 1 kid (parseBackup rejects empty ones), so go on to the finish step.
  const startFromBackup = async (): Promise<void> => {
    if (restoring) return;
    setRestoring(true);
    try {
      const outcome = await restoreFromBackup('welcome', defaultRestoreSteps());
      if (outcome === 'restored') router.replace('/onboarding/finish');
    } finally {
      setRestoring(false);
    }
  };
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Hero width={Math.min(width - 32, 380)} />
        <View style={styles.copy}>
          <Image
            source={WORDMARK}
            style={styles.brand}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={APP_NAME}
          />
          <Text style={styles.title} accessibilityRole="header">
            {'자녀 일정을\n위모아와 함께 관리하세요'}
          </Text>
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <Pressable
          onPress={() => router.replace('/onboarding/add-kid')}
          accessibilityRole="button"
          accessibilityLabel="게스트로 시작하기"
          style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
        >
          <Text style={styles.ctaLabel}>게스트로 시작하기</Text>
        </Pressable>
        <Pressable
          onPress={() => void startFromBackup()}
          disabled={restoring}
          accessibilityRole="button"
          accessibilityLabel="백업 파일로 시작하기"
          accessibilityState={{ disabled: restoring, busy: restoring }}
          hitSlop={6}
          testID="welcome-restore"
          style={({ pressed }) => [styles.restore, pressed ? styles.restorePressed : null]}
        >
          <Text style={styles.restoreLabel}>{restoring ? '가져오는 중...' : '백업 파일로 시작하기'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default memo(OnbWelcomeImpl);

const useStyles = makeStyles((th) => ({
  safe: { flex: 1, backgroundColor: th.t.surface },
  hero: { flex: 1, justifyContent: 'center', paddingBottom: SPACING.sm },
  copy: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 34 },
  brand: { width: 108, height: 108 / WORDMARK_ASPECT },
  title: {
    marginTop: SPACING.md,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: th.t.ink,
    textAlign: 'center',
  },
  ctaWrap: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
    gap: 10,
  },
  cta: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { backgroundColor: th.t.primaryDeep },
  restore: { height: 36, paddingHorizontal: SPACING.lg, justifyContent: 'center' },
  restorePressed: { opacity: 0.6 },
  restoreLabel: {
    fontFamily: FONT_FAMILIES.pretendardMedium,
    fontSize: 15,
    letterSpacing: -0.3,
    color: th.t.inkSub,
  },
  ctaLabel: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: th.t.onDark,
  },
}));
