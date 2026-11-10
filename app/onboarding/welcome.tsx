// Onboarding 1 — Welcome (design canvas "O1 환영 — 3D 얼굴").
//
// The six 3D kid faces float in a loose cluster above the copy; each one
// bobs a few points on its own rhythm. Orange CTA, offline reassurance line.

import { memo, useEffect, useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import type { AvatarKey } from '../../src/domain/avatar';
import { APP_NAME } from '../../src/domain/constants';
import { defaultRestoreSteps, restoreFromBackup } from '../../src/state/restore';
import { AVATAR_IMAGE_BY_KEY, WORDMARK, WORDMARK_ASPECT } from '../../src/ui/assets';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';
import { makeStyles } from '../../src/ui/appearance';

/** Cluster laid out on a 390 × 290 stage, scaled down on narrower phones. */
const STAGE_W = 390;
const STAGE_H = 290;
const CLUSTER: readonly { key: AvatarKey; size: number; x: number; y: number; rotate: number }[] = [
  { key: 'face-sleep', size: 80, x: 150, y: 0, rotate: 4 },
  { key: 'face-surprise', size: 96, x: 26, y: 40, rotate: -10 },
  { key: 'face-cool', size: 92, x: 262, y: 28, rotate: 8 },
  { key: 'face-dizzy', size: 84, x: 18, y: 196, rotate: 6 },
  { key: 'face-calm', size: 96, x: 268, y: 186, rotate: -6 },
  { key: 'face-wink', size: 150, x: 120, y: 96, rotate: -4 },
];

function FloatingFace({
  avatar,
  size,
  x,
  y,
  rotate,
  index,
}: {
  avatar: AvatarKey;
  size: number;
  x: number;
  y: number;
  rotate: number;
  index: number;
}): React.ReactElement {
  const lift = useSharedValue(0);
  useEffect(() => {
    const half = 1600 + index * 175;
    lift.value = withDelay(
      index * 250,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: half, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [lift, index]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { rotate: `${rotate}deg` }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y, width: size, height: size }, anim]}>
      <Image
        source={AVATAR_IMAGE_BY_KEY[avatar]}
        style={{ width: size, height: size }}
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
  const scale = Math.min(1, width / STAGE_W);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View
          style={{ width: STAGE_W * scale, height: STAGE_H * scale, alignSelf: 'center' }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {CLUSTER.map((f, i) => (
            <FloatingFace
              key={f.key}
              avatar={f.key}
              size={f.size * scale}
              x={f.x * scale}
              y={f.y * scale}
              rotate={f.rotate}
              index={i}
            />
          ))}
        </View>
        <View style={styles.copy}>
          <Image
            source={WORDMARK}
            style={styles.brand}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={APP_NAME}
          />
          <Text style={styles.title} accessibilityRole="header">
            {'여러 자녀들 일정을\n위모아와 함께 관리하세요'}
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
