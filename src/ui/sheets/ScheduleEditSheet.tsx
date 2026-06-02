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
import { ColorDot } from '../common/ColorDot';
import { TypeIcon } from '../common/TypeIcon';
import { TOKENS } from '../palette';
import {
  DOW_LABELS_KO,
  NOTIFY_OPTIONS,
  TYPE_OPTIONS,
  defaultFormState,
  formFromOccurrence,
  formFromSchedule,
  formatHHMM,
  stepMinutes,
  toggleDayMask,
  validate,
  type EditFormState,
} from './edit-sheet-form';

const SNAP_POINTS: string[] = ['85%'];

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

  // Drive the modal from ui-store. The mode in editSheetState is the source
  // of truth; present/dismiss follow.
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
    return exceptions.find(
      (x) => x.scheduleId === sid && x.date === date,
    );
  }, [exceptions, editSheetState.scheduleId, editSheetState.occurrenceDate]);

  // -------------------------------------------------------------------------
  // Local form state. Reset whenever the sheet (re)opens or mode changes.
  // -------------------------------------------------------------------------
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

  // Present / dismiss the underlying modal in response to ui-store.
  useEffect(() => {
    if (sheetMode === null) {
      modalRef.current?.dismiss();
    } else {
      modalRef.current?.present();
    }
  }, [sheetMode]);

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
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
    // Use today's anchor date if the caller didn't pass one (e.g., opened
    // from the daily view's block tap).
    const date =
      editSheetState.occurrenceDate ??
      (useUiStore.getState().currentDate);
    useUiStore.getState().openEditSheet('editOccurrence', {
      scheduleId: existingSchedule.id,
      occurrenceDate: date,
    });
  }, [existingSchedule, editSheetState.occurrenceDate]);

  const handleDismiss = useCallback(() => {
    // Called by BottomSheetModal when the user drags it down. Sync ui-store.
    if (sheetMode !== null) closeEditSheet();
  }, [sheetMode, closeEditSheet]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const titleText =
    sheetMode === 'editAll'
      ? '일정 수정'
      : sheetMode === 'editOccurrence'
        ? '이 회차만 수정'
        : '일정 추가';

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

  const showError = (
    key: keyof EditFormState,
  ): string | undefined =>
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
        {/* Header bar */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="취소"
            onPress={closeEditSheet}
            hitSlop={8}
          >
            <Text style={styles.cancelLabel}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{titleText}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="저장"
            accessibilityState={{ disabled: !validation.ok }}
            onPress={() => void handleSave()}
            disabled={!validation.ok}
            hitSlop={8}
          >
            <Text
              style={[
                styles.saveLabel,
                !validation.ok ? styles.saveLabelDisabled : null,
              ]}
            >
              저장
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Child picker — create mode only */}
          {sheetMode === 'create' ? (
            <Section title="자녀">
              <View style={styles.chipRow}>
                {children.map((c) => {
                  const selected = c.id === form.childId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setForm({ ...form, childId: c.id })}
                      style={[
                        styles.chip,
                        selected ? styles.chipSelected : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`자녀: ${c.name}`}
                      accessibilityState={{ selected }}
                    >
                      <ColorDot colorIndex={c.colorIndex} size={10} />
                      <Text style={styles.chipText}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <FieldError text={showError('childId')} />
            </Section>
          ) : null}

          {/* Title */}
          <Section title="제목">
            <BottomSheetTextInput
              value={form.title}
              onChangeText={(v: string) => setForm({ ...form, title: v })}
              placeholder="예: 영어학원"
              placeholderTextColor={TOKENS.inkSub}
              style={styles.input}
              maxLength={60}
              testID="sheet-title-input"
              accessibilityLabel="제목 입력"
            />
            <FieldError text={showError('title')} />
          </Section>

          {/* Type */}
          <Section title="종류">
            <View style={styles.chipRow}>
              {TYPE_OPTIONS.map((t) => (
                <TypeChip
                  key={t}
                  type={t}
                  selected={form.type === t}
                  onPress={() => setForm({ ...form, type: t })}
                />
              ))}
            </View>
          </Section>

          {/* Days of week — hidden for editOccurrence */}
          {sheetMode !== 'editOccurrence' ? (
            <Section title="반복 요일">
              <View style={styles.chipRow}>
                {DOW_LABELS_KO.map((label, idx) => {
                  const on = (form.daysOfWeek & (1 << idx)) !== 0;
                  return (
                    <Pressable
                      key={label}
                      onPress={() =>
                        setForm({
                          ...form,
                          daysOfWeek: toggleDayMask(form.daysOfWeek, idx) as DaysOfWeekMask,
                        })
                      }
                      style={[
                        styles.dowPill,
                        on ? styles.dowPillOn : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`요일 ${label}`}
                      accessibilityState={{ selected: on }}
                    >
                      <Text
                        style={[
                          styles.dowText,
                          on ? styles.dowTextOn : null,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <FieldError text={showError('daysOfWeek')} />
            </Section>
          ) : null}

          {/* Time */}
          <Section title="시간">
            <View style={styles.timeRow}>
              <TimeStepper
                label="시작"
                minutes={form.startMinutes}
                onChange={(m) => setForm({ ...form, startMinutes: m })}
              />
              <TimeStepper
                label="종료"
                minutes={form.endMinutes}
                onChange={(m) => setForm({ ...form, endMinutes: m })}
              />
            </View>
            <FieldError text={showError('startMinutes') ?? showError('endMinutes')} />
          </Section>

          {/* Recurrence range — hidden for editOccurrence */}
          {sheetMode !== 'editOccurrence' ? (
            <Section title="기간">
              <View style={styles.dateRow}>
                <DateInput
                  label="시작일"
                  value={form.validFrom}
                  onChangeText={(v) => setForm({ ...form, validFrom: v })}
                />
                <DateInput
                  label="종료일 (선택)"
                  value={form.validUntil}
                  onChangeText={(v) => setForm({ ...form, validUntil: v })}
                />
              </View>
              <FieldError text={showError('validFrom') ?? showError('validUntil')} />
            </Section>
          ) : null}

          {/* Location */}
          <Section title="장소 (선택)">
            <BottomSheetTextInput
              value={form.location}
              onChangeText={(v: string) => setForm({ ...form, location: v })}
              placeholder="예: 학원 1관"
              placeholderTextColor={TOKENS.inkSub}
              style={styles.input}
              maxLength={60}
              accessibilityLabel="장소 입력"
            />
          </Section>

          {/* Notes */}
          <Section title="메모 (선택)">
            <BottomSheetTextInput
              value={form.notes}
              onChangeText={(v: string) => setForm({ ...form, notes: v })}
              placeholder="필요한 메모를 적어주세요"
              placeholderTextColor={TOKENS.inkSub}
              style={[styles.input, styles.notesInput]}
              multiline
              maxLength={500}
              accessibilityLabel="메모 입력"
            />
          </Section>

          {/* Notify */}
          <Section title="알림">
            <View style={styles.chipRow}>
              {NOTIFY_OPTIONS.map((opt) => {
                const selected = form.notifyMinutesBefore === opt;
                return (
                  <Pressable
                    key={String(opt)}
                    onPress={() =>
                      setForm({ ...form, notifyMinutesBefore: opt })
                    }
                    style={[
                      styles.chip,
                      selected ? styles.chipSelected : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      opt === null ? '알림 없음' : `${opt}분 전 알림`
                    }
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.chipText}>
                      {opt === null ? '없음' : `${opt}분 전`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* Mode-specific actions */}
          {sheetMode === 'editAll' ? (
            <View style={styles.actionStack}>
              <Pressable
                onPress={handleSwitchToOccurrenceMode}
                style={styles.ghostButton}
                accessibilityRole="button"
                accessibilityLabel="이 회차만 수정"
              >
                <Text style={styles.ghostButtonLabel}>이 회차만 수정</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteOccurrence}
                style={styles.ghostButton}
                accessibilityRole="button"
                accessibilityLabel="이 회차만 삭제"
              >
                <Text style={styles.ghostButtonLabel}>이 회차만 삭제</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteAll}
                style={styles.dangerButton}
                accessibilityRole="button"
                accessibilityLabel="전체 삭제"
              >
                <Text style={styles.dangerButtonLabel}>전체 삭제</Text>
              </Pressable>
            </View>
          ) : null}

          {sheetMode === 'editOccurrence' && existingSchedule !== undefined ? (
            <View style={styles.actionStack}>
              <Pressable
                onPress={handleDeleteOccurrence}
                style={styles.ghostButton}
                accessibilityRole="button"
                accessibilityLabel="이 회차 취소"
              >
                <Text style={styles.ghostButtonLabel}>이 회차 취소</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.tail} />
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FieldError({ text }: { text: string | undefined }): React.ReactElement | null {
  if (text === undefined) return null;
  return <Text style={styles.fieldError}>{text}</Text>;
}

function TypeChip({
  type,
  selected,
  onPress,
}: {
  type: ScheduleType;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const LABEL: Record<ScheduleType, string> = {
    school: '학교',
    academy: '학원',
    activity: '활동',
    other: '기타',
  };
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
      accessibilityRole="button"
      accessibilityLabel={`종류: ${LABEL[type]}`}
      accessibilityState={{ selected }}
    >
      <TypeIcon type={type} size={12} color={selected ? TOKENS.surface : TOKENS.ink} />
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {LABEL[type]}
      </Text>
    </Pressable>
  );
}

function TimeStepper({
  label,
  minutes,
  onChange,
}: {
  label: string;
  minutes: number;
  onChange: (m: number) => void;
}): React.ReactElement {
  return (
    <View style={styles.timeStepper}>
      <Text style={styles.timeStepperLabel}>{label}</Text>
      <View style={styles.timeStepperRow}>
        <Pressable
          onPress={() => onChange(stepMinutes(minutes, -1))}
          style={styles.timeStepperBtn}
          accessibilityRole="button"
          accessibilityLabel={`${label} 30분 빼기`}
          hitSlop={6}
        >
          <Text style={styles.timeStepperBtnLabel}>−</Text>
        </Pressable>
        <Text style={styles.timeStepperValue}>{formatHHMM(minutes)}</Text>
        <Pressable
          onPress={() => onChange(stepMinutes(minutes, 1))}
          style={styles.timeStepperBtn}
          accessibilityRole="button"
          accessibilityLabel={`${label} 30분 더하기`}
          hitSlop={6}
        >
          <Text style={styles.timeStepperBtnLabel}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DateInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}): React.ReactElement {
  return (
    <View style={styles.dateInputBlock}>
      <Text style={styles.dateInputLabel}>{label}</Text>
      <BottomSheetTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={TOKENS.inkSub}
        style={styles.input}
        maxLength={10}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={`${label} 입력`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: TOKENS.surface },
  handleIndicator: { backgroundColor: TOKENS.ink30 },

  sheetContent: { flex: 1 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: TOKENS.ink },
  cancelLabel: { fontSize: 14, color: TOKENS.inkSub },
  saveLabel: { fontSize: 14, fontWeight: '600', color: TOKENS.primary },
  saveLabelDisabled: { color: TOKENS.ink30 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.inkSub,
    marginBottom: 8,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
    backgroundColor: TOKENS.surfaceWarm,
    borderWidth: 1,
    borderColor: TOKENS.hair,
  },
  chipSelected: {
    backgroundColor: TOKENS.primary,
    borderColor: TOKENS.primary,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: TOKENS.ink },
  chipTextSelected: { color: TOKENS.surface },

  input: {
    borderWidth: 1,
    borderColor: TOKENS.hair,
    borderRadius: 12,
    backgroundColor: TOKENS.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TOKENS.ink,
    fontSize: 14,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  dowPill: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surfaceWarm,
    borderWidth: 1,
    borderColor: TOKENS.hair,
  },
  dowPillOn: {
    backgroundColor: TOKENS.primary,
    borderColor: TOKENS.primary,
  },
  dowText: { fontSize: 12, fontWeight: '600', color: TOKENS.ink },
  dowTextOn: { color: TOKENS.surface },

  timeRow: { flexDirection: 'row', gap: 12 },
  timeStepper: { flex: 1 },
  timeStepperLabel: {
    fontSize: 12,
    color: TOKENS.inkSub,
    marginBottom: 6,
  },
  timeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: TOKENS.hair,
    borderRadius: 12,
    backgroundColor: TOKENS.surfaceWarm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  timeStepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  timeStepperBtnLabel: { fontSize: 20, color: TOKENS.ink },
  timeStepperValue: {
    fontSize: 16,
    fontWeight: '600',
    color: TOKENS.ink,
    fontVariant: ['tabular-nums'],
  },

  dateRow: { flexDirection: 'row', gap: 12 },
  dateInputBlock: { flex: 1 },
  dateInputLabel: { fontSize: 12, color: TOKENS.inkSub, marginBottom: 4 },

  fieldError: { fontSize: 12, color: TOKENS.danger, marginTop: 4 },

  actionStack: { gap: 8, marginTop: 8 },
  ghostButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.ink30,
    alignItems: 'center',
    backgroundColor: TOKENS.surface,
  },
  ghostButtonLabel: { fontSize: 14, fontWeight: '500', color: TOKENS.ink },
  dangerButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.danger,
    alignItems: 'center',
    backgroundColor: TOKENS.surface,
  },
  dangerButtonLabel: { fontSize: 14, fontWeight: '600', color: TOKENS.danger },

  tail: { height: 32 },
});
