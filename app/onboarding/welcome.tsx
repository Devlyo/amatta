// Scene 1 — Welcome.
// 1:1 layout port of docs/design/amatta-v1/app-onboarding.jsx OnbWelcome.
//
// Notes:
//   - Spec defines ONB_BG '#FEF4F2' but app-onboarding.jsx line 26 overrides
//     it with 'rgb(255,255,255)'. The final intended background is white,
//     so we ship with TOKENS.surface.
//   - The lime "blob" tray behind the mascots is an organic SVG path in the
//     prototype. react-native-svg's Fabric components are not registered in
//     Expo Go SDK 54 (see src/ui/icons.tsx header) — until the EAS build
//     ships we approximate the blob with a View-shaped oval at #E0E446.
//     The 'lime tray under the mascots' visual stays; the exact bezier
//     dimples are deferred. Color literal #E0E446 matches NOW_YELLOW
//     already used in src/ui/daily/ScheduleGrid.tsx.

import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { MASCOTS } from '../../src/ui/assets';
import { IS_EXPO_GO, loadRNSvg } from '../../src/ui/icons';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { TOKENS } from '../../src/ui/palette';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';

function OnbWelcomeImpl(): React.ReactElement {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Spec: group positioned with top: 66.67% + translateY(-50% - 100px).
          In RN we center the group then shift it upward via paddingBottom
          (≈100px) so its vertical centre sits a bit above the screen mid. */}
      <View style={styles.heroContainer}>
        <View style={styles.heroGroup}>
          {/* ── Mascot row + lime tray ────────────────────────── */}
          <View style={styles.mascotRow}>
            {IS_EXPO_GO ? (
              <View style={styles.limeBlob} pointerEvents="none" />
            ) : (
              <View style={styles.blobWrap} pointerEvents="none">
                <WelcomeBlob />
              </View>
            )}
            <Image
              source={MASCOTS.pink}
              style={styles.mascotPink}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Image
              source={MASCOTS.orange}
              style={styles.mascotOrange}
              resizeMode="contain"
              accessibilityLabel="주황이"
              accessibilityIgnoresInvertColors
            />
          </View>

          {/* ── Copy block ──────────────────────────────────── */}
          <View style={styles.copyBlock}>
            <Text style={styles.welcomeTitle}>Welcome</Text>
            <Text style={styles.welcomeSub}>
              {'아마따와 함께 여러 자녀의\n일정과 준비물을 관리해보세요.'}
            </Text>
          </View>

          {/* ── CTA ─────────────────────────────────────────── */}
          <View style={styles.ctaWrap}>
            <Pressable
              onPress={() => router.replace('/onboarding/add-kid')}
              accessibilityRole="button"
              accessibilityLabel="시작하기"
              style={({ pressed }) => [
                styles.primaryCta,
                pressed ? styles.primaryCtaPressed : null,
              ]}
            >
              <Text style={styles.primaryCtaLabel}>시작하기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default memo(OnbWelcomeImpl);

const MASCOT_PINK_SIZE = 120;
const MASCOT_ORANGE_SIZE = 130;
// The organic lime "tray" under the mascots is an SVG path (app-onboarding.jsx).
// react-native-svg can't load in Expo Go (Fabric components unregistered), so:
//   - Expo Go  → a plain 2px line approximation (no crash; IS_EXPO_GO from icons)
//   - EAS build → the real organic blob (loadRNSvg, lazily required)
// eslint-disable-next-line no-restricted-syntax -- kid-palette Citrus Green, no TOKENS mapping
const BLOB_CITRUS = '#E0E446';
const BLOB_SVG_W = 270;
const BLOB_SVG_H = 116;
const BLOB_PATH =
  'M14,82 C24,76 70,72 130,66 C190,60 230,46 236,32 C256,22 288,42 282,68 C276,96 240,108 196,104 C146,100 92,98 50,98 C22,98 4,90 14,82 Z';
// Expo Go fallback line dims.
const BLOB_W = 230;
const BLOB_H = 2;

// Native-build-only blob. loadRNSvg() lazily require()s react-native-svg, so it
// never loads in Expo Go (this component is only rendered when !IS_EXPO_GO).
function WelcomeBlob(): React.ReactElement {
  const { Svg, Path } = loadRNSvg();
  return (
    <Svg width={BLOB_SVG_W} height={BLOB_SVG_H} viewBox="0 0 280 120">
      <Path d={BLOB_PATH} fill={BLOB_CITRUS} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },

  // Group sits ~30px below screen vertical centre per user direction.
  // paddingBottom shrinks from 40 → 10 to nudge it down another 30px.
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 10,
  },
  heroGroup: {
    alignSelf: 'stretch',
  },

  // ─── Mascots + lime blob ──────────────────────────────────
  mascotRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MASCOT_ORANGE_SIZE + 30, // room for orange's translateY(-20) headroom
  },
  limeBlob: {
    position: 'absolute',
    width: BLOB_W,
    height: BLOB_H,
    left: '50%',
    top: '50%',
    marginLeft: -BLOB_W / 2 + 6, // spec: translate(calc(-50% + 6px), ...)
    marginTop: -BLOB_H / 2 + 38, // a touch below the mascot feet line.
    backgroundColor: BLOB_CITRUS,
    borderRadius: 1,
  },
  // EAS-build organic blob — centred behind the mascots' feet.
  // Mirrors the prototype transform translate(-50% + 6px, -50% + 30px).
  blobWrap: {
    position: 'absolute',
    width: BLOB_SVG_W,
    height: BLOB_SVG_H,
    left: '50%',
    top: '50%',
    marginLeft: -BLOB_SVG_W / 2 + 6,
    marginTop: -BLOB_SVG_H / 2 + 30,
    zIndex: 0,
  },
  mascotPink: {
    width: MASCOT_PINK_SIZE,
    height: MASCOT_PINK_SIZE,
    zIndex: 1,
  },
  mascotOrange: {
    width: MASCOT_ORANGE_SIZE,
    height: MASCOT_ORANGE_SIZE,
    marginLeft: -20,    // spec: marginLeft -20
    marginTop: -20,     // spec: translateY(-20)
    zIndex: 1,
  },

  // ─── Copy block ──────────────────────────────────────────
  copyBlock: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: SPACING.xl,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: FONT_FAMILIES.pretendardBold,
    color: TOKENS.ink,
    letterSpacing: -1,
    lineHeight: 26, // 1.1 of 24
    textAlign: 'center',
  },
  welcomeSub: {
    marginTop: SPACING.md,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.3,
    lineHeight: 22, // ≈ 1.55 of 14
    textAlign: 'center',
  },

  // ─── CTA ─────────────────────────────────────────────────
  ctaWrap: {
    marginTop: 40,
    paddingHorizontal: SPACING.lg,
  },
  primaryCta: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaPressed: { opacity: 0.85 },
  primaryCtaLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
    letterSpacing: -0.3,
  },
});
