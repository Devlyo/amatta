// 1:1 port of docs/design/amatta-v1/app-event-form.jsx into a
// RN-native Modal-driven sheet. External API preserved:
// driven by useUiStore.editSheetState (create / editAll / editOccurrence)
// and saves through useSchedulesStore.{add,update,applyException}.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { useChildrenStore } from '../../state/children-store';
import { useChecklistStore } from '../../state/checklist-store';
import { useSchedulesStore } from '../../state/schedules-store';
import { useUiStore } from '../../state/ui-store';
import { getDb } from '../../db/client';
import type {
  ChecklistItem,
  DaysOfWeekMask,
  ISODate,
  Minutes,
  Schedule,
  ScheduleException,
  ScheduleType,
} from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { TypeIcon } from '../common/TypeIcon';
import { FONT_FAMILIES } from '../fonts';
import {
  IconChevronDown,
  IconPlus,
  IconXMark,
} from '../icons';
import { TOKENS } from '../palette';
import { fmtKoTime, weekdayKo } from '../utils/date';
import {
  DOW_LABELS_KO,
  NOTIFY_OPTIONS,
  TYPE_LABELS_KO,
  TYPE_OPTIONS,
  defaultFormState,
  formFromOccurrence,
  formFromSchedule,
  toggleDayMask,
  validate,
  type EditFormState,
} from './edit-sheet-form';

// Sunday-first labels, matching the prototype's '일 월 화 수 목 금 토' order.
// Our DaysOfWeekMask uses Monday-bit-0 (`domain/days-of-week.ts`), so we map
// visual index → mask bit at the toggle/read sites.
const DOW_LABELS_SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토'] as const;
const VISUAL_TO_MASK_BIT: readonly number[] = [6, 0, 1, 2, 3, 4, 5];
// Sanity guard: keep DOW_LABELS_KO referenced so its `as const` doesn't
// become dead-import noise — both shapes ship from edit-sheet-form.
void DOW_LABELS_KO;

// Drafted checklist row. `id===null` = brand-new (not yet persisted) so save
// knows whether to INSERT vs UPDATE.
interface ChecklistDraft {
  id: number | null;
  label: string;
}

type PickerState =
  | null
  | { field: 'validFrom' | 'validUntil'; mode: 'date'; value: Date }
  | { field: 'startMinutes' | 'endMinutes'; mode: 'time'; value: Date };

