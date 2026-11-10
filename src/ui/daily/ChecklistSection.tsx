import { Fragment, memo, useMemo } from 'react';
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
import { ItemLine } from '../home/ItemLine';
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
          groups.flatMap((group) => group.classes.map((c) => ({ kid: group.kid, ...c }))).map(({ kid, occ, items }, idx) => {
          const palette = theme.kid(kid.colorIndex);
          const remaining = items.filter((i) => !isComplete(i.id)).length;
          return (
            <Fragment key={occ.scheduleId}>
              {idx > 0 ? <View style={styles.divider} /> : null}
                <View testID={`checklist-class-${occ.scheduleId}`}>
                  {/* Whose and which class — the same line as the 지금 rows. */}
                  <View style={styles.kidRow}>
                    <KidAvatar child={kid} size={36} />
                    <View style={styles.kidLine}>
                      <ItemLine
                        // ADR-013: a shared class lists everyone ("민준·서연").
                        name={memberNames(occ.memberIds ?? [occ.childId], childrenById) || kid.name}
                        title={occ.title}
                        type={occ.type}
                        // Start time only — supplies are needed by then.
                        detail={occ.allDay === true ? '하루 종일' : fmt12hrShort(occ.startMinutes)}
                      />
                    </View>
                    <Text style={styles.kidRemaining}>
                      {remaining}/{items.length}
                    </Text>
                  </View>
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
                      {/* Line between supplies, inset to the labels (iOS list). */}
                      {i > 0 ? <View style={styles.itemSeparator} /> : null}
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
                        <View
                          style={[
                            styles.checkbox,
                            isDone ? styles.itemRowDone : null,
                            isDone
                              ? { backgroundColor: palette.source, borderColor: palette.source }
                              : styles.checkboxIdle,
                          ]}
                        >
                          {isDone ? <IconCheck size={12} color={theme.t.surface} /> : null}
                        </View>
                        <Text style={[styles.itemLabel, isDone ? styles.itemLabelDone : null, isDone ? styles.itemRowDone : null]}>
                          {item.label}
                        </Text>
                      </Pressable>
                      </SwipeToDelete>
                    );
                  })}
                </View>
            </Fragment>
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
    padding: 6,
  },
  emptyText: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 14,
    color: th.t.inkSub,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: th.t.separator,
    marginVertical: SPACING.xs,
    marginHorizontal: SPACING.sm,
  },
  kidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: 10,
    paddingRight: 10,
    paddingBottom: SPACING.xs,
    paddingLeft: 10,
  },
  kidRemaining: {
    marginLeft: 'auto',
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 12,
    fontWeight: '400',
    color: th.t.inkSub,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    // Opaque, so the red 삭제 behind it shows only while swiping.
    backgroundColor: th.t.surface,
  },
  // Inset to the label: card padding 6 + row padding 10 + checkbox 22 + gap 10.
  itemSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: th.t.separator,
    marginLeft: 42,
    marginRight: 10,
  },
  itemRowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxIdle: {
    backgroundColor: th.t.surface,
    borderColor: th.t.ink30,
  },
  itemLabel: {
    flex: 1,
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 16,
    fontWeight: '400',
    color: th.t.ink,
    letterSpacing: -0.2,
  },
  itemLabelDone: {
    textDecorationLine: 'line-through',
  },
  kidLine: { flex: 1, minWidth: 0 },
}));
