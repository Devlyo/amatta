import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { DARK_THEME, LIGHT_THEME, useTheme, type Theme } from '../appearance';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { Text } from './Text';
import type { TypeKey } from '../typography';

// Design-system Button primitive. Source of truth: README §7 (Buttons) for the
// `md` size + variant colors; sm/lg derived on the token + type scale (agreed
// standard 3-tier). Replaces the ~28 ad-hoc Pressable buttons scattered today.
//
//   <Button label="저장" onPress={save} />                       // primary / md
//   <Button label="취소" variant="ghost" size="sm" onPress={x} />
//   <Button label="삭제" variant="danger" shape="pill" />

export type ButtonVariant = 'primary' | 'ghost' | 'tertiary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'rounded' | 'pill';

interface SizeSpec {
  minHeight: number;
  padV: number;
  padH: number;
  label: TypeKey;
}

// sm h36 / 8×16 / caption · md h44 / 12×20 / body (README) · lg h52 / 16×24 / bodyL
const SIZES: Record<ButtonSize, SizeSpec> = {
  sm: { minHeight: 36, padV: SPACING.sm, padH: SPACING.lg, label: 'caption' },
  md: { minHeight: 44, padV: SPACING.md, padH: SPACING.xl, label: 'body' },
  lg: { minHeight: 52, padV: SPACING.lg, padH: SPACING.xxl, label: 'bodyL' },
};

interface VariantSpec {
  bg: string;
  bgPressed: string;
  fg: string;
  border?: string;
}

// ADR-009: variant colours per theme (text on strong fills = onDark, both schemes).
const variantsFor = (t: Theme['t']): Record<ButtonVariant, VariantSpec> => ({
  // Filled Sunset Orange CTA → pressed deep. No shadow (app buttons are flat).
  primary: { bg: t.primary, bgPressed: t.primaryDeep, fg: t.onDark },
  // Transparent + ink-30 border.
  ghost: { bg: 'transparent', bgPressed: t.ink06, fg: t.ink, border: t.ink30 },
  // Warm surface, no border.
  tertiary: { bg: t.surfaceWarm, bgPressed: t.ink06, fg: t.ink },
  // Destructive — no deep token, darken via press overlay handled by opacity.
  danger: { bg: t.danger, bgPressed: t.danger, fg: t.onDark },
});
const VARIANTS_BY_SCHEME = { light: variantsFor(LIGHT_THEME.t), dark: variantsFor(DARK_THEME.t) };

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label?: string;
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  children,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  leftIcon,
  rightIcon,
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps): React.ReactElement {
  const s = SIZES[size];
  const v = VARIANTS_BY_SCHEME[useTheme().scheme][variant];
  const isDisabled = disabled === true || loading;

  const base: ViewStyle = {
    minHeight: s.minHeight,
    paddingVertical: s.padV,
    paddingHorizontal: s.padH,
    borderRadius: shape === 'pill' ? RADIUS.full : RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SPACING.sm,
    ...(v.border !== undefined ? { borderWidth: 1, borderColor: v.border } : null),
    ...(fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }),
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? SPACING.xs : undefined}
      style={({ pressed }) => [
        base,
        { backgroundColor: pressed && !isDisabled ? v.bgPressed : v.bg },
        isDisabled ? { opacity: 0.5 } : null,
        // danger has no deep token — darken on press via opacity instead.
        variant === 'danger' && pressed && !isDisabled ? { opacity: 0.85 } : null,
        style ?? null,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {leftIcon !== undefined ? <View>{leftIcon}</View> : null}
          {label !== undefined ? (
            <Text variant={s.label} color={v.fg}>
              {label}
            </Text>
          ) : (
            children
          )}
          {rightIcon !== undefined ? <View>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}
