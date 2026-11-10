// iPhone-style grouped form primitives — ADR-007 §7 (design board "6 새 일정 추가").
//
// White groups (RADIUS.box) on the grouped background, 44pt rows with hairline
// separators inset from the left, value rows with a chevron that expand an
// inline panel below them, native switches, grey time/date chips (red while
// being edited), red text actions. One red everywhere: the danger token (the
// 이 회차만 삭제 red) — accents, active values, checks, actions.

import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';

import { IconCheck, IconChevronRight } from '../icons';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { makeStyles, useTheme } from '../appearance';

const ROW_H = 44;
const INSET = 16;

export function FormGroup({ children }: { children: ReactNode }): React.ReactElement {
  const styles = useStyles();
  return <View style={styles.group}>{children}</View>;
}

export function FormSectionHeader({ label }: { label: string }): React.ReactElement {
  const styles = useStyles();
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

export function FormError({ text }: { text: string | undefined }): React.ReactElement | null {
  const styles = useStyles();
  if (text === undefined) return null;
  return <Text style={styles.error}>{text}</Text>;
}

/** Hairline between rows, inset like iOS grouped lists. */
function Separator(): React.ReactElement {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

interface RowFrameProps {
  last?: boolean;
  children: ReactNode;
}

function RowFrame({ last = false, children }: RowFrameProps): React.ReactElement {
  const styles = useStyles();
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
  const theme = useTheme();
  const styles = useStyles();
  return (
    <RowFrame last={last}>
      <TextInput placeholderTextColor={theme.t.ink30} style={styles.input} {...input} />
    </RowFrame>
  );
});

/** Read-only text in the place of an input row (event detail: 제목 / 장소 / 메모). */
export function FormTextRow({
  text,
  placeholder,
  emphasis = false,
  last = false,
}: {
  text: string;
  /** Shown muted when `text` is empty. */
  placeholder?: string;
  /** Title style (event detail headline). */
  emphasis?: boolean;
  last?: boolean;
}): React.ReactElement {
  const styles = useStyles();
  const empty = text.trim().length === 0;
  return (
    <RowFrame last={last}>
      <Text style={[styles.input, emphasis ? styles.inputEmphasis : null, empty ? styles.inputPlaceholder : null]}>
        {empty ? (placeholder ?? '') : text}
      </Text>
    </RowFrame>
  );
}

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
  const theme = useTheme();
  const styles = useStyles();
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
              <IconChevronRight size={14} color={theme.t.ink30} />
            </View>
          ) : null}
        </View>
      </Pressable>
      {expanded && children !== undefined ? <View style={styles.panel}>{children}</View> : null}
      {last && !expanded ? null : <Separator />}
    </View>
  );
}

/** Label + native switch (iOS UISwitch). On = the app's orange everywhere (owner, 2026-11-10). */
export function FormToggleRow({
  label,
  value,
  onChange,
  onColor,
  last = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onColor?: string;
  last?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <RowFrame last={last}>
      <Text style={styles.label}>{label}</Text>
      {/* The native switch can lay out top-aligned under the new architecture —
          a row-high box keeps it centred on the label. */}
      <View style={styles.switchBox}>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ true: onColor ?? theme.t.primary, false: theme.t.switchOff }}
          ios_backgroundColor={theme.t.switchOff}
          accessibilityLabel={label}
        />
      </View>
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
  const styles = useStyles();
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
  const styles = useStyles();
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
  isSelected,
}: {
  options: readonly { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
  render?: (key: T) => ReactNode;
  /** Prepended to each option's accessibility label (e.g. "자녀: "). */
  labelPrefix?: string;
  /** Multi-select (ADR-013 자녀): round check boxes; `selected` is ignored. */
  isSelected?: (key: T) => boolean;
}): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const multi = isSelected !== undefined;
  return (
    <View>
      {options.map((o, i) => {
        const on = multi ? isSelected(o.key) : o.key === selected;
        return (
          <Pressable
            key={String(o.key)}
            onPress={() => onSelect(o.key)}
            accessibilityRole={multi ? 'checkbox' : 'button'}
            accessibilityLabel={`${labelPrefix}${o.label}`}
            accessibilityState={multi ? { checked: on } : { selected: on }}
            testID={multi ? `option-${String(o.key)}` : undefined}
            style={[styles.option, i > 0 ? styles.optionDivider : null]}
          >
            {render?.(o.key)}
            <Text style={styles.optionLabel}>{o.label}</Text>
            {multi ? (
              <View style={[styles.checkCircle, on ? styles.checkCircleOn : null]}>
                {on ? <IconCheck size={13} color={theme.t.surface} /> : null}
              </View>
            ) : on ? (
              <IconCheck size={18} color={theme.t.danger} />
            ) : null}
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
  const styles = useStyles();
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

const useStyles = makeStyles((th) => ({
  group: {
    backgroundColor: th.t.surface,
    borderRadius: RADIUS.box,
    overflow: 'hidden',
  },
  // Header / error sit in a small stack with their group (the caller's gap).
  sectionHeader: { ...TYPE.footnote, color: th.t.inkSub, paddingHorizontal: INSET },
  error: { ...TYPE.footnote, color: th.t.danger, paddingHorizontal: INSET },
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
    backgroundColor: th.t.separator,
  },
  label: { ...TYPE.row, color: th.t.ink, flex: 1 },
  switchBox: { height: ROW_H, justifyContent: 'center' },
  input: { ...TYPE.row, color: th.t.ink, flex: 1, paddingVertical: 11 },
  inputEmphasis: { ...TYPE.headline },
  inputPlaceholder: { color: th.t.ink30 },
  valueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  value: { ...TYPE.row, color: th.t.inkSub, flexShrink: 1 },
  valueActive: { color: th.t.danger },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: th.t.separator,
    marginLeft: INSET,
  },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: RADIUS.sm,
    backgroundColor: th.t.ink06,
    justifyContent: 'center',
  },
  chipText: { ...TYPE.row, color: th.t.ink },
  chipTextActive: { color: th.t.danger },
  chipTextDisabled: { color: th.t.inkSub },
  option: {
    minHeight: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: SPACING.md,
  },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: th.t.separator },
  optionLabel: { ...TYPE.row, color: th.t.ink, flex: 1 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: th.t.ink30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleOn: { backgroundColor: th.t.primary, borderColor: th.t.primary },
  action: { ...TYPE.row, color: th.t.danger },
  actionDanger: { color: th.t.danger },
}));
