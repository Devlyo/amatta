// 1:1 port of docs/design/amatta-v1/app-event-form.jsx into a
// RN-native Modal-driven sheet. External API preserved:
// driven by useUiStore.editSheetState (create / editAll / editOccurrence)
// and saves through useSchedulesStore.{add,update,applyException}.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
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
  IconRepeat,
  IconXMark,
} from '../icons';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { isoToYyyymmdd } from '../daily/pickup-data';
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
//
// PREP-RECUR (v6/v7, ADR-006b): `occurrenceDate` is the ANCHOR date and
// `recurring` chooses the membership rule for an occurrence whose date is O:
//   occurrenceDate === null  → always visible (legacy/unbounded recurring);
//   recurring === true (매번) → visible iff O >= occurrenceDate (forward);
//   recurring === false(이번만)→ visible iff O === occurrenceDate (that date).
// New items anchor occurrenceDate to boundDateInt (the edit-context date) and
// default recurring=true. The ↻ pill flips `recurring`; the anchor is kept.
interface ChecklistDraft {
  id: number | null;
  label: string;
  occurrenceDate: number | null;
  recurring: boolean;
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
// Day-of-week bit for a date (Mon=bit0 … Sun=bit6, matching DaysOfWeekMask).
// Used when the user saves without picking any 반복 day: the schedule defaults
// to a single occurrence on the chosen 날짜's weekday.
function weekdayMaskFromIso(iso: string): DaysOfWeekMask {
  const js = isoToDate(iso).getDay(); // 0=Sun … 6=Sat
  const bit = (js + 6) % 7; // Sun→6, Mon→0
  return (1 << bit) as DaysOfWeekMask;
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

export interface ScheduleEditContentProps {
  onClose: () => void;
}

export function ScheduleEditContent({
  onClose,
}: ScheduleEditContentProps): React.ReactElement {
  const editSheetState = useUiStore((s) => s.editSheetState);
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

  // The date a checklist row binds to when 반복 is toggled OFF (day-specific).
  // create → the daily/detail date the sheet was opened for (preFill.date);
  // editAll → the currently viewed day (the schedule has no single concrete
  // date). Resolved to a yyyymmdd int once per open.
  const boundDateInt = useMemo<number>(() => {
    const iso =
      editSheetState.preFill?.date ??
      editSheetState.occurrenceDate ??
      useUiStore.getState().currentDate;
    return isoToYyyymmdd(iso);
  }, [editSheetState.preFill?.date, editSheetState.occurrenceDate]);

  const [form, setForm] = useState<EditFormState>(() =>
    defaultFormState(null, null),
  );
  // A안 (ADR-006a): the per-준비물 반복 토글 (↻ pill) is shown ONLY when the
  // schedule is recurring (≥1 weekday selected). One-time schedules render a
  // plain supplies list with no pill (conditional render, not hidden).
  const suppliesRepeatable = form.daysOfWeek !== 0;
  const [submitted, setSubmitted] = useState(false);
  const [picker, setPicker] = useState<PickerState>(null);
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  // Snapshot of the checklist as it was when the sheet opened. Used by save
  // to compute INSERT / UPDATE / DELETE diffs against the in-memory edits.
  const originalChecklistRef = useRef<ChecklistItem[]>([]);
  // Scroll the 메모 field comfortably above the keyboard on focus (the auto
  // keyboard inset only lifts it flush to the keyboard top; this gives a gap).
  const scrollRef = useRef<ScrollView | null>(null);
  const notesYRef = useRef(0);
  const checklistYRef = useRef(0);
  const scrollFieldIntoView = useCallback((y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    });
  }, []);

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
      setChecklist(
        items.map((it) => ({
          id: it.id,
          label: it.label,
          occurrenceDate: it.occurrenceDate,
          recurring: it.recurring,
        })),
      );
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
        // 반복(요일)은 더 이상 저장 필수 조건이 아니다. 자녀·종류·제목·날짜·
        // 시간만 채우면 저장 가능. 요일 미선택 시 handleSave가 날짜의 요일로
        // 단일 일정을 만든다 (안 보이는 일정 방지).
        requireDaysOfWeek: false,
      }),
    [form, sheetMode],
  );

  const handleSave = useCallback(async () => {
    setSubmitted(true);
    if (!validation.ok) return;
    if (sheetMode === null) return;

    const db = await getDb();

    // 반복 미선택(daysOfWeek===0) → 날짜의 요일로 단일 일정 처리. validUntil을
    // validFrom에 묶어 그 날짜 한 번만 노출되게 한다. 요일을 골랐으면 기존대로
    // open-ended(또는 사용자가 지정한 종료일) 주간 반복.
    // 종류는 validation이 non-null을 보장하지만 TS 내로잉용 로컬 가드.
    const formType = form.type;
    if (formType === null) return;

    const noRepeat = form.daysOfWeek === 0;
    // Decision C / ADR-006a+b: a one-time schedule (daysOfWeek===0) has no
    // recurrence, so 반복/이번만 is meaningless. Normalize EVERY draft row to
    // `occurrenceDate=null, recurring=true` (unbounded → visible on the single
    // occurrence) BEFORE the create loop and the diff run — this single
    // transform covers all three persist sites (create loop, diff INSERT, diff
    // UPDATE), so a previously day-specific row can never be left orphaned
    // (member of no occurrence). Recurring schedules pass through unchanged,
    // preserving each row's occurrenceDate anchor + recurring flag exactly.
    const rowsToPersist: ChecklistDraft[] = noRepeat
      ? checklist.map((c) => ({ ...c, occurrenceDate: null, recurring: true }))
      : checklist;
    const effectiveDaysOfWeek = noRepeat
      ? weekdayMaskFromIso(form.validFrom)
      : form.daysOfWeek;
    // There is no end-date (validUntil) UI: validUntil only exists to clamp a
    // no-repeat schedule to its single day. So repeat selected => open-ended
    // (null). This also FIXES editing a single-day schedule to add repeat — the
    // stale validUntil=validFrom must be cleared or occurrences stay clamped to
    // that one day (occurrences.ts skips date > validUntil).
    const effectiveValidUntil: ISODate | null = noRepeat
      ? (form.validFrom as unknown as ISODate)
      : null;

    if (sheetMode === 'create') {
      if (form.childId === null) return;
      const created = await addSchedule(db, {
        childId: form.childId,
        title: form.title.trim(),
        type: formType,
        location: form.location.trim().length > 0 ? form.location.trim() : null,
        notes: form.notes.trim().length > 0 ? form.notes.trim() : null,
        daysOfWeek: effectiveDaysOfWeek,
        startMinutes: form.startMinutes,
        endMinutes: form.endMinutes,
        validFrom: form.validFrom as unknown as ISODate,
        validUntil: effectiveValidUntil,
        notifyMinutesBefore: form.notifyMinutesBefore,
        needsPickup: form.needsPickup,
      });
      // Persist the drafted checklist rows — empty/whitespace rows skipped.
      // Each row carries its own occurrenceDate (null = recurring / 반복 ON,
      // yyyymmdd int = day-specific / 반복 OFF) per the v6 entry-point rule.
      // rowsToPersist is the normalized list (Decision C): one-time schedules
      // have already had every occurrenceDate nulled.
      const rows = rowsToPersist.filter((c) => c.label.trim().length > 0);
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row === undefined) continue;
        await checklistAdd(db, {
          scheduleId: created.id,
          label: row.label.trim(),
          sortOrder: i,
          occurrenceDate: row.occurrenceDate,
          recurring: row.recurring,
        });
      }
    } else if (sheetMode === 'editAll' && existingSchedule !== undefined) {
      await updateSchedule(db, existingSchedule.id, {
        title: form.title.trim(),
        type: formType,
        location: form.location.trim().length > 0 ? form.location.trim() : null,
        notes: form.notes.trim().length > 0 ? form.notes.trim() : null,
        daysOfWeek: effectiveDaysOfWeek,
        startMinutes: form.startMinutes,
        endMinutes: form.endMinutes,
        validFrom: form.validFrom as unknown as ISODate,
        validUntil: effectiveValidUntil,
        notifyMinutesBefore: form.notifyMinutesBefore,
        needsPickup: form.needsPickup,
      });
      await persistChecklistDiff(
        db,
        existingSchedule.id,
        originalChecklistRef.current,
        // Decision C: feed the normalized list so an EXISTING day-specific row
        // on a now-one-time schedule is diffed as changed → UPDATE writes NULL
        // (not the stale int).
        rowsToPersist,
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
    onClose();
  }, [
    validation.ok,
    sheetMode,
    form,
    existingSchedule,
    editSheetState.occurrenceDate,
    addSchedule,
    updateSchedule,
    applyException,
    onClose,
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
          onClose();
        },
      },
    ]);
  }, [existingSchedule, removeSchedule, onClose]);

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
          onClose();
        },
      },
    ]);
  }, [
    existingSchedule,
    editSheetState.occurrenceDate,
    applyException,
    onClose,
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

  return (
    <View style={styles.contentRoot}>
        {/* Top bar — 취소 · Title · 추가/저장 */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="취소"
            onPress={onClose}
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
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          // iOS-native keyboard inset: auto-scrolls the focused input above the
          // keyboard (gorhom's own keyboard handling wasn't lifting bottom
          // fields on new arch). The sheet stays put (keyboardBehavior extend).
          automaticallyAdjustKeyboardInsets
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
              <FieldError text={showError('type')} />
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
                  return (
                    <Pill
                      key={opt}
                      active={selected}
                      onPress={() =>
                        setForm({ ...form, notifyMinutesBefore: opt })
                      }
                      label={`${opt}분 전`}
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
          <View
            onLayout={(e) => {
              notesYRef.current = e.nativeEvent.layout.y;
            }}
          >
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
                  // Lift the field toward the top of the visible area so it
                  // sits well above the keyboard (gap the auto-inset lacks).
                  onFocus={() => scrollFieldIntoView(notesYRef.current)}
                />
              </Row>
            </Group>
          </View>

          {/* Group 6: 준비물 — checklist items attached to the schedule.
              Hidden in editOccurrence mode because checklists are template-
              level, not per-occurrence (ADR-002). */}
          {sheetMode !== 'editOccurrence' ? (
            <View
              onLayout={(e) => {
                checklistYRef.current = e.nativeEvent.layout.y;
              }}
            >
            <Group>
              <Row label="준비물" align="top" hairline={false}>
                <View style={styles.checklistColumn}>
                  {checklist.map((item, idx) => (
                    <View
                      key={item.id ?? `new-${idx}`}
                      style={idx > 0 ? styles.checklistRowTop : null}
                    >
                      <View style={styles.checklistRow}>
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
                          onFocus={() => scrollFieldIntoView(checklistYRef.current)}
                        />
                        {/* 반복 ↻ pill (A안 / ADR-006a+b): rendered ONLY for a
                            recurring schedule. ON (recurring=true) = 매번 (from
                            the anchor date forward); OFF (recurring=false) =
                            이번만 (the anchor date only). Tapping flips
                            `recurring`; the occurrenceDate anchor is kept. */}
                        {suppliesRepeatable ? (
                          <RepeatPill
                            on={item.recurring}
                            onToggle={() =>
                              setChecklist((cs) =>
                                cs.map((c, i) =>
                                  i === idx
                                    ? {
                                        ...c,
                                        recurring: !c.recurring,
                                        // Re-anchor a legacy NULL-anchor row when
                                        // switching to 이번만 — otherwise the
                                        // membership NULL short-circuit (always
                                        // visible) would ignore recurring=false.
                                        occurrenceDate:
                                          c.recurring &&
                                          c.occurrenceDate === null
                                            ? boundDateInt
                                            : c.occurrenceDate,
                                      }
                                    : c,
                                ),
                              )
                            }
                          />
                        ) : null}
                        <Pressable
                          onPress={() =>
                            setChecklist((cs) => cs.filter((_, i) => i !== idx))
                          }
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="준비물 삭제"
                          style={styles.checklistRemoveBtn}
                        >
                          <IconXMark size={16} color={TOKENS.inkSub} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  <Pressable
                    onPress={() =>
                      setChecklist((cs) => [
                        ...cs,
                        // ADR-006b: new items anchor occurrenceDate to
                        // boundDateInt (the edit-context date) and default
                        // recurring=true (매번 from the anchor forward). Flipping
                        // the ↻ pill OFF makes it 이번만 (anchor date only). For
                        // a one-time schedule the pill is hidden and save
                        // normalizes the row to occurrenceDate=null/recurring.
                        {
                          id: null,
                          label: '',
                          occurrenceDate: boundDateInt,
                          recurring: true,
                        },
                      ])
                    }
                    accessibilityRole="button"
                    accessibilityLabel="준비물 추가"
                    style={[
                      styles.checklistAddBtn,
                      checklist.length > 0 ? styles.checklistAddBtnSpaced : null,
                    ]}
                  >
                    <IconPlus size={14} color={TOKENS.inkSub} />
                    <Text style={styles.checklistAddLabel}>추가</Text>
                  </Pressable>
                </View>
              </Row>
            </Group>
            </View>
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
    </View>
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
      await ops.add(db, {
        scheduleId,
        label,
        sortOrder: i,
        occurrenceDate: e.occurrenceDate,
        recurring: e.recurring,
      });
    } else {
      const prev = original.find((o) => o.id === e.id);
      if (prev === undefined) continue;
      if (
        prev.label !== label ||
        prev.sortOrder !== i ||
        prev.occurrenceDate !== e.occurrenceDate ||
        prev.recurring !== e.recurring
      ) {
        await ops.update(db, e.id, {
          label,
          sortOrder: i,
          occurrenceDate: e.occurrenceDate,
          recurring: e.recurring,
        });
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

// ↻ 반복 pill (A안 / ADR-006a). ON = 매번 (tint bg + primaryDeep icon+label);
// OFF = 이번만 (transparent bg, ink30 icon-only). Tap flips. Rendered only for
// recurring schedules (caller-gated by suppliesRepeatable).
function RepeatPill({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={
        on ? '매번 챙김 (탭하면 이번만)' : '이번만 (탭하면 매번)'
      }
      style={[
        styles.checklistRepeatPill,
        on ? styles.checklistRepeatPillOn : styles.checklistRepeatPillOff,
      ]}
    >
      <IconRepeat size={13} color={on ? TOKENS.primaryDeep : TOKENS.ink30} />
      {on ? <Text style={styles.checklistRepeatPillLabel}>매번</Text> : null}
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
          /* textColor + themeVariant force visible dark glyphs on our
           * light card regardless of the device's dark-mode setting.
           * Without these, iOS picks the system style and the wheel
           * digits can render near-white-on-white when the user is
           * in dark mode. */
          textColor={TOKENS.ink}
          themeVariant="light"
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
  // De-chromed: the gorhom route sheet owns scrim/shape/grabber.
  contentRoot: { flex: 1, backgroundColor: TOKENS.surfaceWarm },

  headerBar: {
    flexDirection: 'row',
    // baseline so the larger 새 일정/일정 수정 title sits on the same text
    // baseline as the 취소 / 추가 actions instead of floating above them.
    alignItems: 'baseline',
    paddingHorizontal: 14,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  headerSlotStart: { flex: 1, alignItems: 'flex-start' },
  headerSlotEnd: { flex: 1, alignItems: 'flex-end' },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.4,
  },
  cancelLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  saveLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.primary,
    letterSpacing: -0.3,
  },
  saveLabelDisabled: { color: TOKENS.ink30 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: SPACING.sm, paddingBottom: SPACING.sm },

  // --- Group / Row -----------------------------------------------------
  group: {
    backgroundColor: TOKENS.surface,
    borderRadius: 14,
    marginHorizontal: 14,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
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
    fontSize: 14,
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
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    padding: 0,
    margin: 0,
    lineHeight: 20,
  },
  notesInput: { minHeight: 24, textAlignVertical: 'top' },

  // --- Native date/time field ------------------------------------------
  nativeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    backgroundColor: TOKENS.ink04,
  },
  nativeFieldPressed: { opacity: 0.6 },
  nativeFieldText: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardMedium,
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
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    overflow: 'hidden',
  },
  // Spinner needs an explicit height — without it, the iOS wheel can
  // collapse to 0pt and the digits become invisible. 216 matches the
  // native UIPickerView default row count × row height.
  pickerSpinner: { width: '100%', height: 216, backgroundColor: TOKENS.surface },
  pickerDoneBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.ink04,
  },
  pickerDoneLabel: {
    fontSize: 16,
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
    paddingVertical: SPACING.sm,
  },
  checklistRowTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.ink04,
  },
  // ↻ 반복 pill (A안). radius 99; transition feel (.14s) is implicit in RN
  // Pressable state swaps. Tokens only — no color/shadow literals.
  checklistRepeatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  // ON (매번): tint bg, padding 4/9/4/7 (top/right/bottom/left).
  checklistRepeatPillOn: {
    backgroundColor: TOKENS.primaryTint,
    paddingTop: 4,
    paddingRight: 9,
    paddingBottom: 4,
    paddingLeft: 7,
  },
  // OFF (이번만): transparent bg, icon-only, padding 4/5.
  checklistRepeatPillOff: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  checklistRepeatPillLabel: {
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.primaryDeep,
    letterSpacing: -0.2,
  },
  checklistBullet: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: TOKENS.ink30,
  },
  checklistInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    padding: 0,
    margin: 0,
  },
  checklistRemoveBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: TOKENS.ink12,
  },
  checklistAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  checklistAddBtnSpaced: { paddingTop: 6 },
  checklistAddLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },

  // --- Pills -----------------------------------------------------------
  pillRowGrow: { flexDirection: 'row', gap: 6, width: '100%' },
  pillWrapRow: { flexDirection: 'row', gap: 6, width: '100%' },
  pill: {
    flex: 1, // toggle pills share the row evenly (4 종류 / 3 알림 fill the width)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: TOKENS.controlIdle,
    borderRadius: RADIUS.full,
  },
  pillActive: { backgroundColor: TOKENS.controlActive },
  pillLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  pillLabelActive: { color: TOKENS.surface },

  // --- Kid pill row ----------------------------------------------------
  kidPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.xs,
    paddingRight: SPACING.sm,
    backgroundColor: TOKENS.controlIdle,
    borderRadius: RADIUS.full,
  },
  kidPillActive: { backgroundColor: TOKENS.controlActive },
  kidPillLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  kidPillLabelActive: { color: TOKENS.surface },

  // --- Day circles -----------------------------------------------------
  dayCircleRow: { flexDirection: 'row', gap: 6 },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.controlIdle,
  },
  dayCircleActive: { backgroundColor: TOKENS.controlActive },
  dayCircleLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  dayCircleLabelActive: { color: TOKENS.surface },

  timeDash: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink30,
  },

  // --- Switch ----------------------------------------------------------
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.switchOff,
    padding: SPACING.xxs,
  },
  switchTrackOn: { backgroundColor: TOKENS.controlActive },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.surface,
  },
  switchKnobOff: { alignSelf: 'flex-start' },
  switchKnobOn: { alignSelf: 'flex-end' },

  // --- Pickup badge ----------------------------------------------------
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: SPACING.xxs,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.primary,
  },
  pickupText: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },

  // --- Errors ----------------------------------------------------------
  fieldError: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.danger,
    marginTop: SPACING.xs,
    width: '100%',
  },

  // --- Destructive actions --------------------------------------------
  actionGroup: {
    backgroundColor: TOKENS.surface,
    borderRadius: 14,
    marginHorizontal: 14,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  actionRow: {
    paddingVertical: 13,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  actionRowHairline: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.ink04,
  },
  actionLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  actionLabelDanger: { color: TOKENS.danger },

  // Bottom breathing room. Keyboard avoidance is handled by the scroll's
  // automaticallyAdjustKeyboardInsets (iOS), not by a giant spacer.
  tail: { height: 40 },
});
