// CartoonCar — illustrated pickup car, real SVG (react-native-svg).
//
// 1:1 port of the handoff assets docs/design/handoffs/pickup-banner/{car-sedan,
// car-round}.svg (both viewBox 130×78), rendered at 68×40. The handoff swaps
// fill values per card, so body/window/wheel/hub/shine come in as props (each a
// design token from TOKENS — see PICKUP_CARD_PALETTE). `shape` picks the sedan
// or round silhouette.
//
// ⚠️ react-native-svg does NOT load in the Expo Go SDK 54 binary (RNSVG Fabric
// components throw "Could not find component config"). This needs an EAS dev/
// prod build — already the project runtime (ADR-005, A-ICONS). Do NOT run in
// Expo Go.

import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  shape: 'sedan' | 'round';
  body: string;
  window: string;
  wheel: string;
  hub: string;
  shine: string;
}

const W = 68;
const H = 40;
const VIEW_BOX = '0 0 130 78';

// Sedan silhouette — low-slung body, rounded roof, two windows split by a door
// line, headlight glint front-right.
const SEDAN_BODY =
  'M14 54 Q14 40 28 38 L42 24 Q47 19 55 19 L82 19 Q90 19 95 26 L104 38 Q118 40 118 54 L118 56 Q118 60 114 60 L102 60 Q102 68 95 68 Q88 68 88 60 L44 60 Q44 68 37 68 Q30 68 30 60 L18 60 Q14 60 14 56 Z';
const SEDAN_WINDOW_FRONT = 'M50 28 Q53 24 58 24 L66 24 L66 38 L46 38 Z';
const SEDAN_WINDOW_REAR = 'M70 24 L82 24 Q86 24 88 27 L94 38 L70 38 Z';
const SEDAN_DIVIDER = 'M68 24 L68 38';

// Round/toy silhouette — bulbous body, domed cabin, door handle mid-side,
// headlight glint front-left.
const ROUND_BODY =
  'M14 50 Q14 42 20 40 Q24 38 28 40 Q34 40 36 36 C38 24 48 18 60 18 L82 18 C102 18 116 30 116 54 L116 56 Q116 60 112 60 L102 60 Q102 68 95 68 Q88 68 88 60 L44 60 Q44 68 37 68 Q30 68 30 60 L18 60 Q14 60 14 56 L14 50 Z';
const ROUND_WINDOW_FRONT = 'M40 38 C40 28 44 22 54 22 L66 22 L66 38 Z';
const ROUND_WINDOW_REAR = 'M70 22 L82 22 C94 22 96 30 96 38 L70 38 Z';
const ROUND_DIVIDER = 'M52 48 L62 48';

export function CartoonCar({
  shape,
  body,
  window: win,
  wheel,
  hub,
  shine,
}: Props): React.ReactElement {
  const isRound = shape === 'round';

  return (
    <Svg width={W} height={H} viewBox={VIEW_BOX} aria-hidden>
      {isRound ? (
        <>
          <Path d={ROUND_BODY} fill={body} />
          <Path d={ROUND_WINDOW_FRONT} fill={win} />
          <Path d={ROUND_WINDOW_REAR} fill={win} />
          <Path
            d={ROUND_DIVIDER}
            stroke={wheel}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.6}
          />
          <Circle cx={18} cy={46} r={2.2} fill={shine} />
        </>
      ) : (
        <>
          <Path d={SEDAN_BODY} fill={body} />
          <Path d={SEDAN_WINDOW_FRONT} fill={win} />
          <Path d={SEDAN_WINDOW_REAR} fill={win} />
          <Path
            d={SEDAN_DIVIDER}
            stroke={wheel}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Circle cx={113} cy={48} r={2.2} fill={shine} />
        </>
      )}
      {/* wheels — shared between shapes (outer tire + hub) */}
      <Circle cx={37} cy={62} r={11} fill={wheel} />
      <Circle cx={95} cy={62} r={11} fill={wheel} />
      <Circle cx={37} cy={62} r={4.4} fill={hub} />
      <Circle cx={95} cy={62} r={4.4} fill={hub} />
    </Svg>
  );
}
