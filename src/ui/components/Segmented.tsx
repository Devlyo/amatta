import { Pressable, View, type ViewStyle } from 'react-native';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { FONT_FAMILIES } from '../fonts';
import { Text } from './Text';
import { makeStyles, useTheme } from '../appearance';

// iOS-style segmented control. Source of truth: settings.tsx `SegmentedRow`
// track ("기본 알림 시점"). Track = ink04 pill; active segment = white pill +
// hair border + soft shadow; idle = transparent.
//
// Box-sizing note: idle segments carry a 1px TRANSPARENT border so they match
// the active segment's 1px hair border — without it RN's borderWidth eats 1px
// off the inner box and every selection change reflows the row.
export interface SegmentedProps<T> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  renderLabel: (v: T) => string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Segmented<T>({
  options,
  value,
  onChange,
  renderLabel,
  disabled = false,
  style,
}: SegmentedProps<T>): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.track, style]}>
      {options.map((opt, i) => {
        const active = opt === value && !disabled;
        return (
          <Pressable
            key={i}
            onPress={() => {
              if (!disabled) onChange(opt);
            }}
            accessibilityRole="button"
            accessibilityLabel={renderLabel(opt)}
            accessibilityState={{ selected: active, disabled }}
            style={[styles.segment, active ? styles.segmentActive : null]}
          >
            <Text
              variant="body"
              color={active ? theme.t.ink : theme.t.inkSub}
              style={active ? styles.labelActive : undefined}
            >
              {renderLabel(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((th) => ({
  track: {
    flexDirection: 'row',
    backgroundColor: th.t.ink04,
    borderRadius: RADIUS.full,
    padding: 3,
    gap: 2,
    width: '100%',
  },
  segment: {
    flex: 1,
    paddingVertical: SPACING.sm - 1, // 7 — matches shipping segment
    paddingHorizontal: SPACING.sm + 2, // 10
    borderRadius: RADIUS.full,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent', // box-sizing match (see header note)
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: th.t.surface,
    borderColor: th.t.hair,
    shadowColor: th.t.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  labelActive: { fontFamily: FONT_FAMILIES.pretendardSemiBold },
}));
