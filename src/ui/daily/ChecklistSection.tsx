import { memo, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useChecklistCompletionStore,
  useChecklistStore,
  useChildrenStore,
  useSchedulesStore,
  useUiStore,
} from '../../state';
import { getDb } from '../../db/client';
import { expandOccurrences, memberNames } from '../../domain/occurrences';
import { isChecklistItemVisibleOn } from '../../domain/checklist-membership';
import type { Child, ChecklistItem, ISODate, Occurrence } from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { SwipeToDelete } from '../common/SwipeToDelete';
import { FONT_FAMILIES } from '../fonts';
import { IconCheck } from '../icons';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { fmt12hrShort } from '../utils/date';
import { isoToYyyymmdd } from './pickup-data';
import { makeStyles, useTheme } from '../appearance';

/** One class (today's occurrence) and its supplies. */
interface ClassGroup {
  occ: Occurrence;
  items: ChecklistItem[];
}

interface KidGroup {
  kid: Child;
  classes: ClassGroup[];
  items: ChecklistItem[];
}

function buildGroups(
  children: Child[],
  scheduleOccurrencesToday: Map<number, Occurrence>,
  itemsByScheduleId: Map<number, ChecklistItem[]>,
  dateInt: number,
): KidGroup[] {
  const classesByKid = new Map<number, ClassGroup[]>();
  for (const [scheduleId, occ] of scheduleOccurrencesToday) {
    // v6/v7 membership (ADR-006b): NULL = always; recurring = anchor-forward;
    // 이번만 = that date only. Single source: isChecklistItemVisibleOn.
    const items = (itemsByScheduleId.get(scheduleId) ?? [])
      .filter((item) => isChecklistItemVisibleOn(item, dateInt))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    if (items.length === 0) continue;
    const list = classesByKid.get(occ.childId) ?? [];
    list.push({ occ, items });
    classesByKid.set(occ.childId, list);
  }
  return children
    .map((kid) => {
      // Classes in the order they happen — supplies are needed by the start.
      const classes = (classesByKid.get(kid.id) ?? []).sort((a, b) => a.occ.startMinutes - b.occ.startMinutes);
      return { kid, classes, items: classes.flatMap((c) => c.items) };
    })
    .filter((g) => g.items.length > 0);
}

function SectionHeader({ label, done, total }: { label: string; done: number; total: number }) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text style={styles.headerLabel}>{label}</Text>
      <Text style={styles.headerCount}>
        {done}/{total}
      </Text>
    </View>
  );
}

interface ChecklistSectionProps {
  /** Date to show. Defaults to the calendar's `currentDate`; home passes today. */
  date?: ISODate;
}

