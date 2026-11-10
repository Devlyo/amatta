// Event detail — the same iPhone-style grouped list as the new / edit form
// (ADR-007 §7), read-only, so looking at an event and editing it read alike:
//   제목 · 장소 → 자녀 · 종류 → 시작 · 종료 · 반복 → 알림 · 픽업 → 준비물 → 메모
//   → 이 회차만 수정 · 이 회차만 삭제 · 전체 삭제
// Presented by the native modal route app/event/detail.tsx; the route shell
// owns the ui-store eventDetail open/close. "수정" swaps to the edit form.

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useChecklistStore } from '../../state/checklist-store';
import { useChildrenStore } from '../../state/children-store';
import { useSchedulesStore } from '../../state/schedules-store';
import { useUiStore } from '../../state/ui-store';
import { getDb } from '../../db/client';
import { isChecklistItemVisibleOn } from '../../domain/checklist-membership';
import type { ChecklistItem, Child, Schedule, ScheduleException } from '../../domain/types';
import { TypeIcon } from '../common/TypeIcon';
import { IconCheck } from '../icons';
import { getKidPalette, TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { isoToYyyymmdd } from '../utils/date';
import {
  alertSummary,
  fmt12hrShortSpaced,
  formatKoDateChip,
  repeatSummary,
  TYPE_LABELS_KO,
} from '../sheets/edit-sheet-form';
import {
  FormActionRow,
  FormGroup,
  FormSectionHeader,
  FormTextRow,
  FormValueRow,
} from '../sheets/form-rows';

export interface EventDetailContentProps {
  onClose: () => void;
}

export function EventDetailContent({
  onClose,
}: EventDetailContentProps): React.ReactElement {
  const router = useRouter();
  const detail = useUiStore((s) => s.eventDetailState);

  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const removeSchedule = useSchedulesStore((s) => s.removeSchedule);
  const applyException = useSchedulesStore((s) => s.applyException);
  const children = useChildrenStore((s) => s.children);
  const itemsByScheduleId = useChecklistStore((s) => s.itemsByScheduleId);

  const schedule: Schedule | undefined = useMemo(() => {
    if (detail.scheduleId === undefined) return undefined;
    return schedules.find((s) => s.id === detail.scheduleId);
  }, [schedules, detail.scheduleId]);

  const exception: ScheduleException | undefined = useMemo(() => {
    if (detail.scheduleId === undefined || detail.occurrenceDate === undefined) {
      return undefined;
    }
    const sid = detail.scheduleId;
    const date = detail.occurrenceDate;
    return exceptions.find((x) => x.scheduleId === sid && x.date === date);
  }, [exceptions, detail.scheduleId, detail.occurrenceDate]);

  const child: Child | undefined = useMemo(() => {
    if (schedule === undefined) return undefined;
    return children.find((c) => c.id === schedule.childId);
  }, [children, schedule]);

  // Filter the schedule's checklist to the items VISIBLE on this occurrence
  // (ADR-006b membership): a day-specific (이번만) item shows only on its anchor
  // date; a 매번 item shows from its anchor forward; legacy NULL shows always.
  // Without this filter the detail screen showed every item on every date.
  const checklist: ChecklistItem[] = useMemo(() => {
    if (schedule === undefined) return [];
    const all = itemsByScheduleId.get(schedule.id) ?? [];
    if (detail.occurrenceDate === undefined) return all;
    const occInt = isoToYyyymmdd(detail.occurrenceDate);
    return all.filter((it) => isChecklistItemVisibleOn(it, occInt));
  }, [itemsByScheduleId, schedule, detail.occurrenceDate]);

  // Apply any modify-exception overrides so the displayed values match what
  // the daily/weekly grid renders for this occurrence.
  const display = useMemo(() => {
    if (schedule === undefined) return null;
    const startMinutes =
      exception?.kind === 'modify' && exception.overrideStartMinutes !== null
        ? exception.overrideStartMinutes
        : schedule.startMinutes;
    const endMinutes =
      exception?.kind === 'modify' && exception.overrideEndMinutes !== null
        ? exception.overrideEndMinutes
        : schedule.endMinutes;
    const title =
      exception?.kind === 'modify' && exception.overrideTitle !== null
        ? exception.overrideTitle
        : schedule.title;
    return { startMinutes, endMinutes, title };
  }, [schedule, exception]);

  // The edit form opens ON TOP of this detail (iPhone Calendar: 편집 comes
  // out of the event sheet); saving / cancelling goes back here, showing the
  // updated event. (Never onClose() + push — that raced into a stuck route.)
  const handleEditOccurrence = useCallback(() => {
    if (schedule === undefined || detail.occurrenceDate === undefined) return;
    router.push({
      pathname: '/schedule/edit',
      params: {
        mode: 'editOccurrence',
        scheduleId: String(schedule.id),
        occurrenceDate: detail.occurrenceDate,
      },
    });
  }, [schedule, detail.occurrenceDate, router]);

  const handleEditAll = useCallback(() => {
    if (schedule === undefined) return;
    router.push({
      pathname: '/schedule/edit',
      params: {
        mode: 'editAll',
        scheduleId: String(schedule.id),
        // fix-1 (ADR-006a): forward the viewed occurrence so a 이번만-OFF row
        // binds to the date the user is looking at (boundDateInt's 2nd
        // fallback), not the week-anchor currentDate. Mirrors
        // handleEditOccurrence above.
        ...(detail.occurrenceDate !== undefined
          ? { occurrenceDate: detail.occurrenceDate }
          : {}),
      },
    });
  }, [schedule, detail.occurrenceDate, router]);

  const handleDeleteOccurrence = useCallback(() => {
    if (schedule === undefined || detail.occurrenceDate === undefined) return;
    const date = detail.occurrenceDate;
    Alert.alert(
      '이 회차만 삭제',
      '이 날의 일정만 취소됩니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const db = await getDb();
            await applyException(db, schedule.id, date, { kind: 'cancel' });
            onClose();
          },
        },
      ],
    );
  }, [schedule, detail.occurrenceDate, applyException, onClose]);

  const handleDeleteAll = useCallback(() => {
    if (schedule === undefined) return;
    Alert.alert(
      '전체 삭제',
      '이 일정과 모든 예외를 삭제합니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const db = await getDb();
            await removeSchedule(db, schedule.id);
            onClose();
          },
        },
      ],
    );
  }, [schedule, removeSchedule, onClose]);

  // Deleted from the edit form on top (전체 삭제 / 이 회차만 삭제) → nothing
  // left to show here: close the detail too.
  const gone = detail.mode === 'open' && (schedule === undefined || exception?.kind === 'cancel');
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);

  // The modal must still mount with a body even if the schedule was just
  // deleted (drawer closes the next tick). Render a minimal frame so the
  // sheet lifecycle stays stable.
  const ready = schedule !== undefined && child !== undefined && display !== null;

  return (
    <View style={styles.contentRoot}>
      {/* Nav bar — 닫기 · 일정 · 수정 (same bar as the form) */}
      <View style={styles.headerBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          hitSlop={8}
          style={styles.headerSlotStart}
        >
          <Text style={styles.cancelLabel}>닫기</Text>
        </Pressable>
        <Text style={styles.headerTitle}>일정</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="수정"
          onPress={handleEditAll}
          disabled={!ready}
          hitSlop={8}
          style={styles.headerSlotEnd}
        >
          <Text style={[styles.editLabel, !ready ? styles.editLabelDisabled : null]}>
            수정
          </Text>
        </Pressable>
      </View>

      {ready ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <DetailBody
            schedule={schedule}
            child={child}
            checklist={checklist}
            display={display}
            occurrenceDate={detail.occurrenceDate}
            onEditOccurrence={handleEditOccurrence}
            onDeleteOccurrence={handleDeleteOccurrence}
            onDeleteAll={handleDeleteAll}
          />
        </ScrollView>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Body — exported for tests.
// -----------------------------------------------------------------------------

interface DetailBodyProps {
  schedule: Schedule;
  child: Child;
  checklist: ChecklistItem[];
  display: { startMinutes: number; endMinutes: number; title: string };
  occurrenceDate: string | undefined;
  onEditOccurrence: () => void;
  onDeleteOccurrence: () => void;
  onDeleteAll: () => void;
}

export function DetailBody({
  schedule,
  child,
  checklist,
  display,
  occurrenceDate,
  onEditOccurrence,
  onDeleteOccurrence,
  onDeleteAll,
}: DetailBodyProps): React.ReactElement {
  const palette = getKidPalette(child.colorIndex);
  const date =
    occurrenceDate !== undefined && occurrenceDate.length > 0
      ? occurrenceDate
      : (schedule.validFrom as unknown as string);
  const allDay = schedule.allDay === true;
  const oneTime = schedule.validUntil !== null && schedule.validUntil === schedule.validFrom;
  const location = schedule.location ?? '';
  const memo = schedule.notes ?? '';

  return (
    <>
      {/* 제목 · 장소 */}
      <FormGroup>
        <FormTextRow text={display.title} emphasis last={location.length === 0} />
        {location.length > 0 ? <FormTextRow text={location} last /> : null}
      </FormGroup>

      {/* 자녀 · 종류 */}
      <FormGroup>
        <FormValueRow
          label="자녀"
          value={child.name}
          leading={<View style={[styles.kidDot, { backgroundColor: palette.source, borderColor: palette.deep }]} />}
        />
        <FormValueRow
          label="종류"
          value={TYPE_LABELS_KO[schedule.type]}
          leading={<TypeIcon type={schedule.type} size={16} color={TOKENS.inkSub} />}
          last
        />
      </FormGroup>

      {/* 시작 · 종료 · 반복 */}
      <FormGroup>
        <FormValueRow
          label="시작"
          value={allDay ? `${formatKoDateChip(date)} · 하루 종일` : `${formatKoDateChip(date)} ${fmt12hrShortSpaced(display.startMinutes)}`}
        />
        {allDay ? null : <FormValueRow label="종료" value={fmt12hrShortSpaced(display.endMinutes)} />}
        <FormValueRow label="반복" value={oneTime ? '안 함' : repeatSummary(schedule.daysOfWeek)} last />
      </FormGroup>

      {/* 알림 · 픽업 */}
      <FormGroup>
        <FormValueRow label="시작 전 알림" value={alertSummary(schedule.notifyMinutesBefore)} last={allDay} />
        {allDay ? null : (
          <>
            <FormValueRow label="종료 전 알림" value={alertSummary(schedule.notifyEndMinutesBefore ?? null)} />
            <FormValueRow
              label="픽업"
              value={schedule.needsPickup ? `${fmt12hrShortSpaced(display.endMinutes)} 픽업` : '필요 없음'}
              leading={schedule.needsPickup ? <View style={styles.pickupDot} /> : null}
              last
            />
          </>
        )}
      </FormGroup>

      {/* 준비물 */}
      {checklist.length > 0 ? (
        <View style={styles.block}>
          <FormSectionHeader label="준비물" />
          <FormGroup>
            {checklist.map((item, i) => (
              <View key={item.id}>
                <View style={styles.checkRow}>
                  <View style={[styles.checkBox, item.isDone ? styles.checkBoxDone : null]}>
                    {item.isDone ? <IconCheck size={10} color={TOKENS.surface} /> : null}
                  </View>
                  <Text style={[styles.checkLabel, item.isDone ? styles.checkLabelDone : null]}>{item.label}</Text>
                </View>
                {i < checklist.length - 1 ? <View style={styles.separator} /> : null}
              </View>
            ))}
          </FormGroup>
        </View>
      ) : null}

      {/* 메모 */}
      {memo.length > 0 ? (
        <FormGroup>
          <FormTextRow text={memo} last />
        </FormGroup>
      ) : null}

      {/* Actions — same wording as the edit form */}
      <FormGroup>
        {oneTime ? null : <FormActionRow label="이 회차만 수정" onPress={onEditOccurrence} />}
        {oneTime ? null : <FormActionRow label="이 회차만 삭제" onPress={onDeleteOccurrence} tone="danger" />}
        <FormActionRow label={oneTime ? '일정 삭제' : '전체 삭제'} onPress={onDeleteAll} tone="danger" last />
      </FormGroup>

      <View style={styles.tail} />
    </>
  );
}

const styles = StyleSheet.create({
  // Same chrome as ScheduleEditSheet (grouped background, nav bar, gaps).
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
  editLabel: { ...TYPE.headline, color: TOKENS.danger },
  editLabelDisabled: { color: TOKENS.ink30 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, gap: 22 },
  block: { gap: 6 },
  kidDot: { width: 12, height: 12, borderRadius: RADIUS.full, borderWidth: 1.5 },
  pickupDot: { width: 7, height: 7, borderRadius: RADIUS.full, backgroundColor: TOKENS.primary },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: TOKENS.ink30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surface,
  },
  checkBoxDone: { backgroundColor: TOKENS.controlActive, borderColor: TOKENS.controlActive },
  checkLabel: { ...TYPE.row, color: TOKENS.ink, flex: 1 },
  checkLabelDone: { color: TOKENS.inkSub, textDecorationLine: 'line-through' },
  separator: { marginLeft: 16, height: StyleSheet.hairlineWidth, backgroundColor: TOKENS.separator },
  tail: { height: SPACING.xxxl },
});
