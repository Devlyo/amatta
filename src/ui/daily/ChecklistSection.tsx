import { Fragment, memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useChecklistStore, useChildrenStore, useSchedulesStore, useUiStore } from '../../state';
import { getDb } from '../../db/client';
import { expandOccurrences } from '../../domain/occurrences';
import type { Child, ChecklistItem, Occurrence } from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { FONT_FAMILIES } from '../fonts';
import { IconCheck } from '../icons';
import { getKidPalette, TOKENS } from '../palette';

interface KidGroupItem {
  item: ChecklistItem;
  dueLabel: string | null;
}

interface KidGroup {
  kid: Child;
  items: KidGroupItem[];
}

function buildGroups(
  children: Child[],
  scheduleOccurrencesToday: Map<number, Occurrence>,
  itemsByScheduleId: Map<number, ChecklistItem[]>,
): KidGroup[] {
  const childIdToItems = new Map<number, KidGroupItem[]>();
  for (const [scheduleId, occ] of scheduleOccurrencesToday) {
    const items = itemsByScheduleId.get(scheduleId);
    if (!items || items.length === 0) continue;
    // Show the schedule's START time — that's when the parent needs the
    // checklist items in hand. (End-time was the previous default; users
    // read it as "how long until pickup" which doesn't match the eyebrow.)
    const dueLabel = formatHhmm(occ.startMinutes);
    const bucket = childIdToItems.get(occ.childId) ?? [];
    for (const item of items) {
      bucket.push({ item, dueLabel });
    }
    childIdToItems.set(occ.childId, bucket);
  }
  // Sort each bucket by sortOrder then id (stable within schedule's items list).
  for (const bucket of childIdToItems.values()) {
    bucket.sort((a, b) => {
      if (a.item.sortOrder !== b.item.sortOrder) return a.item.sortOrder - b.item.sortOrder;
      return a.item.id - b.item.id;
    });
  }
  return children
    .map((kid) => ({ kid, items: childIdToItems.get(kid.id) ?? [] }))
    .filter((g) => g.items.length > 0);
}

function formatHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function SectionHeader({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerLabel}>{label}</Text>
      <Text style={styles.headerCount}>
        {done}/{total}
      </Text>
    </View>
  );
}

function ChecklistSectionImpl(): React.ReactElement {
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const itemsByScheduleId = useChecklistStore((s) => s.itemsByScheduleId);
  const currentDate = useUiStore((s) => s.currentDate);

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
    () => buildGroups(children, occurrencesToday, itemsByScheduleId),
    [children, occurrencesToday, itemsByScheduleId],
  );

  const flatItems = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.item)), [groups]);
  const total = flatItems.length;
  const done = flatItems.filter((i) => i.isDone).length;

  const onToggle = async (itemId: number): Promise<void> => {
    const db = await getDb();
    await useChecklistStore.getState().toggleDone(db, itemId);
  };

  return (
    <View testID="checklist-section">
      <SectionHeader label="준비물" done={done} total={total} />
      <View style={styles.card}>
        {groups.map((group, idx) => {
          const palette = getKidPalette(group.kid.colorIndex);
          const remaining = group.items.filter((i) => !i.item.isDone).length;
          return (
            <Fragment key={group.kid.id}>
              {idx > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.kidRow}>
                <KidAvatar child={group.kid} size={30} />
                <Text style={styles.kidName}>{group.kid.name}</Text>
                <Text style={styles.kidRemaining}>
                  {remaining}/{group.items.length} 남음
                </Text>
              </View>
              {group.items.map(({ item, dueLabel }) => {
                const isDone = item.isDone;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      void onToggle(item.id);
                    }}
                    style={[styles.itemRow, isDone ? styles.itemRowDone : null]}
                    testID={`checklist-item-${item.id}`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isDone
                          ? { backgroundColor: palette.source, borderColor: palette.source }
                          : styles.checkboxIdle,
                      ]}
                    >
                      {isDone ? <IconCheck size={12} color="#fff" /> : null}
                    </View>
                    <Text style={[styles.itemLabel, isDone ? styles.itemLabelDone : null]}>
                      {item.label}
                    </Text>
                    {dueLabel !== null ? (
                      <View style={styles.duePill}>
                        <Text style={styles.duePillText}>{dueLabel}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

export const ChecklistSection = memo(ChecklistSectionImpl);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingTop: 14,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  headerLabel: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: TOKENS.ink,
  },
  headerCount: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 11,
    fontWeight: '400',
    color: TOKENS.inkSub,
  },
  card: {
    backgroundColor: TOKENS.surface,
    borderRadius: 18,
    padding: 6,
    marginBottom: 16,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: TOKENS.hair,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  kidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingRight: 10,
    paddingBottom: 4,
    paddingLeft: 10,
  },
  kidName: {
    fontFamily: FONT_FAMILIES.pretendardBold,
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  kidRemaining: {
    marginLeft: 'auto',
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 10,
    fontWeight: '400',
    color: TOKENS.inkSub,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  itemRowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxIdle: {
    backgroundColor: TOKENS.surface,
    borderColor: TOKENS.ink30,
  },
  itemLabel: {
    flex: 1,
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 13,
    fontWeight: '400',
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  itemLabelDone: {
    textDecorationLine: 'line-through',
  },
  duePill: {
    backgroundColor: TOKENS.ink04,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 99,
  },
  duePillText: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 10,
    fontWeight: '400',
    color: TOKENS.inkSub,
  },
});
