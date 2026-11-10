// Guardian event detail — ADR-008. Same screen as a kid event's detail
// (EventDetailDrawer): grouped rows, 닫기 · 일정 · 수정 bar, actions below.
// The event lives in the device calendar: it is read here on open (and again
// when the edit form on top closes), edited through the same form, and
// deleted straight from the calendar.

import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  deleteGuardianEvent,
  getGuardianEvent,
  openGuardianEvent,
  type GuardianEventDetail,
} from '../../calendar/guardian-calendar';
import { useGuardianStore } from '../../state/guardian-store';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { alertSummary, fmt12hrShortSpaced, formatKoDateChip } from '../sheets/edit-sheet-form';
import { FormActionRow, FormGroup, FormTextRow, FormValueRow } from '../sheets/form-rows';

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export interface GuardianEventDetailProps {
  eventId: string;
  /** ISO timestamp of the instance's start (recurring events). */
  instance: string;
  onClose: () => void;
}

export function GuardianEventDetailContent({ eventId, instance, onClose }: GuardianEventDetailProps): React.ReactElement {
  const router = useRouter();
  const calendars = useGuardianStore((s) => s.calendars);
  const [event, setEvent] = useState<GuardianEventDetail | null>(null);
  const [missing, setMissing] = useState(false);

  // (Re)read on open and whenever the edit form on top closes.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getGuardianEvent(eventId, new Date(instance))
        .then((e) => {
          if (alive) setEvent(e);
        })
        .catch(() => {
          if (alive) setMissing(true);
        });
      return () => {
        alive = false;
      };
    }, [eventId, instance]),
  );

  const calendar = calendars.find((c) => c.id === event?.calendarId);
  const writable = calendar?.writable === true;
  const editable = event !== null && writable && event.singleDay;

  const done = useCallback(() => {
    useGuardianStore.getState().invalidate();
    onClose();
  }, [onClose]);

  const remove = (andFuture: boolean): void => {
    if (event === null) return;
    const title = andFuture ? '이후 일정 모두 삭제' : event.recurring ? '이 회차만 삭제' : '일정 삭제';
    const body = andFuture
      ? '이 날과 그 뒤의 반복 일정을 아이폰 캘린더에서 삭제합니다. 계속할까요?'
      : '아이폰 캘린더에서 이 일정을 삭제합니다. 계속할까요?';
    Alert.alert(title, body, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void deleteGuardianEvent(event.id, new Date(instance), event.recurring, andFuture)
            .then(done)
            .catch(() => Alert.alert('삭제하지 못했어요', '잠시 후 다시 시도해 주세요.'));
        },
      },
    ]);
  };

  const edit = (): void => {
    if (!editable) return;
    router.push({ pathname: '/schedule/edit', params: { mode: 'editGuardian', eventId, instance } });
  };

  const openInCalendar = (): void => {
    void openGuardianEvent(eventId, new Date(instance))
      .catch(() => undefined)
      .finally(() => {
        // The user may have edited or deleted it there.
        getGuardianEvent(eventId, new Date(instance))
          .then(setEvent)
          .catch(() => done());
        useGuardianStore.getState().invalidate();
      });
  };

  // Deleted elsewhere (or no longer readable) — nothing to show.
  useEffect(() => {
    if (missing) done();
  }, [missing, done]);

  const startIso = event !== null ? isoOf(event.startDate) : '';
  // All-day ends at the following midnight → its last day is the one before.
  const endIso =
    event === null ? '' : isoOf(event.allDay ? new Date(event.endDate.getTime() - 1) : event.endDate);

  return (
    <View style={styles.contentRoot}>
      <View style={styles.headerBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} hitSlop={8} style={styles.headerSlotStart}>
          <Text style={styles.cancelLabel}>닫기</Text>
        </Pressable>
        <Text style={styles.headerTitle}>일정</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="수정"
          accessibilityState={{ disabled: !editable }}
          onPress={edit}
          disabled={!editable}
          hitSlop={8}
          style={styles.headerSlotEnd}
        >
          <Text style={[styles.editLabel, !editable ? styles.editLabelDisabled : null]}>수정</Text>
        </Pressable>
      </View>

      {event !== null ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <FormGroup>
            <FormTextRow text={event.title} placeholder="(제목 없음)" emphasis last={event.location.length === 0} />
            {event.location.length > 0 ? <FormTextRow text={event.location} last /> : null}
          </FormGroup>

          <FormGroup>
            <FormValueRow label="자녀" value="보호자" leading={<View style={styles.guardianDot} />} />
            <FormValueRow
              label="캘린더"
              value={calendar?.title ?? '아이폰 캘린더'}
              leading={calendar !== undefined ? <View style={[styles.calDot, { backgroundColor: calendar.color }]} /> : null}
              last
            />
          </FormGroup>

          <FormGroup>
            <FormValueRow
              label="시작"
              value={
                event.allDay
                  ? `${formatKoDateChip(startIso)} · 하루 종일`
                  : `${formatKoDateChip(startIso)} ${fmt12hrShortSpaced(minutesOf(event.startDate))}`
              }
            />
            {event.allDay && endIso === startIso ? null : (
              <FormValueRow
                label="종료"
                value={
                  event.allDay
                    ? formatKoDateChip(endIso)
                    : endIso === startIso
                      ? fmt12hrShortSpaced(minutesOf(event.endDate))
                      : `${formatKoDateChip(endIso)} ${fmt12hrShortSpaced(minutesOf(event.endDate))}`
                }
              />
            )}
            <FormValueRow label="반복" value={event.recurring ? '반복 일정' : '안 함'} last />
          </FormGroup>

          <FormGroup>
            <FormValueRow label="시작 전 알림" value={alertSummary(event.alarmMinutesBefore)} last />
          </FormGroup>

          {event.notes.length > 0 ? (
            <FormGroup>
              <FormTextRow text={event.notes} last />
            </FormGroup>
          ) : null}

          {!writable ? (
            <Text style={styles.note}>읽기 전용 캘린더의 일정이라 앱에서 바꿀 수 없어요.</Text>
          ) : !event.singleDay ? (
            <Text style={styles.note}>여러 날에 걸친 일정은 아이폰 캘린더에서 수정할 수 있어요.</Text>
          ) : event.recurring ? (
            <Text style={styles.note}>반복 일정은 이 날만 바뀌어요. 반복 자체는 아이폰 캘린더에서 바꿀 수 있어요.</Text>
          ) : null}

          <FormGroup>
            <FormActionRow label="아이폰 캘린더에서 열기" onPress={openInCalendar} last={!writable} />
            {writable && event.recurring ? (
              <>
                <FormActionRow label="이 회차만 삭제" onPress={() => remove(false)} tone="danger" />
                <FormActionRow label="이후 일정 모두 삭제" onPress={() => remove(true)} tone="danger" last />
              </>
            ) : writable ? (
              <FormActionRow label="일정 삭제" onPress={() => remove(false)} tone="danger" last />
            ) : null}
          </FormGroup>

          <View style={styles.tail} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same chrome as EventDetailDrawer / ScheduleEditSheet.
  contentRoot: { flex: 1, backgroundColor: TOKENS.groupedBg },
  headerBar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg },
  headerSlotStart: { minWidth: 64, paddingVertical: SPACING.sm },
  headerSlotEnd: { minWidth: 64, paddingVertical: SPACING.sm, alignItems: 'flex-end' },
  headerTitle: { ...TYPE.headline, flex: 1, textAlign: 'center', color: TOKENS.ink },
  cancelLabel: { ...TYPE.row, color: TOKENS.danger },
  editLabel: { ...TYPE.headline, color: TOKENS.danger },
  editLabelDisabled: { color: TOKENS.ink30 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, gap: 22 },
  guardianDot: {
    width: 12,
    height: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    backgroundColor: TOKENS.guardian,
    borderColor: TOKENS.guardianDeep,
  },
  calDot: { width: 12, height: 12, borderRadius: RADIUS.full },
  note: { ...TYPE.footnote, color: TOKENS.inkSub, paddingHorizontal: SPACING.lg, marginTop: -14 },
  tail: { height: SPACING.xxxl },
});
