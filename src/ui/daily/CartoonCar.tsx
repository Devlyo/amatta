// CartoonCar — trailing illustration on PickupCard. Spec §2.4.
//
// The amatta-v1 prototype draws a 200-line hand-crafted SVG via react-native-
// svg primitives. We can't ship that in Expo Go because react-native-svg is
// excluded from the managed binary; substituting `MaterialCommunityIcons
// "car-side"` at size 40 keeps the silhouette and preserves the on-bg text
// color contract.
//
// TODO(EAS-dev-build): replace with the hand-drawn SVG from amatta-v1 once
// react-native-svg works in our binary.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View, StyleSheet } from 'react-native';

interface Props {
  onBg: string;
}

export function CartoonCar({ onBg }: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name="car-side" size={40} color={onBg} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 68,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
