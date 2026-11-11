// PickupCard — one pickup card (board H1, ADR-014): eyebrow · "3PM 민준 · 수학" · 완료.
// Colours still come from PICKUP_CARD_PALETTE (card N → slot N % 4). Was Spec §2.3.
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
import { Animated, Easing, Pressable, Text, View } from 'react-native';

import { getDb } from '../../db/client';
import { usePickupLogStore } from '../../state/pickup-log-store';

import { FONT_FAMILIES } from '../fonts';
import { PICKUP_CARD_PALETTE, withAlpha, type PickupCardPalette } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { fmt12hrShort } from '../utils/date';
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

  const onDone = async (): Promise<void> => {
    const db = await getDb();
    await usePickupLogStore.getState().markComplete(db, data.scheduleId, data.occurrenceDateInt);
  };

  // Board H1 (ADR-014): eyebrow + big "3PM 민준 · 수학" + a 완료 pill.
  return (
    <View style={[styles.card, { backgroundColor: bg, shadowColor: bg }]}>
      <View style={styles.textBlock}>
        <View style={styles.eyebrowRow}>
          <Animated.View
            style={[
              styles.eyebrowDot,
              { backgroundColor: onBg, transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <Text style={[styles.eyebrow, { color: onBgSub }]}>다음 픽업 · {data.etaText}</Text>
        </View>
        <Text style={[styles.title, { color: onBg }]} numberOfLines={1} ellipsizeMode="tail">
          {fmt12hrShort(data.pickupMinutes)} {data.who} · {data.what}
        </Text>
      </View>
      <Pressable
        onPress={() => void onDone()}
        accessibilityRole="button"
        accessibilityLabel={`${data.who} ${data.what} 픽업 완료`}
        hitSlop={6}
        style={[styles.done, { backgroundColor: withAlpha(onBg, 0.22) }]}
        testID={`pickup-done-${data.scheduleId}`}
      >
        <Text style={[styles.doneLabel, { color: onBg }]}>완료</Text>
      </Pressable>
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

const useStyles = makeStyles(() => ({
  card: {
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 72,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  textBlock: { flex: 1, minWidth: 0, gap: 2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowDot: { width: 6, height: 6, borderRadius: RADIUS.full },
  eyebrow: { ...TYPE.footnote, fontFamily: FONT_FAMILIES.pretendardSemiBold },
  title: { ...TYPE.title2, fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
  done: { height: 34, paddingHorizontal: 14, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { ...TYPE.subhead, fontFamily: FONT_FAMILIES.pretendardSemiBold },
}));