// ── Native-picker bridge helpers ────────────────────────────────────────────
function isoToDate(iso: string): Date {
  // Local-tz interpretation. Empty string → today (caller suppresses display).
  if (iso.length === 0) return new Date();
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return new Date(y, m - 1, d);
}
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function minutesToDate(min: Minutes): Date {
  const ref = new Date(2000, 0, 1);
  ref.setHours(Math.floor(min / 60));
  ref.setMinutes(min % 60);
  ref.setSeconds(0);
  ref.setMilliseconds(0);
  return ref;
}
function dateToMinutes(d: Date): Minutes {
  return (d.getHours() * 60 + d.getMinutes()) as Minutes;
}
// "2026.06.02 (월)" — prototype caption format for the date row.
function formatKoDateFull(iso: string): string {
  if (iso.length === 0) return '날짜 선택';
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  return `${y}.${m}.${d} (${weekdayKo(iso as unknown as ISODate)})`;
}

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
  const checklistAdd = useChecklistStore((s) => s.add);
  const checklistUpdate = useChecklistStore((s) => s.updateOne);
  const checklistRemove = useChecklistStore((s) => s.removeOne);
  const checklistItemsByScheduleId = useChecklistStore(
    (s) => s.itemsByScheduleId,
  );

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
  const [picker, setPicker] = useState<PickerState>(null);
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  // Snapshot of the checklist as it was when the sheet opened. Used by save
  // to compute INSERT / UPDATE / DELETE diffs against the in-memory edits.
  const originalChecklistRef = useRef<ChecklistItem[]>([]);

  useEffect(() => {
    if (sheetMode === null) return;
    if (sheetMode === 'create') {
      setForm(
        defaultFormState(
          editSheetState.preFill?.childId ?? null,
          editSheetState.preFill?.date ?? null,
        ),
      );
      originalChecklistRef.current = [];
      setChecklist([]);
    } else if (sheetMode === 'editAll' && existingSchedule !== undefined) {
      setForm(formFromSchedule(existingSchedule));
      const items = checklistItemsByScheduleId.get(existingSchedule.id) ?? [];
      originalChecklistRef.current = items;
      setChecklist(items.map((it) => ({ id: it.id, label: it.label })));
    } else if (
      sheetMode === 'editOccurrence' &&
      existingSchedule !== undefined
    ) {
      setForm(formFromOccurrence(existingSchedule, existingException));
      // editOccurrence is single-day; checklists live at the schedule level,
      // so we skip the section (see render guard below) and stash empty.
      originalChecklistRef.current = [];
      setChecklist([]);
    }
    setSubmitted(false);
    setPicker(null);
  }, [
    sheetMode,
    existingSchedule,
    existingException,
    editSheetState.preFill,
    checklistItemsByScheduleId,
  ]);

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
      const created = await addSchedule(db, {
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
      // Persist the drafted checklist labels — empty/whitespace rows skipped.
      const labels = checklist
        .map((c) => c.label.trim())
        .filter((s) => s.length > 0);
      for (let i = 0; i < labels.length; i++) {
        await checklistAdd(db, {
          scheduleId: created.id,
          label: labels[i] ?? '',
          sortOrder: i,
        });
      }
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
      await persistChecklistDiff(
        db,
        existingSchedule.id,
        originalChecklistRef.current,
        checklist,
        { add: checklistAdd, update: checklistUpdate, remove: checklistRemove },
      );
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
    checklist,
    checklistAdd,
    checklistUpdate,
    checklistRemove,
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

  const titleText =
    sheetMode === 'editAll'
      ? '일정 수정'
      : sheetMode === 'editOccurrence'
        ? '이 회차만 수정'
        : '새 일정';
  const saveLabel = sheetMode === 'create' ? '추가' : '저장';

  const showError = (key: keyof EditFormState): string | undefined =>
    submitted ? validation.errors[key] : undefined;

  const open = sheetMode !== null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={closeEditSheet}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={closeEditSheet} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheet}
      >
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
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
              <TextInput
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
              <TextInput
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
              <NativeField
                displayText={formatKoDateFull(form.validFrom)}
                onPress={() =>
                  setPicker({
                    field: 'validFrom',
                    mode: 'date',
                    value: isoToDate(form.validFrom),
                  })
                }
                ariaLabel="시작 날짜"
              />
            </Row>
            <Row label="시간">
              <NativeField
                displayText={fmtKoTime(form.startMinutes)}
                onPress={() =>
                  setPicker({
                    field: 'startMinutes',
                    mode: 'time',
                    value: minutesToDate(form.startMinutes),
                  })
                }
                ariaLabel="시작 시간"
              />
              <Text style={styles.timeDash}>–</Text>
              <NativeField
                displayText={fmtKoTime(form.endMinutes)}
                onPress={() =>
                  setPicker({
                    field: 'endMinutes',
                    mode: 'time',
                    value: minutesToDate(form.endMinutes),
                  })
                }
                ariaLabel="끝 시간"
              />
            </Row>
{/* 종료일 row dropped — schedules are open-ended by default; users
                rely on per-occurrence cancellations or 전체 삭제 instead. */}
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
              <FieldError text={showError('validFrom')} />
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
              <TextInput
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

          {/* Group 6: 준비물 — checklist items attached to the schedule.
              Hidden in editOccurrence mode because checklists are template-
              level, not per-occurrence (ADR-002). */}
          {sheetMode !== 'editOccurrence' ? (
            <Group>
              <Row label="준비물" align="top" hairline={false}>
                <View style={styles.checklistColumn}>
                  {checklist.map((item, idx) => (
                    <View
                      key={item.id ?? `new-${idx}`}
                      style={[
                        styles.checklistRow,
                        idx > 0 ? styles.checklistRowTop : null,
                      ]}
                    >
                      <View style={styles.checklistBullet} />
                      <TextInput
                        value={item.label}
                        onChangeText={(v: string) =>
                          setChecklist((cs) =>
                            cs.map((c, i) =>
                              i === idx ? { ...c, label: v } : c,
                            ),
                          )
                        }
                        placeholder="준비물 이름"
                        placeholderTextColor={TOKENS.ink30}
                        style={styles.checklistInput}
                        maxLength={60}
                        accessibilityLabel={`준비물 ${idx + 1}`}
                      />
                      <Pressable
                        onPress={() =>
                          setChecklist((cs) => cs.filter((_, i) => i !== idx))
                        }
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="준비물 삭제"
                        style={styles.checklistRemoveBtn}
                      >
                        <IconXMark size={14} color={TOKENS.inkSub} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={() =>
                      setChecklist((cs) => [...cs, { id: null, label: '' }])
                    }
                    accessibilityRole="button"
                    accessibilityLabel="준비물 추가"
                    style={[
                      styles.checklistAddBtn,
                      checklist.length > 0 ? styles.checklistAddBtnSpaced : null,
                    ]}
                  >
                    <IconPlus size={12} color={TOKENS.inkSub} />
                    <Text style={styles.checklistAddLabel}>추가</Text>
                  </Pressable>
                </View>
              </Row>
            </Group>
          ) : null}

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
      </KeyboardAvoidingView>
      <PickerOverlay
        state={picker}
        onClose={() => setPicker(null)}
        onChange={(d) => {
          if (picker === null) return;
          if (picker.field === 'validFrom') {
            setForm({ ...form, validFrom: dateToIso(d) });
          } else if (picker.field === 'validUntil') {
            setForm({ ...form, validUntil: dateToIso(d) });
          } else if (picker.field === 'startMinutes') {
            const m = dateToMinutes(d);
            // Drag start forward → push end so end always > start.
            const minEnd = (m + 30) as Minutes;
            setForm({
              ...form,
              startMinutes: m,
              endMinutes: (form.endMinutes <= m ? minEnd : form.endMinutes),
            });
          } else if (picker.field === 'endMinutes') {
            setForm({ ...form, endMinutes: dateToMinutes(d) });
          }
        }}
      />
    </Modal>
  );
}

// ── Checklist diff helper ──────────────────────────────────────────────────
// Compares the original loaded items against the in-memory edited list and
// fires the matching store mutations: remove deleted ids, update label
// changes, append new (id===null) rows.
async function persistChecklistDiff(
  db: import('expo-sqlite').SQLiteDatabase,
  scheduleId: number,
  original: readonly ChecklistItem[],
  edited: readonly ChecklistDraft[],
  ops: {
    add: (
      db: import('expo-sqlite').SQLiteDatabase,
      input: import('../../db/repositories').NewChecklistItem,
    ) => Promise<ChecklistItem>;
    update: (
      db: import('expo-sqlite').SQLiteDatabase,
      id: number,
      patch: Partial<Omit<ChecklistItem, 'id' | 'scheduleId'>>,
    ) => Promise<void>;
    remove: (
      db: import('expo-sqlite').SQLiteDatabase,
      id: number,
    ) => Promise<void>;
  },
): Promise<void> {
  const editedIds = new Set<number>();
  for (const e of edited) {
    if (e.id !== null) editedIds.add(e.id);
  }
  // Remove items absent from edited list.
  for (const o of original) {
    if (!editedIds.has(o.id)) {
      await ops.remove(db, o.id);
    }
  }
  // Update label changes / insert new rows. Drop blank rows entirely so users
  // can leave a half-typed row and have it discarded on save.
  for (let i = 0; i < edited.length; i++) {
    const e = edited[i];
    if (e === undefined) continue;
    const label = e.label.trim();
    if (label.length === 0) {
      if (e.id !== null) await ops.remove(db, e.id);
      continue;
    }
    if (e.id === null) {
      await ops.add(db, { scheduleId, label, sortOrder: i });
    } else {
      const prev = original.find((o) => o.id === e.id);
      if (prev === undefined) continue;
      if (prev.label !== label || prev.sortOrder !== i) {
        await ops.update(db, e.id, { label, sortOrder: i });
      }
    }
  }
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

function NativeField({
  displayText,
  onPress,
  ariaLabel,
}: {
  displayText: string;
  onPress: () => void;
  ariaLabel: string;
}): React.ReactElement {
  // Bumped tap area: visible padding 6/8 + an extra 12px hitSlop on every
  // edge. Before this the Pressable bounds were the literal text + chev so
  // taps near the text would slip into the surrounding Row whitespace and
  // do nothing. Now the entire field reads as "obvious touch target".
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      hitSlop={12}
      style={({ pressed }) => [
        styles.nativeField,
        pressed ? styles.nativeFieldPressed : null,
      ]}
    >
      <Text style={styles.nativeFieldText}>{displayText}</Text>
      <IconChevronDown size={14} color={TOKENS.inkSub} />
    </Pressable>
  );
}

// Cross-platform picker wrapper. On iOS we render a centred Modal with the
// spinner inline + a "완료" button. On Android the OEM picker is a system
// dialog: mounting <DateTimePicker> auto-opens it, and onChange (set/dismiss)
// closes our state so it unmounts.
function PickerOverlay({
  state,
  onClose,
  onChange,
}: {
  state: PickerState;
  onClose: () => void;
  onChange: (d: Date) => void;
}): React.ReactElement | null {
  if (state === null) return null;

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={state.value}
        mode={state.mode}
        is24Hour={false}
        onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate !== undefined) {
            onChange(selectedDate);
          }
          onClose();
        }}
      />
    );
  }

  // iOS — wrap in our own modal so it feels like a sheet over the form.
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.pickerBackdrop} onPress={onClose} />
      <View style={styles.pickerCard}>
        <DateTimePicker
          value={state.value}
          mode={state.mode}
          display="spinner"
          minuteInterval={5}
          onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
            if (selectedDate !== undefined) onChange(selectedDate);
          }}
          style={styles.pickerSpinner}
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="완료"
          style={styles.pickerDoneBtn}
        >
          <Text style={styles.pickerDoneLabel}>완료</Text>
        </Pressable>
      </View>
    </Modal>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,29,27,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '8%',
    backgroundColor: TOKENS.surfaceWarm,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKENS.ink12,
  },

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

  // --- Native date/time field ------------------------------------------
  nativeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: TOKENS.ink04,
  },
  nativeFieldPressed: { opacity: 0.6 },
  nativeFieldText: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },

  // --- Picker overlay (iOS centred card + Android dialog auto-shows) ----
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,18,16,0.45)',
  },
  pickerCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '30%',
    backgroundColor: TOKENS.surface,
    borderRadius: 14,
    paddingTop: 8,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  pickerSpinner: { width: '100%' },
  pickerDoneBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.ink04,
  },
  pickerDoneLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.primary,
    letterSpacing: -0.3,
  },

  // --- Checklist (준비물) ----------------------------------------------
  checklistColumn: { width: '100%' },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checklistRowTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.ink04,
  },
  checklistBullet: {
    width: 18,
    height: 18,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: TOKENS.ink30,
  },
  checklistInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    padding: 0,
    margin: 0,
  },
  checklistRemoveBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checklistAddBtnSpaced: { paddingTop: 6 },
  checklistAddLabel: {
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
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
