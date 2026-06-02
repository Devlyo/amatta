// 1:1 port of docs/design/amatta-v1/app-event-form.jsx into a
// BottomSheetModal-driven RN sheet. External API preserved:
// driven by useUiStore.editSheetState (create / editAll / editOccurrence)
// and saves through useSchedulesStore.{add,update,applyException}.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { useChildrenStore } from '../../state/children-store';
import { useSchedulesStore } from '../../state/schedules-store';
import { useUiStore } from '../../state/ui-store';
import { getDb } from '../../db/client';
import type {
  DaysOfWeekMask,
  ISODate,
  Schedule,
  ScheduleException,
  ScheduleType,
} from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { TypeIcon } from '../common/TypeIcon';
import { FONT_FAMILIES } from '../fonts';
import { TOKENS } from '../palette';
import { fmtKoTime } from '../utils/date';
import {
  DOW_LABELS_KO,
  NOTIFY_OPTIONS,
  TYPE_LABELS_KO,
  TYPE_OPTIONS,
  defaultFormState,
  formFromOccurrence,
  formFromSchedule,
  stepMinutes,
  toggleDayMask,
  validate,
  type EditFormState,
} from './edit-sheet-form';

const SNAP_POINTS: string[] = ['92%'];

// Sunday-first labels, matching the prototype's '일 월 화 수 목 금 토' order.
// Our DaysOfWeekMask uses Monday-bit-0 (`domain/days-of-week.ts`), so we map
// visual index → mask bit at the toggle/read sites.
const DOW_LABELS_SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토'] as const;
const VISUAL_TO_MASK_BIT: readonly number[] = [6, 0, 1, 2, 3, 4, 5];
// Sanity guard: keep DOW_LABELS_KO referenced so its `as const` doesn't
// become dead-import noise — both shapes ship from edit-sheet-form.
void DOW_LABELS_KO;

