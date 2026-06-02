// 1:1 port of docs/design/amatta-v1/app-event-detail.jsx.
//
// Read-only event detail. Driven by useUiStore.eventDetailState
// (mode/open + scheduleId + occurrenceDate). Pulls Schedule via
// useSchedulesStore, Child via useChildrenStore, and related
// ChecklistItems via useChecklistStore.itemsByScheduleId.
//
// Top-right "수정" routes to ScheduleEditSheet via openEditSheet('editAll').
// The lower action stack offers per-occurrence edit/cancel and full delete.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { useChecklistStore } from '../../state/checklist-store';
import { useChildrenStore } from '../../state/children-store';
import { useSchedulesStore } from '../../state/schedules-store';
import { useUiStore } from '../../state/ui-store';
import { getDb } from '../../db/client';
import type {
  ChecklistItem,
  Child,
  Schedule,
  ScheduleException,
  ScheduleType,
} from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { TypeIcon } from '../common/TypeIcon';
import { FONT_FAMILIES } from '../fonts';
import { IconCheck } from '../icons';
import { TOKENS } from '../palette';
import { fmtKoTime, formatKoreanDateLabel } from '../utils/date';
import { TYPE_LABELS_KO } from '../sheets/edit-sheet-form';

const SNAP_POINTS: string[] = ['85%'];

// Sunday-first labels for the repeat-day display row. Our mask is
// Monday-bit-0 — map visual index → bit at render time.
const DOW_LABELS_SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토'] as const;
const VISUAL_TO_MASK_BIT: readonly number[] = [6, 0, 1, 2, 3, 4, 5];

const NOTIFY_LABEL_KO = (m: number | null): string => {
  if (m === null) return '없음';
  if (m >= 60) return `${Math.round(m / 60)}시간 전`;
  return `${m}분 전`;
};

