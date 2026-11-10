// PickupCard — one Sunset-Orange or French-Lavender pickup card. Spec §2.3.
//
// 1:1 port of docs/design/amatta-v1/app-daily-b.jsx:375–453. The prototype
// branches on `bg` to pick a text color via the luminance formula on lines
// 17–22; we keep the exact same formula here so the contrast matches the
// design reference.
//
// Leading dot pulse animation mirrors the prototype's `amattaPulse` keyframe
// (scale 1→1.4→1 + opacity 1→0.55→1 over 1.6s, ease-in-out, infinite). Uses
// RN Animated with useNativeDriver so the animation runs on the UI thread
// with no JS-thread cost.

import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { FONT_FAMILIES } from '../fonts';
import { PICKUP_CARD_PALETTE, withAlpha, type PickupCardPalette } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { CartoonCar } from './CartoonCar';
import type { PickupCardData } from './pickup-data';
import { makeStyles, useTheme } from '../appearance';

interface Props {
  data: PickupCardData;
  index: number;
}

export function PickupCard({ data, index }: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  // Card N → palette[N % 4]; shape + car fills come straight from the token
  // group. Card 1 follows the live app theme `primary` (handoff §70) — the
  // palette already points slot 0 at theme.t.primary, so this stays in sync if
  // the theme color is ever swapped.
  const slot = PICKUP_CARD_PALETTE[
    index % PICKUP_CARD_PALETTE.length
  ] as PickupCardPalette;
  const bg = slot.bg;
  // ADR-009: text on the card uses the scheme-independent onLight / onDark,
  // so comparing against them stays right in dark (was theme.t.surface/ink,
  // which flip with the theme).
  // Fixed in both schemes: dark text on light cards, white on strong ones.
  const lightText = !isLightFill(bg);
  const onBg = lightText ? theme.t.onDark : theme.t.onLight;
  const onBgSub = withAlpha(onBg, lightText ? 0.85 : 0.6);
  const roadLineColor = lightText ? withAlpha(theme.t.onDark, 0.18) : withAlpha(theme.t.shadow, 0.1);

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const seq = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.4,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.55,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    seq.start();
    return () => seq.stop();
  }, [pulseScale, pulseOpacity]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          shadowColor: bg,
        },
      ]}
    >
      <View style={[styles.roadLine, { backgroundColor: roadLineColor }]} />

      <View style={styles.textBlock}>
        <View style={styles.eyebrowRow}>
          <Animated.View
            style={[
              styles.eyebrowDot,
              {
                backgroundColor: onBg,
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              },
            ]}
          />
          <Text style={[styles.eyebrow, { color: onBgSub }]}>
            Next pickup · {data.etaText}
          </Text>
        </View>
        <Text
          style={[styles.title, { color: onBg }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          <Text style={styles.titleTime}>{data.timeShort} </Text>
          {data.who} · {data.what}
        </Text>
      </View>

      <CartoonCar
        shape={slot.shape}
        body={slot.carBody}
        window={slot.carWindow}
        wheel={theme.t.carWheel}
        hub={slot.carBody}
        shine={theme.t.carShine}
      />
    </View>
  );
}

/**
 * Luminance formula from amatta-v1 lines 17–22: weighted RGB average; if
 * brighter than 0.65 we sit ink on the card, otherwise white. Keeping the
 * same threshold so theme tweaks pick up the same contrast policy.
 */
function isLightFill(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65; // light fill → dark text
}

const useStyles = makeStyles((th) => ({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: RADIUS.box,
    paddingTop: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 44,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  roadLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    height: 2,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.mono,
    letterSpacing: 0.2,
  },
  title: {
    marginTop: SPACING.sm, // 8px between "Next pickup" and the kid / event line
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 16,
    letterSpacing: -0.4,
    lineHeight: 17,
  },
  titleTime: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
  },
}));
