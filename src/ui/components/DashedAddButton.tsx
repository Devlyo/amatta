import { Pressable, View, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { IconPlus } from '../icons';
import { Text } from './Text';

// Dashed circular "add" affordance. Source of truth: TodoSection addCheckbox
// (22) + settings/kids addAvatar (36) — a dashed ink30 ring with a + inside.
// Optional `label` renders the add row ("+ 추가"). disabled dims the ring to ink12.
export type DashedAddSize = 'sm' | 'md' | 'lg';

const DIAMETER: Record<DashedAddSize, number> = { sm: 22, md: 28, lg: 36 };
const ICON: Record<DashedAddSize, number> = { sm: 12, md: 14, lg: 16 };

export interface DashedAddButtonProps {
  label?: string;
  size?: DashedAddSize;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function DashedAddButton({
  label,
  size = 'md',
  onPress,
  disabled = false,
  style,
}: DashedAddButtonProps): React.ReactElement {
  const d = DIAMETER[size];
  const ring: ViewStyle = {
    width: d,
    height: d,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: disabled ? TOKENS.ink12 : TOKENS.ink30,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const wrap: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...(disabled ? { opacity: 0.6 } : null),
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label ?? '추가'}
      style={({ pressed }) => [wrap, pressed && !disabled ? { opacity: 0.7 } : null, style ?? null]}
    >
      <View style={ring}>
        <IconPlus size={ICON[size]} color={TOKENS.inkSub} />
      </View>
      {label !== undefined ? (
        <Text variant="caption" color={TOKENS.inkSub}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
