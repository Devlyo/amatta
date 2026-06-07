import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { TYPE, type TypeKey } from '../typography';
import { TOKENS } from '../palette';

// Design-system Text primitive. Every text in the app should go through this so
// size/weight/line-height stay on the TYPE scale (README §4) — no raw fontSize.
//
//   <Text variant="titleM">섹션 제목</Text>
//   <Text variant="caption" color={TOKENS.inkSub}>09:30</Text>
//
// `variant` picks a TYPE preset (default body). `color` defaults to ink.
// Any extra `style` wins last, so one-offs are still possible but explicit.
export interface TextProps extends RNTextProps {
  variant?: TypeKey;
  color?: string;
}

export function Text({
  variant = 'body',
  color = TOKENS.ink,
  style,
  ...rest
}: TextProps): React.ReactElement {
  return <RNText style={[TYPE[variant], { color }, style]} {...rest} />;
}
