// CartoonCar — placeholder using RN <View> shapes.
//
// TODO(asset-swap): replace with a PNG illustration (assets/amatta/car-*.png
// or similar) once the designer hands one off. The current View-shape
// composition is a placeholder approximating the amatta-v1 SVG (chubby body
// + cabin pill + two black wheels). When the PNG lands, drop these shapes
// and render <Image source={CAR_IMG} style={{width: 68, height: 40}} />.
//
// Why we're not using the prototype SVG directly: react-native-svg's Fabric
// components don't register in the SDK 54 Expo Go binary, so <Path/> paths
// can't render here. PNG sidesteps that.

import { StyleSheet, View } from 'react-native';

import { TOKENS } from '../palette';
import { RADIUS } from '../radius';

interface Props {
  onBg: string; // '#1d1d1b' or '#fff' — dark text on the card → dark car parts
}

const W = 68;
const H = 40;

export function CartoonCar({ onBg }: Props): React.ReactElement {
  // When the host card is dark (white text), draw the car in white; when the
  // card is light (ink text), draw the car in ink.
  const bodyColor = onBg;
  const windowColor =
    onBg === TOKENS.surface ? 'rgba(255,255,255,0.7)' : 'rgba(29,29,27,0.7)';
  const wheelColor = TOKENS.ink;
  const hubColor = TOKENS.surface;

  return (
    <View
      style={styles.wrap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* main body — chubby rounded pill */}
      <View style={[styles.body, { backgroundColor: bodyColor }]} />
      {/* cabin/window — smaller pill sitting on top */}
      <View style={[styles.cabin, { backgroundColor: windowColor }]} />
      {/* wheels with hubs */}
      <View style={[styles.wheel, styles.wheelLeft, { backgroundColor: wheelColor }]}>
        <View style={[styles.hub, { backgroundColor: hubColor }]} />
      </View>
      <View style={[styles.wheel, styles.wheelRight, { backgroundColor: wheelColor }]}>
        <View style={[styles.hub, { backgroundColor: hubColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: W,
    height: H,
    flexShrink: 0,
  },
  body: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 14,
    height: 18,
    borderRadius: RADIUS.md,
  },
  cabin: {
    position: 'absolute',
    left: 18,
    right: 14,
    top: 8,
    height: 10,
    borderTopLeftRadius: RADIUS.xs,
    borderTopRightRadius: RADIUS.sm,
    borderBottomLeftRadius: 2, // hairline
    borderBottomRightRadius: 2, // hairline
  },
  wheel: {
    position: 'absolute',
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelLeft: { left: 7 },
  wheelRight: { right: 7 },
  hub: {
    width: 5,
    height: 5,
    borderRadius: RADIUS.full,
  },
});
