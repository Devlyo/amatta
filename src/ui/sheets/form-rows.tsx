// iPhone-style grouped form primitives — ADR-007 §7 (design board "6 새 일정 추가").
//
// White groups (RADIUS.box) on the grouped background, 44pt rows with hairline
// separators inset from the left, value rows with a chevron that expand an
// inline panel below them, native switches, grey time/date chips (red while
// being edited), red text actions.

import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';

import { IconCheck, IconChevronRight } from '../icons';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';

const ROW_H = 44;
const INSET = 16;

export function FormGroup({ children }: { children: ReactNode }): React.ReactElement {
  return <View style={styles.group}>{children}</View>;
}

export function FormSectionHeader({ label }: { label: string }): React.ReactElement {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

export function FormError({ text }: { text: string | undefined }): React.ReactElement | null {
  if (text === undefined) return null;
  return <Text style={styles.error}>{text}</Text>;
}

/** Hairline between rows, inset like iOS grouped lists. */
function Separator(): React.ReactElement {
  return <View style={styles.separator} />;
}

interface RowFrameProps {
  last?: boolean;
  children: ReactNode;
}

function RowFrame({ last = false, children }: RowFrameProps): React.ReactElement {
  return (
    <View>
      <View style={styles.row}>{children}</View>
      {last ? null : <Separator />}
    </View>
  );
}

/** Borderless text input row (제목 / 장소). */
export const FormInputRow = memo(function FormInputRow({
  last,
  ...input
}: TextInputProps & { last?: boolean }): React.ReactElement {
  return (
    <RowFrame last={last}>
      <TextInput placeholderTextColor={TOKENS.ink30} style={styles.input} {...input} />
    </RowFrame>
  );
});

/**
 * Label on the left, value + chevron on the right. Tapping toggles an inline
 * panel (`expanded` + `children`). `onPress` undefined → read-only row.
 */
export function FormValueRow({
  label,
  value,
  leading,
  onPress,
  expanded = false,
  last = false,
  children,
  testID,
}: {
  label: string;
  value: string;
  /** Small element before the value (e.g. a kid colour dot). */
  leading?: ReactNode;
  onPress?: () => void;
  expanded?: boolean;
  last?: boolean;
  children?: ReactNode;
  testID?: string;
}): React.ReactElement {
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={onPress === undefined}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ expanded }}
        testID={testID}
        style={styles.row}
      >
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueWrap}>
          {leading}
          <Text style={[styles.value, expanded ? styles.valueActive : null]} numberOfLines={1}>
            {value}
          </Text>
          {onPress !== undefined ? (
            <View style={expanded ? styles.chevronOpen : null}>
              <IconChevronRight size={14} color={TOKENS.ink30} />
            </View>
          ) : null}
        </View>
      </Pressable>
      {expanded && children !== undefined ? <View style={styles.panel}>{children}</View> : null}
      {last && !expanded ? null : <Separator />}
    </View>
  );
}

/** Label + native switch (iOS UISwitch). `onColor` = track colour when on. */
export function FormToggleRow({
  label,
  value,
  onChange,
  onColor = TOKENS.success,
  last = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onColor?: string;
  last?: boolean;
}): React.ReactElement {
  return (
    <RowFrame last={last}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: onColor, false: TOKENS.switchOff }}
        ios_backgroundColor={TOKENS.switchOff}
        accessibilityLabel={label}
      />
    </RowFrame>
  );
}

/** Label + one or more grey chips on the right (시작: date chip + time chip). */
export function FormChipsRow({
  label,
  last = false,
  children,
}: {
  label: string;
  last?: boolean;
  children: ReactNode;
}): React.ReactElement {
  return (
    <RowFrame last={last}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </RowFrame>
  );
}

export function TimeChip({
  text,
  active,
  onPress,
  accessibilityLabel,
  disabled = false,
}: {
  text: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: active, disabled }}
      style={styles.chip}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null, disabled ? styles.chipTextDisabled : null]}>
        {text}
      </Text>
    </Pressable>
  );
}

/** Option list inside an expanded value row — checkmark on the selected one. */
export function FormOptionList<T extends string | number | null>({
  options,
  selected,
  onSelect,
  render,
  labelPrefix = '',
}: {
  options: readonly { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
  render?: (key: T) => ReactNode;
  /** Prepended to each option's accessibility label (e.g. "자녀: "). */
  labelPrefix?: string;
}): React.ReactElement {
  return (
    <View>
      {options.map((o, i) => {
        const on = o.key === selected;
        return (
          <Pressable
            key={String(o.key)}
            onPress={() => onSelect(o.key)}
            accessibilityRole="button"
            accessibilityLabel={`${labelPrefix}${o.label}`}
            accessibilityState={{ selected: on }}
            style={[styles.option, i > 0 ? styles.optionDivider : null]}
          >
            {render?.(o.key)}
            <Text style={styles.optionLabel}>{o.label}</Text>
            {on ? <IconCheck size={18} color={TOKENS.sunday} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Red text action row (준비물 추가 / 이 회차만 수정 / 일정 삭제). */
export function FormActionRow({
  label,
  onPress,
  leading,
  tone = 'accent',
  last = false,
}: {
  label: string;
  onPress: () => void;
  leading?: ReactNode;
  tone?: 'accent' | 'danger';
  last?: boolean;
}): React.ReactElement {
  return (
    <View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
        {leading}
        <Text style={[styles.action, tone === 'danger' ? styles.actionDanger : null]}>{label}</Text>
      </Pressable>
      {last ? null : <Separator />}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: TOKENS.surface,
    borderRadius: RADIUS.box,
    overflow: 'hidden',
  },
  // Header / error sit in a small stack with their group (the caller's gap).
  sectionHeader: { ...TYPE.footnote, color: TOKENS.inkSub, paddingHorizontal: INSET },
  error: { ...TYPE.footnote, color: TOKENS.danger, paddingHorizontal: INSET },
  row: {
    minHeight: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: INSET,
    paddingRight: SPACING.md,
  },
  separator: {
    marginLeft: INSET,
    height: StyleSheet.hairlineWidth,
    backgroundColor: TOKENS.ink12,
  },
  label: { ...TYPE.row, color: TOKENS.ink, flex: 1 },
  input: { ...TYPE.row, color: TOKENS.ink, flex: 1, paddingVertical: 11 },
  valueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  value: { ...TYPE.row, color: TOKENS.inkSub, flexShrink: 1 },
  valueActive: { color: TOKENS.sunday },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.ink12,
    marginLeft: INSET,
  },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: RADIUS.sm,
    backgroundColor: TOKENS.ink06,
    justifyContent: 'center',
  },
  chipText: { ...TYPE.row, color: TOKENS.ink },
  chipTextActive: { color: TOKENS.sunday },
  chipTextDisabled: { color: TOKENS.inkSub },
  option: {
    minHeight: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: SPACING.md,
  },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: TOKENS.ink12 },
  optionLabel: { ...TYPE.row, color: TOKENS.ink, flex: 1 },
  action: { ...TYPE.row, color: TOKENS.sunday },
  actionDanger: { color: TOKENS.danger },
});
