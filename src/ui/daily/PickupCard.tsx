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
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { FONT_FAMILIES } from '../fonts';
import { TOKENS } from '../palette';
import { CartoonCar } from './CartoonCar';
import type { PickupCardData } from './pickup-data';

const CARD_BGS = [TOKENS.primary, '#D4B4FA'] as const;

interface Props {
  data: PickupCardData;
  index: number;
}

export function PickupCard({ data, index }: Props): React.ReactElement {
  const bg = CARD_BGS[index % CARD_BGS.length] as string;
  const onBg = pickOnBg(bg);
  const onBgSub =
    onBg === '#fff' ? 'rgba(255,255,255,0.85)' : 'rgba(29,29,27,0.6)';
  const roadLineColor =
    onBg === '#fff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)';

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
            NEXT PICKUP · {data.etaText}
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

      <CartoonCar onBg={onBg} />
    </View>
  );
}

/**
 * Luminance formula from amatta-v1 lines 17–22: weighted RGB average; if
 * brighter than 0.65 we sit ink on the card, otherwise white. Keeping the
 * same threshold so theme tweaks pick up the same contrast policy.
 */
function pickOnBg(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65 ? '#1d1d1b' : '#fff';
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    paddingTop: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    borderRadius: 99,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FONT_FAMILIES.mono,
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 2,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 15,
    letterSpacing: -0.4,
    lineHeight: 17,
  },
  titleTime: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
  },
});