export function ScheduleEditSheet(): React.ReactElement {
  const editSheetState = useUiStore((s) => s.editSheetState);
  const closeEditSheet = useUiStore((s) => s.closeEditSheet);
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const addSchedule = useSchedulesStore((s) => s.addSchedule);
  const updateSchedule = useSchedulesStore((s) => s.updateSchedule);
  const removeSchedule = useSchedulesStore((s) => s.removeSchedule);
  const applyException = useSchedulesStore((s) => s.applyException);

  const modalRef = useRef<BottomSheetModal>(null);

  const mode = editSheetState.mode;
  const sheetMode: 'create' | 'editAll' | 'editOccurrence' | null =
    mode === 'closed' ? null : mode;

  const existingSchedule: Schedule | undefined = useMemo(() => {
    if (editSheetState.scheduleId === undefined) return undefined;
    return schedules.find((s) => s.id === editSheetState.scheduleId);
  }, [schedules, editSheetState.scheduleId]);

  const existingException: ScheduleException | undefined = useMemo(() => {
    if (
      editSheetState.scheduleId === undefined ||
      editSheetState.occurrenceDate === undefined
    ) {
      return undefined;
    }
    const sid = editSheetState.scheduleId;
    const date = editSheetState.occurrenceDate;
    return exceptions.find((x) => x.scheduleId === sid && x.date === date);
  }, [exceptions, editSheetState.scheduleId, editSheetState.occurrenceDate]);

  const [form, setForm] = useState<EditFormState>(() =>
    defaultFormState(null, null),
  );
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (sheetMode === null) return;
    if (sheetMode === 'create') {
      setForm(
        defaultFormState(
          editSheetState.preFill?.childId ?? null,
          editSheetState.preFill?.date ?? null,
        ),
      );
    } else if (sheetMode === 'editAll' && existingSchedule !== undefined) {
      setForm(formFromSchedule(existingSchedule));
    } else if (
      sheetMode === 'editOccurrence' &&
      existingSchedule !== undefined
    ) {
      setForm(formFromOccurrence(existingSchedule, existingException));
    }
    setSubmitted(false);
  }, [sheetMode, existingSchedule, existingException, editSheetState.preFill]);

  useEffect(() => {
    if (sheetMode === null) {
      modalRef.current?.dismiss();
    } else {
      modalRef.current?.present();
    }
  }, [sheetMode]);

  const validation = useMemo(
    () =>
      validate(form, {
        requireChildId: sheetMode === 'create',
        requireDaysOfWeek: sheetMode !== 'editOccurrence',
      }),
    [form, sheetMode],
  );

  const handleSave = useCallback(async () => {
    setSubmitted(true);
    if (!validation.ok) return;
    if (sheetMode === null) return;

    const db = await getDb();

    if (sheetMode === 'create') {
      if (form.childId === null) return;
      await addSchedule(db, {
        childId: form.childId,
        title: form.title.trim(),
        type: form.type,
        location: form.location.trim().length > 0 ? form.location.trim() : null,
        notes: form.notes.trim().length > 0 ? form.notes.trim() : null,
        daysOfWeek: form.daysOfWeek,
        startMinutes: form.startMinutes,
        endMinutes: form.endMinutes,
        validFrom: form.validFrom as unknown as ISODate,
        validUntil:
          form.validUntil.length > 0
            ? (form.validUntil as unknown as ISODate)
            : null,
        notifyMinutesBefore: form.notifyMinutesBefore,
        needsPickup: form.needsPickup,
      });
    } else if (sheetMode === 'editAll' && existingSchedule !== undefined) {
      await updateSchedule(db, existingSchedule.id, {
        title: form.title.trim(),
        type: form.type,
        location: form.location.trim().length > 0 ? form.location.trim() : null,
        notes: form.notes.trim().length > 0 ? form.notes.trim() : null,
        daysOfWeek: form.daysOfWeek,
        startMinutes: form.startMinutes,
        endMinutes: form.endMinutes,
        validFrom: form.validFrom as unknown as ISODate,
        validUntil:
          form.validUntil.length > 0
            ? (form.validUntil as unknown as ISODate)
            : null,
        notifyMinutesBefore: form.notifyMinutesBefore,
        needsPickup: form.needsPickup,
      });
    } else if (
      sheetMode === 'editOccurrence' &&
      existingSchedule !== undefined &&
      editSheetState.occurrenceDate !== undefined
    ) {
      await applyException(
        db,
        existingSchedule.id,
        editSheetState.occurrenceDate,
        {
          kind: 'modify',
          overrideStartMinutes:
            form.startMinutes !== existingSchedule.startMinutes
              ? form.startMinutes
              : null,
          overrideEndMinutes:
            form.endMinutes !== existingSchedule.endMinutes
              ? form.endMinutes
              : null,
          overrideTitle:
            form.title.trim() !== existingSchedule.title
              ? form.title.trim()
              : null,
        },
      );
    }

    Keyboard.dismiss();
    closeEditSheet();
  }, [
    validation.ok,
    sheetMode,
    form,
    existingSchedule,
    editSheetState.occurrenceDate,
    addSchedule,
    updateSchedule,
    applyException,
    closeEditSheet,
  ]);

  const handleDeleteAll = useCallback(() => {
    if (existingSchedule === undefined) return;
    Alert.alert('전체 삭제', '이 일정과 모든 예외를 삭제합니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await removeSchedule(db, existingSchedule.id);
          closeEditSheet();
        },
      },
    ]);
  }, [existingSchedule, removeSchedule, closeEditSheet]);

  const handleDeleteOccurrence = useCallback(() => {
    if (
      existingSchedule === undefined ||
      editSheetState.occurrenceDate === undefined
    ) {
      return;
    }
    const date = editSheetState.occurrenceDate;
    Alert.alert('이 회차만 삭제', '이 날의 일정만 취소됩니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await applyException(db, existingSchedule.id, date, {
            kind: 'cancel',
          });
          closeEditSheet();
        },
      },
    ]);
  }, [
    existingSchedule,
    editSheetState.occurrenceDate,
    applyException,
    closeEditSheet,
  ]);

  const handleSwitchToOccurrenceMode = useCallback(() => {
    if (existingSchedule === undefined) return;
    const date =
      editSheetState.occurrenceDate ?? useUiStore.getState().currentDate;
    useUiStore.getState().openEditSheet('editOccurrence', {
      scheduleId: existingSchedule.id,
      occurrenceDate: date,
    });
  }, [existingSchedule, editSheetState.occurrenceDate]);

  const handleDismiss = useCallback(() => {
    if (sheetMode !== null) closeEditSheet();
  }, [sheetMode, closeEditSheet]);

  const titleText =
    sheetMode === 'editAll'
      ? '일정 수정'
      : sheetMode === 'editOccurrence'
        ? '이 회차만 수정'
        : '새 일정';
  const saveLabel = sheetMode === 'create' ? '추가' : '저장';

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
      />
    ),
    [],
  );

  const showError = (key: keyof EditFormState): string | undefined =>
    submitted ? validation.errors[key] : undefined;

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={SNAP_POINTS}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetView style={styles.sheetContent}>
        {/* Top bar — 취소 · Title · 추가/저장 */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="취소"
            onPress={closeEditSheet}
            hitSlop={8}
            style={styles.headerSlotStart}
          >
            <Text style={styles.cancelLabel}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{titleText}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
            accessibilityState={{ disabled: !validation.ok }}
            onPress={() => void handleSave()}
            disabled={!validation.ok}
            hitSlop={8}
            style={styles.headerSlotEnd}
          >
            <Text
              style={[
                styles.saveLabel,
                !validation.ok ? styles.saveLabelDisabled : null,
              ]}
            >
              {saveLabel}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group 1: 자녀 + 종류 (create only shows the kid picker; editAll/
              editOccurrence display the bound kid as a read-only chip) */}
          <Group>
            <Row label="자녀" align="top">
              <KidPillRow
                kids={children}
                selectedId={form.childId}
                onPick={
                  sheetMode === 'create'
                    ? (id) => setForm({ ...form, childId: id })
                    : null
                }
              />
              <FieldError text={showError('childId')} />
            </Row>
            <Row label="종류" align="top" hairline={false}>
              <View style={styles.pillRowGrow}>
                {TYPE_OPTIONS.map((t) => {
                  const selected = form.type === t;
                  return (
                    <Pill
                      key={t}
                      active={selected}
                      onPress={() => setForm({ ...form, type: t })}
                      label={TYPE_LABELS_KO[t]}
                      leading={
                        <TypeIcon
                          type={t}
                          size={12}
                          color={selected ? TOKENS.surface : TOKENS.inkSub}
                        />
                      }
                    />
                  );
                })}
              </View>
            </Row>
          </Group>

          {/* Group 2: 제목 + 위치 */}
          <Group>
            <Row label="제목" align="top">
              <BottomSheetTextInput
                value={form.title}
                onChangeText={(v: string) => setForm({ ...form, title: v })}
                placeholder="예) 영어학원"
                placeholderTextColor={TOKENS.ink30}
                style={styles.bigInput}
                maxLength={60}
                testID="sheet-title-input"
                accessibilityLabel="제목 입력"
              />
              <FieldError text={showError('title')} />
            </Row>
            <Row label="위치" align="top" hairline={false}>
              <BottomSheetTextInput
                value={form.location}
                onChangeText={(v: string) => setForm({ ...form, location: v })}
                placeholder="예) JLS어학원"
                placeholderTextColor={TOKENS.ink30}
                style={styles.bigInput}
                maxLength={60}
                accessibilityLabel="위치 입력"
              />
            </Row>
          </Group>

          {/* Group 3: 날짜 + 시간 + 반복 */}
          <Group>
            <Row label="날짜">
              <BottomSheetTextInput
                value={form.validFrom}
                onChangeText={(v: string) =>
                  setForm({ ...form, validFrom: v })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={TOKENS.ink30}
                style={styles.dateInput}
                maxLength={10}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="시작 날짜"
              />
            </Row>
            <Row label="시간">
              <TimeStepper
                ariaLabel="시작 시간"
                minutes={form.startMinutes}
                onChange={(m) => setForm({ ...form, startMinutes: m })}
              />
              <Text style={styles.timeDash}>–</Text>
              <TimeStepper
                ariaLabel="끝 시간"
                minutes={form.endMinutes}
                onChange={(m) => setForm({ ...form, endMinutes: m })}
              />
            </Row>
            {sheetMode !== 'editOccurrence' ? (
              <Row label="종료일">
                <BottomSheetTextInput
                  value={form.validUntil}
                  onChangeText={(v: string) =>
                    setForm({ ...form, validUntil: v })
                  }
                  placeholder="YYYY-MM-DD (선택)"
                  placeholderTextColor={TOKENS.ink30}
                  style={styles.dateInput}
                  maxLength={10}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="종료 날짜"
                />
              </Row>
            ) : null}
            {sheetMode !== 'editOccurrence' ? (
              <Row label="반복" align="top" hairline={false}>
                <View style={styles.dayCircleRow}>
                  {DOW_LABELS_SUN_FIRST.map((label, visualIdx) => {
                    const maskBit = VISUAL_TO_MASK_BIT[visualIdx] ?? 0;
                    const on = (form.daysOfWeek & (1 << maskBit)) !== 0;
                    return (
                      <DayCircle
                        key={label}
                        active={on}
                        label={label}
                        onPress={() =>
                          setForm({
                            ...form,
                            daysOfWeek: toggleDayMask(
                              form.daysOfWeek,
                              maskBit,
                            ) as DaysOfWeekMask,
                          })
                        }
                      />
                    );
                  })}
                </View>
                <FieldError text={showError('daysOfWeek')} />
              </Row>
            ) : null}
            {sheetMode !== 'editOccurrence' ? (
              <FieldError text={showError('validFrom') ?? showError('validUntil')} />
            ) : null}
            <FieldError
              text={showError('startMinutes') ?? showError('endMinutes')}
            />
          </Group>

          {/* Group 4: 알림 + 픽업 */}
          <Group>
            <Row label="알림" align="top">
              <View style={styles.pillWrapRow}>
                {NOTIFY_OPTIONS.map((opt) => {
                  const selected = form.notifyMinutesBefore === opt;
                  const label = opt === null ? '없음' : `${opt}분 전`;
                  return (
                    <Pill
                      key={String(opt)}
                      active={selected}
                      onPress={() =>
                        setForm({ ...form, notifyMinutesBefore: opt })
                      }
                      label={label}
                    />
                  );
                })}
              </View>
            </Row>
            <Row label="픽업" hairline={false}>
              {form.needsPickup ? (
                <View style={styles.pickupBadge}>
                  <View style={styles.pickupDot} />
                  <Text style={styles.pickupText}>
                    {fmtKoTime(form.endMinutes)} 픽업
                  </Text>
                </View>
              ) : null}
              <ToggleSwitch
                value={form.needsPickup}
                onChange={(v) => setForm({ ...form, needsPickup: v })}
                ariaLabel="픽업"
              />
            </Row>
          </Group>

          {/* Group 5: 메모 */}
          <Group>
            <Row label="메모" align="top" hairline={false}>
              <BottomSheetTextInput
                value={form.notes}
                onChangeText={(v: string) => setForm({ ...form, notes: v })}
                placeholder="추가 정보"
                placeholderTextColor={TOKENS.ink30}
                style={[styles.bigInput, styles.notesInput]}
                multiline
                maxLength={500}
                accessibilityLabel="메모 입력"
              />
            </Row>
          </Group>

          {/* Destructive actions — editAll only. editOccurrence shows a single
              "이 회차 취소" ghost action. */}
          {sheetMode === 'editAll' && existingSchedule !== undefined ? (
            <View style={styles.actionGroup}>
              <ActionRow
                label="이 회차만 수정"
                onPress={handleSwitchToOccurrenceMode}
                hairline
              />
              <ActionRow
                label="이 회차만 삭제"
                onPress={handleDeleteOccurrence}
                hairline
              />
              <ActionRow
                label="전체 삭제"
                onPress={handleDeleteAll}
                tone="danger"
              />
            </View>
          ) : null}

          {sheetMode === 'editOccurrence' && existingSchedule !== undefined ? (
            <View style={styles.actionGroup}>
              <ActionRow
                label="이 회차만 삭제"
                onPress={handleDeleteOccurrence}
                tone="danger"
              />
            </View>
          ) : null}

          <View style={styles.tail} />
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

// -----------------------------------------------------------------------------
// Layout primitives — Group / Row mirror app-event-form.jsx Group + Row.
// -----------------------------------------------------------------------------

function Group({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <View style={styles.group}>{children}</View>;
}

interface RowProps {
  label: string;
  children: React.ReactNode;
  hairline?: boolean;
  align?: 'center' | 'top';
}

function Row({
  label,
  children,
  hairline = true,
  align = 'center',
}: RowProps): React.ReactElement {
  return (
    <View
      style={[
        styles.row,
        hairline ? styles.rowHairline : null,
        align === 'top' ? styles.rowTop : styles.rowCenter,
      ]}
    >
      <Text
        style={[
          styles.rowLabel,
          align === 'top' ? styles.rowLabelTop : null,
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.rowContent,
          align === 'top' ? styles.rowContentTop : styles.rowContentCenter,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function FieldError({
  text,
}: {
  text: string | undefined;
}): React.ReactElement | null {
  if (text === undefined) return null;
  return <Text style={styles.fieldError}>{text}</Text>;
}

interface PillProps {
  active: boolean;
  onPress: () => void;
  label: string;
  leading?: React.ReactNode;
}

function Pill({
  active,
  onPress,
  label,
  leading,
}: PillProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[styles.pill, active ? styles.pillActive : null]}
    >
      {leading}
      <Text
        style={[
          styles.pillLabel,
          active ? styles.pillLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DayCircle({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`요일 ${label}`}
      accessibilityState={{ selected: active }}
      style={[styles.dayCircle, active ? styles.dayCircleActive : null]}
    >
      <Text
        style={[
          styles.dayCircleLabel,
          active ? styles.dayCircleLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleSwitch({
  value,
  onChange,
  ariaLabel,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={ariaLabel}
      accessibilityState={{ checked: value }}
      style={[styles.switchTrack, value ? styles.switchTrackOn : null]}
    >
      <View
        style={[
          styles.switchKnob,
          value ? styles.switchKnobOn : styles.switchKnobOff,
        ]}
      />
    </Pressable>
  );
}

function KidPillRow({
  kids,
  selectedId,
  onPick,
}: {
  kids: { id: number; name: string; colorIndex: 0 | 1 | 2 | 3 | 4 | 5 }[];
  selectedId: number | null;
  onPick: ((id: number) => void) | null;
}): React.ReactElement {
  return (
    <View style={styles.kidPillRow}>
      {kids.map((k) => {
        const active = k.id === selectedId;
        const interactive = onPick !== null;
        return (
          <Pressable
            key={k.id}
            disabled={!interactive}
            onPress={() => onPick?.(k.id)}
            accessibilityRole="button"
            accessibilityLabel={`자녀: ${k.name}`}
            accessibilityState={{ selected: active }}
            style={[styles.kidPill, active ? styles.kidPillActive : null]}
          >
            {/* Cast: KidAvatar accepts `Child` but only reads `name`+`colorIndex`. */}
            <KidAvatar
              child={k as unknown as import('../../domain/types').Child}
              size={22}
            />
            <Text
              style={[
                styles.kidPillLabel,
                active ? styles.kidPillLabelActive : null,
              ]}
            >
              {k.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TimeStepper({
  minutes,
  onChange,
  ariaLabel,
}: {
  minutes: number;
  onChange: (m: number) => void;
  ariaLabel: string;
}): React.ReactElement {
  return (
    <View style={styles.timeStepper}>
      <Pressable
        onPress={() => onChange(stepMinutes(minutes, -1))}
        accessibilityRole="button"
        accessibilityLabel={`${ariaLabel} 30분 빼기`}
        hitSlop={6}
        style={styles.timeStepperBtn}
      >
        <Text style={styles.timeStepperBtnLabel}>−</Text>
      </Pressable>
      <Text style={styles.timeStepperValue}>{fmtKoTime(minutes)}</Text>
      <Pressable
        onPress={() => onChange(stepMinutes(minutes, 1))}
        accessibilityRole="button"
        accessibilityLabel={`${ariaLabel} 30분 더하기`}
        hitSlop={6}
        style={styles.timeStepperBtn}
      >
        <Text style={styles.timeStepperBtnLabel}>＋</Text>
      </Pressable>
    </View>
  );
}

function ActionRow({
  label,
  onPress,
  tone,
  hairline = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'danger';
  hairline?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.actionRow,
        hairline ? styles.actionRowHairline : null,
      ]}
    >
      <Text
        style={[
          styles.actionLabel,
          tone === 'danger' ? styles.actionLabelDanger : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Re-export the form type to match the prior public surface — other modules
// (tests, future drawer wiring) import `EditFormState` from here OR from the
// `edit-sheet-form` module; keep both paths working.
export type { EditFormState } from './edit-sheet-form';
// Keep ScheduleType import from triggering "imported but unused" — referenced
// by future TypeChip props.
void (null as unknown as ScheduleType);

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: TOKENS.surfaceWarm },
  handleIndicator: { backgroundColor: TOKENS.ink12 },

  sheetContent: { flex: 1 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerSlotStart: { flex: 1, alignItems: 'flex-start' },
  headerSlotEnd: { flex: 1, alignItems: 'flex-end' },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.4,
  },
  cancelLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  saveLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.primary,
    letterSpacing: -0.3,
  },
  saveLabelDisabled: { color: TOKENS.ink30 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 8 },

  // --- Group / Row -----------------------------------------------------
  group: {
    backgroundColor: TOKENS.surface,
    borderRadius: 14,
    marginHorizontal: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
  },
  rowHairline: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.ink04,
  },
  rowCenter: { alignItems: 'center' },
  rowTop: { alignItems: 'flex-start' },
  rowLabel: {
    width: 56,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  rowLabelTop: { paddingTop: 5 },
  rowContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowContentCenter: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  rowContentTop: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  // --- Inputs ----------------------------------------------------------
  bigInput: {
    width: '100%',
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    padding: 0,
    margin: 0,
    lineHeight: 18,
  },
  notesInput: { minHeight: 64, textAlignVertical: 'top' },
  dateInput: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    padding: 0,
    margin: 0,
    minWidth: 120,
    textAlign: 'right',
  },

  // --- Pills -----------------------------------------------------------
  pillRowGrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%' },
  pillWrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 13,
    backgroundColor: '#EBEAE9',
    borderRadius: 9999,
  },
  pillActive: { backgroundColor: '#2A2A29' },
  pillLabel: {
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    lineHeight: 14,
  },
  pillLabelActive: { color: TOKENS.surface },

  // --- Kid pill row ----------------------------------------------------
  kidPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 11,
    backgroundColor: '#EBEAE9',
    borderRadius: 9999,
  },
  kidPillActive: { backgroundColor: '#2A2A29' },
  kidPillLabel: {
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    lineHeight: 14,
  },
  kidPillLabelActive: { color: TOKENS.surface },

  // --- Day circles -----------------------------------------------------
  dayCircleRow: { flexDirection: 'row', gap: 6 },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBEAE9',
  },
  dayCircleActive: { backgroundColor: '#2A2A29' },
  dayCircleLabel: {
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  dayCircleLabelActive: { color: TOKENS.surface },

  // --- Time stepper ----------------------------------------------------
  timeStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeStepperBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: TOKENS.ink04,
  },
  timeStepperBtnLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
  },
  timeStepperValue: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    minWidth: 64,
    textAlign: 'center',
  },
  timeDash: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink30,
  },

  // --- Switch ----------------------------------------------------------
  switchTrack: {
    width: 36,
    height: 22,
    borderRadius: 9999,
    backgroundColor: '#D6D8DD',
    padding: 2,
  },
  switchTrackOn: { backgroundColor: '#2A2A29' },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9999,
    backgroundColor: TOKENS.surface,
  },
  switchKnobOff: { alignSelf: 'flex-start' },
  switchKnobOn: { alignSelf: 'flex-end' },

  // --- Pickup badge ----------------------------------------------------
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 2,
  },
  pickupDot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
    backgroundColor: TOKENS.primary,
  },
  pickupText: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },

  // --- Errors ----------------------------------------------------------
  fieldError: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.danger,
    marginTop: 4,
    width: '100%',
  },

  // --- Destructive actions --------------------------------------------
  actionGroup: {
    backgroundColor: TOKENS.surface,
    borderRadius: 14,
    marginHorizontal: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  actionRow: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionRowHairline: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.ink04,
  },
  actionLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  actionLabelDanger: { color: TOKENS.danger },

  tail: { height: 32 },
});
