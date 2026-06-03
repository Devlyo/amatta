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
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { TOKENS } from '../../src/ui/palette';

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
            <View style={styles.limeBlob} pointerEvents="none" />
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
// Approximated dimensions of the spec's <svg viewBox="0 0 280 120"> tray
// rendered at width 270 / height 116. Oval fallback keeps the same
// horizontal centre + the spec's translate offsets.
const BLOB_W = 270;
const BLOB_H = 70;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },

  // Pulls the group ~100px above the vertical centre, matching the
  // spec's translateY(-50% - 100px).
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 200,
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
    marginTop: -BLOB_H / 2 + 30,  // spec: translate(..., calc(-50% + 30px))
    backgroundColor: '#E0E446', // matches NOW_YELLOW; see header note.
    borderRadius: 9999,
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
    paddingTop: 20,
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
    marginTop: 12,
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
    paddingHorizontal: 16,
  },
  primaryCta: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaPressed: { opacity: 0.85 },
  primaryCtaLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
    letterSpacing: -0.3,
  },
});