function ChecklistSectionImpl({ date }: ChecklistSectionProps = {}): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const itemsByScheduleId = useChecklistStore((s) => s.itemsByScheduleId);
  const completionMap = useChecklistCompletionStore((s) => s.completionMap);
  const storeDate = useUiStore((s) => s.currentDate);
  const currentDate = date ?? storeDate;

  // The viewed day as a yyyymmdd int — the key both for membership filtering
  // (day-specific items show only on their date) and per-occurrence completion
  // (checking on day D never marks D+1).
  const dateInt = useMemo(() => isoToYyyymmdd(currentDate), [currentDate]);

  const isComplete = useMemo(
    () => (itemId: number): boolean => completionMap.has(`${itemId}|${dateInt}`),
    [completionMap, dateInt],
  );

  const childrenById = useMemo(() => {
    const m = new Map<number, Child>();
    for (const c of children) m.set(c.id, c);
    return m;
  }, [children]);

  const occurrencesToday = useMemo<Map<number, Occurrence>>(() => {
    const list = expandOccurrences(
      schedules,
      exceptions,
      { from: currentDate, to: currentDate },
      childrenById,
    );
    const m = new Map<number, Occurrence>();
    for (const occ of list) m.set(occ.scheduleId, occ);
    return m;
  }, [schedules, exceptions, currentDate, childrenById]);

  const groups = useMemo(
    () => buildGroups(children, occurrencesToday, itemsByScheduleId, dateInt),
    [children, occurrencesToday, itemsByScheduleId, dateInt],
  );

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const total = flatItems.length;
  // Completion is per-occurrence (v6): "done" iff a checklist_completion row
  // exists for (itemId, viewed date). is_done is FROZEN and never read here.
  const done = flatItems.filter((i) => isComplete(i.id)).length;

  const onDeleteItem = async (itemId: number): Promise<void> => {
    const db = await getDb();
    await useChecklistStore.getState().removeOne(db, itemId);
  };
  // A 매번 supply is shared by every occurrence of the class — deleting it
  // here removes it from the other days too, so ask once.
  const confirmRecurring = (label: string): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert('매번 챙기는 준비물이에요', `"${label}"을(를) 삭제하면 다른 날에도 보이지 않아요.`, [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });

  const onToggle = async (itemId: number): Promise<void> => {
    const db = await getDb();
    await useChecklistStore.getState().toggleDone(db, itemId, dateInt);
  };

  return (
    <View testID="checklist-section">
      <SectionHeader label="준비물" done={done} total={total} />
      <View style={styles.card}>
        {groups.length === 0 ? (
          <Text style={styles.emptyText}>오늘 챙길 준비물이 없어요</Text>
        ) : (
          // Board H1 (ADR-014): one flat iOS list — kid face · supply · "민준 · 수학 2PM" · round check.
          groups.flatMap((group) => group.classes.map((c) => ({ kid: group.kid, ...c }))).map(({ kid, occ, items }, idx) => {
          const who = memberNames(occ.memberIds ?? [occ.childId], childrenById) || kid.name;
          const when = occ.allDay === true ? '하루 종일' : fmt12hrShort(occ.startMinutes);
          return (
            <View key={occ.scheduleId} testID={`checklist-class-${occ.scheduleId}`}>
              {items.map((item, i) => {
                const isDone = isComplete(item.id);
                return (
                  <SwipeToDelete
                    key={item.id}
                    onDelete={() => void onDeleteItem(item.id)}
                    confirm={item.recurring ? () => confirmRecurring(item.label) : undefined}
                    accessibilityLabel={item.label}
                    testID={`checklist-row-${item.id}`}
                  >
                    {idx > 0 || i > 0 ? <View style={styles.itemSeparator} /> : null}
                    <Pressable
                      onPress={() => {
                        void onToggle(item.id);
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isDone }}
                      accessibilityLabel={`${occ.title} 준비물 ${item.label}`}
                      style={styles.itemRow}
                      testID={`checklist-item-${item.id}`}
                    >
                      <View style={isDone ? styles.itemRowDone : null}>
                        <KidAvatar child={kid} size={30} />
                      </View>
                      <View style={[styles.itemText, isDone ? styles.itemRowDone : null]}>
                        <Text style={[styles.itemLabel, isDone ? styles.itemLabelDone : null]} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={styles.itemSub} numberOfLines={1}>
                          {who} · {occ.title} {when}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          isDone ? { backgroundColor: theme.t.primary, borderColor: theme.t.primary } : styles.checkboxIdle,
                        ]}
                      >
                        {isDone ? <IconCheck size={13} color={theme.t.surface} /> : null}
                      </View>
                    </Pressable>
                  </SwipeToDelete>
                );
              })}
            </View>
          );
          })
        )}
      </View>
    </View>
  );
}

export const ChecklistSection = memo(ChecklistSectionImpl);

const useStyles = makeStyles((th) => ({
  // Matches HomeSection (home screen headings): headline + muted count,
  // 6px above the box. These sections now live only on the home screen.
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  headerLabel: { ...TYPE.title2, color: th.t.ink },
  headerCount: { ...TYPE.footnote, color: th.t.inkSub },
  card: {
    backgroundColor: th.t.surface,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  emptyText: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 14,
    color: th.t.inkSub,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
  itemRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    // Opaque, so the red 삭제 behind it shows only while swiping.
    backgroundColor: th.t.surface,
  },
  // iOS list line, inset to the text: row padding 16 + avatar 30 + gap 12.
  itemSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: th.t.separator,
    marginLeft: 58,
  },
  itemText: { flex: 1, minWidth: 0, gap: 1 },
  itemSub: { ...TYPE.footnote, color: th.t.inkSub },
  itemRowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxIdle: {
    backgroundColor: th.t.surface,
    borderColor: th.t.ink50,
  },
  itemLabel: { ...TYPE.row, color: th.t.ink },
  itemLabelDone: {
    textDecorationLine: 'line-through',
  },
}));
