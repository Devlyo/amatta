import { useState } from 'react';
import { TextInput, type TextInputProps, type TextStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';

// Design-system text Input. Source of truth: README §7 (Inputs).
// Warm bg + hair border; focus → 2px primary ring; radius md; placeholder
// ink-sub. Label text is Body (md) / Body L (lg) from the type scale.
export type InputSize = 'md' | 'lg';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  size?: InputSize;
  style?: TextStyle;
}

const SIZE: Record<InputSize, { minHeight: number; type: TextStyle }> = {
  md: { minHeight: 44, type: TYPE.body },
  lg: { minHeight: 52, type: TYPE.bodyL },
};

export function Input({
  size = 'md',
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const s = SIZE[size];

  type FocusArg = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
  type BlurArg = Parameters<NonNullable<TextInputProps['onBlur']>>[0];
  const handleFocus = (e: FocusArg): void => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur = (e: BlurArg): void => {
    setFocused(false);
    onBlur?.(e);
  };

  const base: TextStyle = {
    minHeight: s.minHeight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: TOKENS.surfaceWarm,
    borderRadius: RADIUS.md,
    // Constant 2px border — only the COLOR changes on focus. A width change
    // (1→2) would eat 1px off the inner box and nudge the text on every focus.
    borderWidth: 2,
    borderColor: focused ? TOKENS.primary : TOKENS.hair,
  };

  return (
    <TextInput
      placeholderTextColor={TOKENS.inkSub}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[s.type, { color: TOKENS.ink }, base, style]}
      {...rest}
    />
  );
}
