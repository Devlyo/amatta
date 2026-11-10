// New / edit event form — iPhone Calendar style (ADR-007 §7, design board
// "6 새 일정 추가"). Grouped rows on the system background; value rows expand
// inline panels (kid, type, date/time pickers, repeat days, alerts).
// External API unchanged: driven by useUiStore.editSheetState (create /
// editAll / editOccurrence), saves through useSchedulesStore.{add,update,
// applyException} and the checklist store (diff below).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { useChildrenStore } from '../../state/children-store';
import { useChecklistStore } from '../../state/checklist-store';
import { useSchedulesStore } from '../../state/schedules-store';
import { useUiStore } from '../../state/ui-store';
import { useGuardianStore , visibleCalendarIds } from '../../state/guardian-store';
import {
  createGuardianEvent,
  deleteGuardianEvent,
  getGuardianEvent,
  resolveWriteCalendar,
  updateGuardianEvent,
 fetchEvents } from '../../calendar/guardian-calendar';
import { getDb } from '../../db/client';
import { isChecklistItemVisibleOn } from '../../domain/checklist-membership';
import { guardianOccurrences } from '../../domain/guardian';
import { expandOccurrences } from '../../domain/occurrences';
import { guardianClashes, pickupClashes } from '../../domain/pickup-conflict';
import { fmtRange } from '../utils/date';
import type {
  ChecklistItem,
  DaysOfWeekMask,
  ISODate,
  Minutes,
  Schedule,
  ScheduleException,
} from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { TypeIcon } from '../common/TypeIcon';
import { DayCircle } from '../components/DayCircle';
import { IconXMark } from '../icons';
import { getKidPalette, TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { isoToYyyymmdd } from '../daily/pickup-data';
import {
  NOTIFY_OPTIONS,
  TYPE_LABELS_KO,
  TYPE_OPTIONS,
  VISUAL_TO_MASK_BIT,
  alertSummary,
  fmt12hrShortSpaced,
  formatKoDateChip,
  defaultFormState,
  formFromOccurrence,
  formFromSchedule,
  repeatSummary,
  toggleDayMask,
  validate,
  type EditFormState,
} from './edit-sheet-form';
import {
  FormTextRow,
  FormActionRow,
  FormChipsRow,
  FormError,
  FormGroup,
  FormInputRow,
  FormOptionList,
  FormSectionHeader,
  FormToggleRow,
  FormValueRow,
  TimeChip,
} from './form-rows';

// Sunday-first labels ('일 월 화 수 목 금 토'); VISUAL_TO_MASK_BIT maps a visual
// index to the DaysOfWeekMask bit (Monday = bit 0).
const DOW_LABELS_SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 없음 + the settings-aligned lead times, for both alert rows. */
const ALERT_OPTIONS: readonly { key: number | null; label: string }[] = [
  { key: null, label: '없음' },
  ...NOTIFY_OPTIONS.map((m) => ({ key: m, label: alertSummary(m) })),
];

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

/** Which row's inline panel is open (one at a time, iPhone-style). */
type Expand = null | 'kid' | 'type' | 'date' | 'start' | 'end' | 'repeat' | 'alertStart' | 'alertEnd';

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

/** 보호자 in the 자녀 options (ADR-008) — saved to the device calendar instead. */
const GUARDIAN_OPTION = -1;

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
  const sheetMode: 'create' | 'editAll' | 'editOccurrence' | 'editGuardian' | null =
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
  // 보호자 picked in the 자녀 row (create only): only the fields a calendar
  // event has are shown, and save writes to the device calendar (ADR-008).
  const [forGuardian, setForGuardian] = useState(false);
  const [expanded, setExpanded] = useState<Expand>(null);
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  // 이 회차만 수정: the 매번 / always items visible on that day are shown but
  // belong to the whole schedule, so they're read-only here; only this day's
  // 이번만 items are edited (ADR-006b membership).
  const [fixedChecklist, setFixedChecklist] = useState<ChecklistItem[]>([]);
  // Snapshot of the checklist as it was when the sheet opened. Used by save
  // to compute INSERT / UPDATE / DELETE diffs against the in-memory edits.
  const originalChecklistRef = useRef<ChecklistItem[]>([]);
  // The ScrollView's automaticallyAdjustKeyboardInsets keeps focused inputs
  // above the keyboard (ADR-004).
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (sheetMode === null) return;
    if (sheetMode === 'create') {
      setForm(
        defaultFormState(
          editSheetState.preFill?.childId ?? null,
          editSheetState.preFill?.date ?? null,
          editSheetState.preFill?.startMinutes,
        ),
      );
      originalChecklistRef.current = [];
      setChecklist([]);
      setForGuardian(editSheetState.preFill?.guardian === true);
    } else if (sheetMode === 'editAll' && existingSchedule !== undefined) {
      setForGuardian(false);
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
      setForGuardian(false);
      setForm(formFromOccurrence(existingSchedule, existingException));
      const dayInt = isoToYyyymmdd(editSheetState.occurrenceDate ?? existingSchedule.validFrom);
      const visible = (checklistItemsByScheduleId.get(existingSchedule.id) ?? []).filter((it) =>
        isChecklistItemVisibleOn(it, dayInt),
      );
      const onlyThisDay = visible.filter((it) => !it.recurring && it.occurrenceDate === dayInt);
      originalChecklistRef.current = onlyThisDay;
      setChecklist(
        onlyThisDay.map((it) => ({ id: it.id, label: it.label, occurrenceDate: it.occurrenceDate, recurring: false })),
      );
      setFixedChecklist(visible.filter((it) => !onlyThisDay.includes(it)));
    }
    if (sheetMode !== 'editOccurrence') setFixedChecklist([]);
    if (sheetMode === 'editGuardian' && editSheetState.guardianEventId !== undefined) {
      // A 보호자 event lives in the device calendar — read it into the form.
      setForGuardian(true);
      originalChecklistRef.current = [];
      setChecklist([]);
      // Only non-recurring events are edited in the app (see guardian-calendar).
      void getGuardianEvent(editSheetState.guardianEventId)
        .then((e) => {
          const d = e.startDate;
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as unknown as ISODate;
          const start = d.getHours() * 60 + d.getMinutes();
          const endsNextMidnight = e.endDate.getDate() !== d.getDate();
          const end = endsNextMidnight ? 24 * 60 : e.endDate.getHours() * 60 + e.endDate.getMinutes();
          setForm({
            ...defaultFormState(null, iso, start),
            title: e.title,
            location: e.location,
            notes: e.notes,
            allDay: e.allDay,
            startMinutes: (e.allDay ? 0 : start) as Minutes,
            endMinutes: (e.allDay ? 24 * 60 : end) as Minutes,
            notifyMinutesBefore: e.alarmMinutesBefore,
          });
        })
        .catch(() => onClose());
    }
    setSubmitted(false);
    setExpanded(null);
  }, [
    sheetMode,
    existingSchedule,
    existingException,
    editSheetState.preFill,
    editSheetState.occurrenceDate,
    editSheetState.guardianEventId,
    editSheetState.guardianInstance,
    checklistItemsByScheduleId,
    onClose,
  ]);

  const validation = useMemo(
    () =>
      // A guardian event has no kid / 종류 — validate the rest.
      validate(forGuardian ? { ...form, childId: 0, type: 'other' } : form, {
        requireChildId: sheetMode === 'create',
        // 반복(요일)은 더 이상 저장 필수 조건이 아니다. 자녀·종류·제목·날짜·
        // 시간만 채우면 저장 가능. 요일 미선택 시 handleSave가 날짜의 요일로
        // 단일 일정을 만든다 (안 보이는 일정 방지).
        requireDaysOfWeek: false,
      }),
    [form, sheetMode, forGuardian],
  );

  // 보호자 → write to the device calendar (asks for access the first time).
  const saveGuardian = useCallback(async (): Promise<boolean> => {
    const db = await getDb();
    const store = useGuardianStore.getState();
    if (!(store.enabled && store.permission === 'granted')) {
      const ok = await store.setEnabled(db, true);
      if (!ok && useGuardianStore.getState().permission === 'unavailable') {
        Alert.alert('업데이트가 필요해요', '지금 설치된 앱에는 캘린더 연동 기능이 없어요. 앱을 최신 버전으로 업데이트해 주세요.');
        return false;
      }
      if (!ok) {
        Alert.alert('캘린더 접근이 필요해요', '보호자 일정은 아이폰 캘린더에 저장돼요. 설정에서 캘린더 접근을 허용해 주세요.', [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => void Linking.openSettings() },
        ]);
        return false;
      }
    }
    const fields = {
      title: form.title.trim(),
      location: form.location.trim().length > 0 ? form.location.trim() : null,
      notes: form.notes.trim().length > 0 ? form.notes.trim() : null,
      date: form.validFrom as unknown as ISODate,
      startMinutes: form.startMinutes,
      endMinutes: form.endMinutes,
      allDay: form.allDay,
      alarmMinutesBefore: form.notifyMinutesBefore,
    };
    if (sheetMode === 'editGuardian' && editSheetState.guardianEventId !== undefined) {
      try {
        await updateGuardianEvent(editSheetState.guardianEventId, fields);
      } catch {
        Alert.alert('저장하지 못했어요', '아이폰 캘린더의 일정을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
        return false;
      }
      useGuardianStore.getState().invalidate();
      return true;
    }
    const calendarId = await resolveWriteCalendar(useGuardianStore.getState().writeCalendarId);
    if (calendarId === null) {
      Alert.alert('저장할 캘린더가 없어요', '아이폰 캘린더에 쓸 수 있는 캘린더를 만든 뒤 다시 시도해 주세요.');
      return false;
    }
    try {
      await createGuardianEvent(calendarId, fields);
    } catch {
      Alert.alert('저장하지 못했어요', '아이폰 캘린더에 일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
    useGuardianStore.getState().invalidate();
    return true;
  }, [form, sheetMode, editSheetState.guardianEventId]);

  // Pickup ↔ guardian clash on that day → ask before saving (screen only,
  // never a push — ADR-007 owner decision).
  const confirmPickupClash = useCallback(async (): Promise<boolean> => {
    const date = (editSheetState.occurrenceDate ?? form.validFrom) as unknown as ISODate;
    if ((date as unknown as string).length === 0) return true;
    let message: string | null = null;
    if (forGuardian) {
      if (form.allDay) return true;
      const byId = new Map(children.map((c) => [c.id, c]));
      const kidsThatDay = expandOccurrences(schedules, exceptions, { from: date, to: date }, byId);
      const hit = pickupClashes({ startMinutes: form.startMinutes, endMinutes: form.endMinutes }, kidsThatDay)[0];
      if (hit !== undefined) {
        const kid = byId.get(hit.childId);
        message = `${kid?.name ?? ''} ${hit.title} 픽업(${fmt12hrShortSpaced(hit.endMinutes)}) 시간과 겹쳐요.`;
      }
    } else if (form.needsPickup && !form.allDay) {
      const g = useGuardianStore.getState();
      if (!(g.enabled && g.permission === 'granted')) return true;
      try {
        const raw = await fetchEvents(visibleCalendarIds(g.calendars, g.calendarIds), date, date);
        const hit = guardianClashes(form.endMinutes, guardianOccurrences(raw, date, date))[0];
        if (hit !== undefined) {
          // Same wording as the home pickup card line (design board "0 홈").
          message = `픽업 시간(${fmt12hrShortSpaced(form.endMinutes)})이 보호자 일정 "${hit.title}"(${fmtRange(hit.startMinutes, hit.endMinutes)})와 겹쳐요.`;
        }
      } catch {
        return true; // can't read the calendar — don't block saving
      }
    }
    if (message === null) return true;
    return new Promise<boolean>((resolve) => {
      Alert.alert('픽업 시간과 겹쳐요', `${message} 그래도 저장할까요?`, [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: '저장', onPress: () => resolve(true) },
      ]);
    });
  }, [editSheetState.occurrenceDate, form, forGuardian, children, schedules, exceptions]);

  const handleSave = useCallback(async () => {
    setSubmitted(true);
    if (!validation.ok) return;
    if (sheetMode === null) return;
    if (!(await confirmPickupClash())) return;

    if (forGuardian && (sheetMode === 'create' || sheetMode === 'editGuardian')) {
      if (await saveGuardian()) {
        Keyboard.dismiss();
        onClose();
      }
      return;
    }

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
        needsPickup: form.needsPickup && !form.allDay,
        allDay: form.allDay,
        notifyEndMinutesBefore: form.allDay ? null : form.notifyEndMinutesBefore,
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
        needsPickup: form.needsPickup && !form.allDay,
        allDay: form.allDay,
        notifyEndMinutesBefore: form.allDay ? null : form.notifyEndMinutesBefore,
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
          // All-day events have no times to override (ADR-007 §8).
          overrideStartMinutes:
            !existingSchedule.allDay && form.startMinutes !== existingSchedule.startMinutes
              ? form.startMinutes
              : null,
          overrideEndMinutes:
            !existingSchedule.allDay && form.endMinutes !== existingSchedule.endMinutes
              ? form.endMinutes
              : null,
          overrideTitle:
            form.title.trim() !== existingSchedule.title
              ? form.title.trim()
              : null,
        },
      );
      // This day's 이번만 supplies (anchored to the day, never 매번 here).
      await persistChecklistDiff(
        db,
        existingSchedule.id,
        originalChecklistRef.current,
        checklist.map((c) => ({ ...c, occurrenceDate: boundDateInt, recurring: false })),
        { add: checklistAdd, update: checklistUpdate, remove: checklistRemove },
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
    forGuardian,
    saveGuardian,
    boundDateInt,
    confirmPickupClash,
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

  const handleDeleteGuardian = (): void => {
    const id = editSheetState.guardianEventId;
    if (id === undefined) return;
    Alert.alert(
      '일정 삭제',
      '아이폰 캘린더에서 삭제합니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void deleteGuardianEvent(id)
              .then(() => {
                useGuardianStore.getState().invalidate();
                onClose();
              })
              .catch(() => Alert.alert('삭제하지 못했어요', '잠시 후 다시 시도해 주세요.'));
          },
        },
      ],
    );
  };

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
    sheetMode === 'editAll' || sheetMode === 'editGuardian'
      ? '일정 수정'
      : sheetMode === 'editOccurrence'
        ? '이 회차만 수정'
        : '새 일정';
  const saveLabel = sheetMode === 'create' ? '추가' : '저장';

  const isOccurrence = sheetMode === 'editOccurrence';
  const showError = (key: keyof EditFormState): string | undefined =>
    submitted ? validation.errors[key] : undefined;

  const toggle = (key: Exclude<Expand, null>): void => {
    Keyboard.dismiss();
    setExpanded((cur) => (cur === key ? null : key));
  };
  const selectedKid = children.find((k) => k.id === form.childId);
  const kidPalette = selectedKid !== undefined ? getKidPalette(selectedKid.colorIndex) : null;

  return (
    <View style={styles.contentRoot}>
      {/* Nav bar — 취소 · 제목 · 추가/저장 (iPhone Calendar) */}
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
          <Text style={[styles.saveLabel, !validation.ok ? styles.saveLabelDisabled : null]}>
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
        // keyboard (ADR-004). The modal itself stays put.
        automaticallyAdjustKeyboardInsets
      >
        {/* 제목 · 장소 */}
        <View style={styles.block}>
          <FormGroup>
            <FormInputRow
              value={form.title}
              onChangeText={(v: string) => setForm({ ...form, title: v })}
              placeholder="제목"
              maxLength={60}
              testID="sheet-title-input"
              accessibilityLabel="제목 입력"
              onFocus={() => setExpanded(null)}
            />
            {isOccurrence ? (
              <FormTextRow text={form.location} placeholder="장소 없음" last />
            ) : (
              <FormInputRow
                last
                value={form.location}
                onChangeText={(v: string) => setForm({ ...form, location: v })}
                placeholder="장소"
                maxLength={60}
                accessibilityLabel="위치 입력"
                onFocus={() => setExpanded(null)}
              />
            )}
          </FormGroup>
          <FormError text={showError('title')} />
        </View>

        {/* 자녀 · 종류 */}
        <View style={styles.block}>
          <FormGroup>
            <FormValueRow
              label="자녀"
              value={forGuardian ? '보호자' : (selectedKid?.name ?? '선택')}
              leading={
                forGuardian ? (
                  <View style={[styles.kidDot, { backgroundColor: TOKENS.guardian, borderColor: TOKENS.guardianDeep }]} />
                ) : kidPalette !== null ? (
                  <View style={[styles.kidDot, { backgroundColor: kidPalette.source, borderColor: kidPalette.deep }]} />
                ) : null
              }
              onPress={sheetMode === 'create' ? () => toggle('kid') : undefined}
              expanded={expanded === 'kid'}
              last={forGuardian && expanded !== 'kid'}
              testID="row-kid"
            >
              <FormOptionList<number | null>
                options={[
                  ...children.map((k) => ({ key: k.id, label: k.name })),
                  // 보호자 → the device calendar (ADR-008), new events only.
                  ...(sheetMode === 'create' ? [{ key: GUARDIAN_OPTION, label: '보호자' }] : []),
                ]}
                selected={forGuardian ? GUARDIAN_OPTION : form.childId}
                labelPrefix="자녀: "
                onSelect={(id) => {
                  if (id === GUARDIAN_OPTION) {
                    setForGuardian(true);
                  } else {
                    setForGuardian(false);
                    setForm({ ...form, childId: id });
                  }
                  setExpanded(null);
                }}
                render={(id) => {
                  if (id === GUARDIAN_OPTION) return <View style={styles.guardianAvatar} />;
                  const kid = children.find((k) => k.id === id);
                  return kid !== undefined ? <KidAvatar child={kid} size={26} /> : null;
                }}
              />
            </FormValueRow>
            {forGuardian ? null : (
            <FormValueRow
              label="종류"
              value={form.type !== null ? TYPE_LABELS_KO[form.type] : '선택'}
              onPress={isOccurrence ? undefined : () => toggle('type')}
              expanded={expanded === 'type'}
              last
              testID="row-type"
            >
              <FormOptionList
                options={TYPE_OPTIONS.map((t) => ({ key: t, label: TYPE_LABELS_KO[t] }))}
                selected={form.type}
                onSelect={(t) => {
                  setForm({ ...form, type: t });
                  setExpanded(null);
                }}
                render={(t) => (t !== null ? <TypeIcon type={t} size={16} color={TOKENS.inkSub} /> : null)}
              />
            </FormValueRow>
            )}
          </FormGroup>
          {forGuardian ? (
            <Text style={styles.guardianNote}>
              보호자 일정은 아이폰 캘린더에 저장돼요.
            </Text>
          ) : null}
          <FormError text={showError('childId') ?? showError('type')} />
        </View>

        {/* 하루 종일 · 시작 · 종료 · 반복 */}
        <View style={styles.block}>
          <FormGroup>
            {sheetMode !== 'editOccurrence' ? (
              <FormToggleRow
                label="하루 종일"
                value={form.allDay}
                onChange={(v) => {
                  setExpanded(null);
                  setForm({ ...form, allDay: v, needsPickup: v ? false : form.needsPickup });
                }}
                onColor={TOKENS.primary}
              />
            ) : null}
            <FormChipsRow label="시작" last={form.allDay && forGuardian}>
              <TimeChip
                text={formatKoDateChip(form.validFrom)}
                active={expanded === 'date'}
                onPress={() => toggle('date')}
                disabled={sheetMode === 'editOccurrence'}
                accessibilityLabel="시작 날짜"
              />
              {form.allDay ? null : (
                <TimeChip
                  text={fmt12hrShortSpaced(form.startMinutes)}
                  active={expanded === 'start'}
                  onPress={() => toggle('start')}
                  accessibilityLabel="시작 시간"
                />
              )}
            </FormChipsRow>
            {expanded === 'date' ? (
              <InlinePicker
                mode="date"
                value={isoToDate(form.validFrom)}
                onChange={(d) => setForm({ ...form, validFrom: dateToIso(d) })}
                onDone={() => setExpanded(null)}
              />
            ) : null}
            {expanded === 'start' ? (
              <InlinePicker
                mode="time"
                value={minutesToDate(form.startMinutes)}
                onChange={(d) => {
                  const m = dateToMinutes(d);
                  // Moving the start keeps the duration (iPhone behaviour), capped at midnight.
                  const length = Math.max(form.endMinutes - form.startMinutes, 30);
                  setForm({ ...form, startMinutes: m, endMinutes: Math.min(m + length, 24 * 60) as Minutes });
                }}
                onDone={() => setExpanded(null)}
              />
            ) : null}
            {form.allDay ? null : (
              <FormChipsRow label="종료" last={forGuardian && expanded !== 'end'}>
                <TimeChip
                  text={fmt12hrShortSpaced(form.endMinutes)}
                  active={expanded === 'end'}
                  onPress={() => toggle('end')}
                  accessibilityLabel="끝 시간"
                />
              </FormChipsRow>
            )}
            {expanded === 'end' ? (
              <InlinePicker
                mode="time"
                value={minutesToDate(form.endMinutes)}
                onChange={(d) => {
                  const m = dateToMinutes(d);
                  // 00:00 picked as an end means midnight at the end of the day.
                  setForm({ ...form, endMinutes: (m === 0 ? 24 * 60 : m) as Minutes });
                }}
                onDone={() => setExpanded(null)}
              />
            ) : null}
            {!forGuardian ? (
              <FormValueRow
                label="반복"
                value={repeatSummary(form.daysOfWeek)}
                onPress={isOccurrence ? undefined : () => toggle('repeat')}
                expanded={expanded === 'repeat'}
                last
                testID="row-repeat"
              >
                <View style={styles.dayCircleRow}>
                  {DOW_LABELS_SUN_FIRST.map((label, visualIdx) => {
                    const maskBit = VISUAL_TO_MASK_BIT[visualIdx] ?? 0;
                    return (
                      <DayCircle
                        key={label}
                        label={label}
                        size="lg"
                        active={(form.daysOfWeek & (1 << maskBit)) !== 0}
                        onPress={() =>
                          setForm({
                            ...form,
                            daysOfWeek: toggleDayMask(form.daysOfWeek, maskBit) as DaysOfWeekMask,
                          })
                        }
                      />
                    );
                  })}
                </View>
              </FormValueRow>
            ) : null}
          </FormGroup>
          <FormError text={showError('startMinutes') ?? showError('endMinutes') ?? showError('validFrom')} />
        </View>

        {/* 알림 · 픽업 */}
        <FormGroup>
          <FormValueRow
            label="시작 전 알림"
            value={alertSummary(form.notifyMinutesBefore)}
            onPress={isOccurrence ? undefined : () => toggle('alertStart')}
            expanded={expanded === 'alertStart'}
            last={(form.allDay || forGuardian) && expanded !== 'alertStart'}
            testID="row-alert-start"
          >
            <FormOptionList
              options={ALERT_OPTIONS}
              selected={form.notifyMinutesBefore}
              onSelect={(v) => {
                setForm({ ...form, notifyMinutesBefore: v });
                setExpanded(null);
              }}
            />
          </FormValueRow>
          {form.allDay || forGuardian ? null : (
            <FormValueRow
              label="종료 전 알림"
              value={alertSummary(form.notifyEndMinutesBefore)}
              onPress={isOccurrence ? undefined : () => toggle('alertEnd')}
              expanded={expanded === 'alertEnd'}
              testID="row-alert-end"
            >
              <FormOptionList
                options={ALERT_OPTIONS}
                selected={form.notifyEndMinutesBefore}
                onSelect={(v) => {
                  setForm({ ...form, notifyEndMinutesBefore: v });
                  setExpanded(null);
                }}
              />
            </FormValueRow>
          )}
          {form.allDay || forGuardian ? null : isOccurrence ? (
            <FormValueRow label="픽업 필요" value={form.needsPickup ? '예' : '아니요'} last />
          ) : (
            <FormToggleRow
              label="픽업 필요"
              value={form.needsPickup}
              onChange={(v) => setForm({ ...form, needsPickup: v })}
              onColor={TOKENS.primary}
              last
            />
          )}
        </FormGroup>

        {/* 준비물 — one occurrence: that day's items; 매번 ones read-only, this
            day's 이번만 ones editable (ADR-006b). */}
        {!forGuardian ? (
          <View style={styles.block}>
            <FormSectionHeader label="준비물" />
            <FormGroup>
              {fixedChecklist.map((item) => (
                <View key={`fixed-${item.id}`}>
                  <View style={styles.checklistRow}>
                    <Text style={[styles.checklistInput, styles.checklistFixed]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <View style={styles.repeatTag}>
                      <Text style={styles.repeatTagLabel}>매번</Text>
                    </View>
                  </View>
                  <View style={styles.separator} />
                </View>
              ))}
              {checklist.map((item, idx) => (
                <View key={item.id ?? `new-${idx}`}>
                  <View style={styles.checklistRow}>
                    <TextInput
                      value={item.label}
                      onChangeText={(v: string) =>
                        setChecklist((cs) => cs.map((c, i) => (i === idx ? { ...c, label: v } : c)))
                      }
                      placeholder="준비물 이름"
                      placeholderTextColor={TOKENS.ink30}
                      style={styles.checklistInput}
                      maxLength={60}
                      accessibilityLabel={`준비물 ${idx + 1}`}
                      onFocus={() => setExpanded(null)}
                    />
                    {/* 매번/이번만 (ADR-006a → ADR-007 text label): only for a
                        recurring schedule. Tap flips `recurring`; the anchor is
                        kept (a legacy NULL anchor is re-anchored when switching
                        to 이번만, otherwise "always visible" would win). */}
                    {isOccurrence ? (
                      <View style={[styles.repeatTag, styles.repeatTagOnce]}>
                        <Text style={[styles.repeatTagLabel, styles.repeatTagLabelOnce]}>이번만</Text>
                      </View>
                    ) : suppliesRepeatable ? (
                      <Pressable
                        onPress={() =>
                          setChecklist((cs) =>
                            cs.map((c, i) =>
                              i === idx
                                ? {
                                    ...c,
                                    recurring: !c.recurring,
                                    occurrenceDate:
                                      c.recurring && c.occurrenceDate === null ? boundDateInt : c.occurrenceDate,
                                  }
                                : c,
                            ),
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={item.recurring ? '매번 챙김 (탭하면 이번만)' : '이번만 (탭하면 매번)'}
                        hitSlop={6}
                        style={[styles.repeatTag, item.recurring ? null : styles.repeatTagOnce]}
                      >
                        <Text style={[styles.repeatTagLabel, item.recurring ? null : styles.repeatTagLabelOnce]}>
                          {item.recurring ? '매번' : '이번만'}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => setChecklist((cs) => cs.filter((_, i) => i !== idx))}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="준비물 삭제"
                    >
                      <IconXMark size={16} color={TOKENS.inkSub} />
                    </Pressable>
                  </View>
                  <View style={styles.separator} />
                </View>
              ))}
              <FormActionRow
                label="준비물 추가"
                last
                leading={<Ionicons name="add-circle" size={22} color={TOKENS.danger} />}
                onPress={() =>
                  setChecklist((cs) => [
                    ...cs,
                    // ADR-006b: new items anchor to boundDateInt (the edit-context
                    // date) and default to 매번 (recurring) — 이번만 when editing
                    // one occurrence. One-time schedules are normalised to
                    // { null, recurring } on save.
                    { id: null, label: '', occurrenceDate: boundDateInt, recurring: !isOccurrence },
                  ])
                }
              />
            </FormGroup>
          </View>
        ) : null}

        {/* 메모 */}
        {isOccurrence ? (
          <FormGroup>
            <FormTextRow text={form.notes} placeholder="메모 없음" last />
          </FormGroup>
        ) : (
        <FormGroup>
          <TextInput
            value={form.notes}
            onChangeText={(v: string) => setForm({ ...form, notes: v })}
            placeholder="메모"
            placeholderTextColor={TOKENS.ink30}
            style={styles.notesInput}
            multiline
            maxLength={500}
            accessibilityLabel="메모 입력"
            onFocus={() => setExpanded(null)}
          />
        </FormGroup>
        )}
        {isOccurrence ? (
          <Text style={styles.guardianNote}>이 날만 바뀌어요. 제목·시간과 이번만 준비물을 바꿀 수 있어요.</Text>
        ) : null}

        {/* 회차 / 삭제 actions */}
        {sheetMode === 'editAll' && existingSchedule !== undefined ? (
          <FormGroup>
            <FormActionRow label="이 회차만 수정" onPress={handleSwitchToOccurrenceMode} />
            <FormActionRow label="이 회차만 삭제" onPress={handleDeleteOccurrence} tone="danger" />
            <FormActionRow label="전체 삭제" onPress={handleDeleteAll} tone="danger" last />
          </FormGroup>
        ) : null}
        {sheetMode === 'editGuardian' && editSheetState.guardianEventId !== undefined ? (
          <FormGroup>
            <FormActionRow label="일정 삭제" onPress={handleDeleteGuardian} tone="danger" last />
          </FormGroup>
        ) : null}
        {sheetMode === 'editOccurrence' && existingSchedule !== undefined ? (
          <FormGroup>
            <FormActionRow label="이 회차만 삭제" onPress={handleDeleteOccurrence} tone="danger" last />
          </FormGroup>
        ) : null}

        <View style={styles.tail} />
      </ScrollView>
    </View>
  );
}

/**
 * Date / time picker shown inline under its row (iPhone Calendar). iOS:
 * calendar for dates, wheel for times. Android: the system dialog opens on
 * mount and closes the panel when dismissed.
 */
function InlinePicker({
  mode,
  value,
  onChange,
  onDone,
}: {
  mode: 'date' | 'time';
  value: Date;
  onChange: (d: Date) => void;
  onDone: () => void;
}): React.ReactElement {
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        is24Hour={false}
        onChange={(event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === 'set' && selected !== undefined) onChange(selected);
          onDone();
        }}
      />
    );
  }
  return (
    <View style={styles.pickerPanel}>
      <DateTimePicker
        value={value}
        mode={mode}
        display={mode === 'date' ? 'inline' : 'spinner'}
        minuteInterval={5}
        accentColor={TOKENS.danger}
        textColor={TOKENS.ink}
        themeVariant="light"
        locale="ko-KR"
        onChange={(_e: DateTimePickerEvent, selected?: Date) => {
          if (selected !== undefined) onChange(selected);
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


const styles = StyleSheet.create({
  guardianAvatar: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.guardian,
    borderWidth: 1.5,
    borderColor: TOKENS.guardianDeep,
  },
  guardianNote: { ...TYPE.footnote, color: TOKENS.inkSub, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs },
  contentRoot: { flex: 1, backgroundColor: TOKENS.groupedBg },
  headerBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  headerSlotStart: { minWidth: 64, paddingVertical: SPACING.sm },
  headerSlotEnd: { minWidth: 64, paddingVertical: SPACING.sm, alignItems: 'flex-end' },
  headerTitle: { ...TYPE.headline, flex: 1, textAlign: 'center', color: TOKENS.ink },
  cancelLabel: { ...TYPE.row, color: TOKENS.danger },
  saveLabel: { ...TYPE.headline, color: TOKENS.danger },
  saveLabelDisabled: { color: TOKENS.ink30 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, gap: 22 },
  block: { gap: 6 },
  kidDot: { width: 12, height: 12, borderRadius: RADIUS.full, borderWidth: 1.5 },
  dayCircleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingRight: SPACING.lg,
  },
  pickerPanel: { alignItems: 'center', paddingBottom: SPACING.sm },
  checklistRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.md,
  },
  checklistInput: { ...TYPE.row, flex: 1, color: TOKENS.ink, paddingVertical: 11 },
  separator: { marginLeft: SPACING.lg, height: StyleSheet.hairlineWidth, backgroundColor: TOKENS.separator },
  repeatTag: {
    height: 24,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.primaryTint,
    justifyContent: 'center',
  },
  repeatTagOnce: { backgroundColor: TOKENS.ink06 },
  repeatTagLabel: { ...TYPE.footnote, color: TOKENS.primaryDeep },
  checklistFixed: { color: TOKENS.inkSub },
  repeatTagLabelOnce: { color: TOKENS.inkSub },
  notesInput: {
    ...TYPE.row,
    minHeight: 88,
    color: TOKENS.ink,
    paddingHorizontal: SPACING.lg,
    paddingTop: 11,
    paddingBottom: 11,
    textAlignVertical: 'top',
  },
  tail: { height: SPACING.xxxl },
});