export function EventDetailDrawer(): React.ReactElement {
  const detail = useUiStore((s) => s.eventDetailState);
  const closeDetail = useUiStore((s) => s.closeEventDetail);
  const openEditSheet = useUiStore((s) => s.openEditSheet);

  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const removeSchedule = useSchedulesStore((s) => s.removeSchedule);
  const applyException = useSchedulesStore((s) => s.applyException);
  const children = useChildrenStore((s) => s.children);
  const itemsByScheduleId = useChecklistStore((s) => s.itemsByScheduleId);

  const modalRef = useRef<BottomSheetModal>(null);

  const open = detail.mode === 'open';

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

  const checklist: ChecklistItem[] = useMemo(() => {
    if (schedule === undefined) return [];
    return itemsByScheduleId.get(schedule.id) ?? [];
  }, [itemsByScheduleId, schedule]);

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

  useEffect(() => {
    if (open) modalRef.current?.present();
    else modalRef.current?.dismiss();
  }, [open]);

  const handleDismiss = useCallback(() => {
    if (open) closeDetail();
  }, [open, closeDetail]);

  const handleEditOccurrence = useCallback(() => {
    if (schedule === undefined || detail.occurrenceDate === undefined) return;
    closeDetail();
    openEditSheet('editOccurrence', {
      scheduleId: schedule.id,
      occurrenceDate: detail.occurrenceDate,
    });
  }, [schedule, detail.occurrenceDate, openEditSheet, closeDetail]);

  const handleEditAll = useCallback(() => {
    if (schedule === undefined) return;
    closeDetail();
    openEditSheet('editAll', { scheduleId: schedule.id });
  }, [schedule, openEditSheet, closeDetail]);

  const handleCancelOccurrence = useCallback(() => {
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
            closeDetail();
          },
        },
      ],
    );
  }, [schedule, detail.occurrenceDate, applyException, closeDetail]);

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
            closeDetail();
          },
        },
      ],
    );
  }, [schedule, removeSchedule, closeDetail]);

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

  // The modal must still mount with a body even if the schedule was just
  // deleted (drawer closes the next tick). Render a minimal frame so the
  // BottomSheetView lifecycle stays stable.
  const ready = schedule !== undefined && child !== undefined && display !== null;

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={SNAP_POINTS}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetView style={styles.sheetContent}>
        {/* Top bar — 취소 · 일정 · 수정 */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={closeDetail}
            hitSlop={8}
            style={styles.headerSlotStart}
          >
            <Text style={styles.cancelLabel}>닫기</Text>
          </Pressable>
          <Text style={styles.headerTitle}>일정</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이 회차 수정"
            onPress={handleEditOccurrence}
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
              onEditAll={handleEditAll}
              onCancelOccurrence={handleCancelOccurrence}
              onDeleteAll={handleDeleteAll}
            />
          </ScrollView>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

// -----------------------------------------------------------------------------
// Inner body — split out so the test-target can mount it directly without the
// BottomSheetModal lifecycle (we also export it for the test harness).
// -----------------------------------------------------------------------------

interface DetailBodyProps {
  schedule: Schedule;
  child: Child;
  checklist: ChecklistItem[];
  display: { startMinutes: number; endMinutes: number; title: string };
  occurrenceDate: string | undefined;
  onEditOccurrence: () => void;
  onEditAll: () => void;
  onCancelOccurrence: () => void;
  onDeleteAll: () => void;
}

export function DetailBody({
  schedule,
  child,
  checklist,
  display,
  occurrenceDate,
  onEditOccurrence,
  onEditAll,
  onCancelOccurrence,
  onDeleteAll,
}: DetailBodyProps): React.ReactElement {
  const kindLabel = TYPE_LABELS_KO[schedule.type as ScheduleType];
  const notifyLabel = NOTIFY_LABEL_KO(schedule.notifyMinutesBefore);
  const dateLabel =
    occurrenceDate !== undefined && occurrenceDate.length > 0
      ? formatKoreanDateLabel(occurrenceDate as unknown as import('../../domain/types').ISODate)
      : formatKoreanDateLabel(schedule.validFrom);
  const hasRepeat = schedule.daysOfWeek !== 0;
  const place = schedule.location ?? '';
  const memo = schedule.notes ?? '';

  return (
    <>
      <Group>
        <DRow label="자녀">
          <View style={styles.kidChip}>
            <KidAvatar child={child} size={22} />
            <Text style={styles.kidChipLabel}>{child.name}</Text>
          </View>
        </DRow>
        <DRow label="종류" hairline={false}>
          <View style={styles.valueInline}>
            <TypeIcon type={schedule.type} size={12} color={TOKENS.ink} />
            <Text style={styles.valueText}>{kindLabel}</Text>
          </View>
        </DRow>
      </Group>

      <Group>
        <DRow label="제목">
          <Text style={styles.valueText}>{display.title}</Text>
        </DRow>
        <DRow label="위치" hairline={false}>
          <Text style={[styles.valueText, place.length === 0 ? styles.valueMuted : null]}>
            {place.length > 0 ? place : '위치 없음'}
          </Text>
        </DRow>
      </Group>

      <Group>
        <DRow label="날짜">
          <Text style={styles.valueText}>{dateLabel}</Text>
        </DRow>
        <DRow label="시간">
          <Text style={styles.valueText}>{fmtKoTime(display.startMinutes)}</Text>
          <Text style={styles.valueDash}>–</Text>
          <Text style={styles.valueText}>{fmtKoTime(display.endMinutes)}</Text>
        </DRow>
        {hasRepeat ? (
          <DRow label="반복" align="top" hairline={false}>
            <View style={styles.dayRow}>
              {DOW_LABELS_SUN_FIRST.map((label, visualIdx) => {
                const maskBit = VISUAL_TO_MASK_BIT[visualIdx] ?? 0;
                const on = (schedule.daysOfWeek & (1 << maskBit)) !== 0;
                return (
                  <View
                    key={label}
                    style={[styles.dayCircle, on ? styles.dayCircleActive : null]}
                  >
                    <Text
                      style={[
                        styles.dayCircleLabel,
                        on ? styles.dayCircleLabelActive : null,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </DRow>
        ) : (
          <DRow label="반복" hairline={false}>
            <Text style={[styles.valueText, styles.valueMuted]}>반복 없음</Text>
          </DRow>
        )}
      </Group>

      <Group>
        <DRow label="알림">
          <Text style={styles.valueText}>{notifyLabel}</Text>
        </DRow>
        <DRow label="픽업" hairline={false}>
          {schedule.needsPickup ? (
            <View style={styles.pickupBadge}>
              <View style={styles.pickupDot} />
              <Text style={styles.valueText}>
                {fmtKoTime(display.endMinutes)} 픽업
              </Text>
            </View>
          ) : (
            <Text style={[styles.valueText, styles.valueMuted]}>필요 없음</Text>
          )}
        </DRow>
      </Group>

      {memo.length > 0 ? (
        <Group>
          <DRow label="메모" align="top" hairline={false}>
            <Text style={[styles.valueText, styles.memoText]}>{memo}</Text>
          </DRow>
        </Group>
      ) : null}

      {checklist.length > 0 ? (
        <Group>
          <DRow label="준비물" align="top" hairline={false}>
            <View style={styles.checklistCol}>
              {checklist.map((item, i) => (
                <View
                  key={item.id}
                  style={[
                    styles.checklistRow,
                    i > 0 ? styles.checklistRowHairline : null,
                  ]}
                >
                  <View
                    style={[
                      styles.checkBox,
                      item.isDone ? styles.checkBoxDone : null,
                    ]}
                  >
                    {item.isDone ? (
                      <IconCheck size={10} color={TOKENS.surface} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.valueText,
                      item.isDone ? styles.checklistDone : null,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </DRow>
        </Group>
      ) : null}

      <View style={styles.actionGroup}>
        <ActionRow label="이 회차 수정" onPress={onEditOccurrence} hairline />
        <ActionRow label="전체 수정" onPress={onEditAll} hairline />
        <ActionRow label="이 회차 삭제" onPress={onCancelOccurrence} hairline />
        <ActionRow label="전체 삭제" onPress={onDeleteAll} tone="danger" />
      </View>

      <View style={styles.tail} />
    </>
  );
}

// -----------------------------------------------------------------------------
// Layout primitives (kept local; the sheet variant lives in ScheduleEditSheet)
// -----------------------------------------------------------------------------

function Group({ children }: { children: React.ReactNode }): React.ReactElement {
  return <View style={styles.group}>{children}</View>;
}

interface DRowProps {
  label: string;
  children: React.ReactNode;
  hairline?: boolean;
  align?: 'center' | 'top';
}

function DRow({
  label,
  children,
  hairline = true,
  align = 'center',
}: DRowProps): React.ReactElement {
  return (
    <View
      style={[
        styles.row,
        hairline ? styles.rowHairline : null,
        align === 'top' ? styles.rowTop : styles.rowCenter,
      ]}
    >
      <Text style={[styles.rowLabel, align === 'top' ? styles.rowLabelTop : null]}>
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
      style={[styles.actionRow, hairline ? styles.actionRowHairline : null]}
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
  editLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.primary,
    letterSpacing: -0.3,
  },
  editLabelDisabled: { color: TOKENS.ink30 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 8 },

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
  rowLabelTop: { paddingTop: 4 },
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

  // --- Inline values --------------------------------------------------
  valueText: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  valueMuted: { color: TOKENS.inkSub },
  valueDash: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink30,
  },
  valueInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memoText: { width: '100%', textAlign: 'left' },

  // --- Kid chip --------------------------------------------------------
  kidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 11,
    backgroundColor: '#EBEAE9',
    borderRadius: 9999,
  },
  kidChipLabel: {
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },

  // --- Day circles -----------------------------------------------------
  dayRow: { flexDirection: 'row', gap: 6 },
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
    color: TOKENS.ink30,
    letterSpacing: -0.2,
  },
  dayCircleLabelActive: { color: TOKENS.surface },

  // --- Pickup badge ---------------------------------------------------
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickupDot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
    backgroundColor: TOKENS.primary,
  },

  // --- Checklist ------------------------------------------------------
  checklistCol: { width: '100%' },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checklistRowHairline: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.ink04,
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: TOKENS.ink30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surface,
  },
  checkBoxDone: {
    backgroundColor: '#2A2A29',
    borderColor: '#2A2A29',
  },
  checklistDone: {
    color: TOKENS.inkSub,
    textDecorationLine: 'line-through',
  },

  // --- Action stack ---------------------------------------------------
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
