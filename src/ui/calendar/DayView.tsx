// Day view — ADR-007 §4: one column per kid plus the guardian column on the
// shared TimeGrid. Overlaps inside a column stack via layoutCascade.
// Guardian events come from the device calendar (ADR-008) and fill the last
// column in the guardian grey.

import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { cascadeStep, clipToDay, layoutCascade } from '../../domain/layout';
import type { GuardianOccurrence } from '../../domain/guardian';
import type { Child, Occurrence } from '../../domain/types';
import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import { getKidPalette, TOKENS } from '../palette';
import { fmtRange } from '../utils/date';
import { AllDayRow, type AllDayItem } from './AllDayRow';
import { TimeBlock } from './TimeBlock';
import { TimeGrid } from './TimeGrid';
import { DEFAULT_HOUR_HEIGHT, initialScrollY, ongoingStart } from './time-axis';

/** Horizontal step for each cascade level. */
const INDENT = 22;
/** Shortest block that still shows its title. */
const MIN_BLOCK_H = 20;
/** Floating dock clearance below 24:00. */
const DOCK_CLEARANCE = 96;

interface Props {
  kids: readonly Child[];
  occurrences: readonly Occurrence[];
  /** Minutes-from-midnight when the shown day is today, else null. */
  nowMinutes: number | null;
  /** People switched off in the filter. */
  inactive: readonly PersonKey[];
  /** Changes when the shown day changes — re-applies the opening scroll. */
  scrollKey: string;
  /** Opening vertical offset (a day strip keeps pages in step); default = now / first event. */
  openAt?: number;
  onScrollEndY?: (y: number) => void;
  testID?: string;
  onPressOccurrence: (occ: Occurrence) => void;
  /** Long press on an empty slot: the column's person and the pressed time. */
  onLongPressSlot?: (person: PersonKey, minutes: number) => void;
  /** This day's guardian (device calendar) events. */
  guardianEvents?: readonly GuardianOccurrence[];
  onPressGuardian?: (ev: GuardianOccurrence) => void;
}

type Placed =
  | { kind: 'kid'; occ: Occurrence }
  | { kind: 'guardian'; g: GuardianOccurrence };

function DayViewImpl({
  kids,
  occurrences,
  nowMinutes,
  inactive,
  scrollKey,
  openAt: openAtProp,
  onScrollEndY,
  testID = 'day-view',
  onPressOccurrence,
  onLongPressSlot,
  guardianEvents = [],
  onPressGuardian,
}: Props): React.ReactElement {
  const columnOfKid = useMemo(() => new Map(kids.map((k, i) => [k.id, i])), [kids]);
  const columns = kids.length + 1; // + guardian
  const everyone = useMemo<PersonKey[]>(() => [...kids.map((k) => k.id), 'guardian'], [kids]);

  const guardianColumn = kids.length;
  const placed = useMemo(() => {
    const byId = new Map<string, Placed>();
    const inputs = [];
    for (const occ of occurrences) {
      if (occ.allDay) continue; // drawn in the all-day row
      const column = columnOfKid.get(occ.childId);
      if (column === undefined) continue;
      const range = clipToDay(occ.startMinutes, occ.endMinutes);
      if (range === null) continue;
      const id = `${occ.scheduleId}`;
      byId.set(id, { kind: 'kid', occ });
      inputs.push({ id, column, start: range.start, end: range.end });
    }
    for (const g of guardianEvents) {
      if (g.allDay) continue;
      const range = clipToDay(g.startMinutes, g.endMinutes);
      if (range === null) continue;
      const id = `g:${g.key}`;
      byId.set(id, { kind: 'guardian', g });
      inputs.push({ id, column: guardianColumn, start: range.start, end: range.end });
    }
    return layoutCascade(inputs).map((p) => ({ ...p, item: byId.get(p.id) as Placed }));
  }, [occurrences, columnOfKid, guardianEvents, guardianColumn]);

  const allDayItems = useMemo<AllDayItem[]>(() => {
    const out: AllDayItem[] = [];
    for (const occ of occurrences) {
      if (!occ.allDay) continue;
      const column = columnOfKid.get(occ.childId);
      const kid = column === undefined ? undefined : kids[column];
      if (column === undefined || kid === undefined) continue;
      const p = getKidPalette(occ.colorIndex);
      const emphasis = emphasisOf(inactive, everyone, kid.id);
      out.push({
        id: `${occ.scheduleId}`,
        column,
        title: occ.title,
        color: p.source,
        deep: p.deep,
        focused: emphasis === 'solo',
        dimmed: emphasis === 'inactive',
        accessibilityLabel: `${kid.name} ${occ.title}, 하루 종일`,
        onPress: () => onPressOccurrence(occ),
      });
    }
    const gEmphasis = emphasisOf(inactive, everyone, 'guardian');
    for (const g of guardianEvents) {
      if (!g.allDay) continue;
      out.push({
        id: `g:${g.key}`,
        column: guardianColumn,
        title: g.title,
        color: TOKENS.guardian,
        deep: TOKENS.guardianDeep,
        focused: gEmphasis === 'solo',
        dimmed: gEmphasis === 'inactive',
        accessibilityLabel: `보호자 ${g.title}, 하루 종일`,
        onPress: () => onPressGuardian?.(g),
      });
    }
    return out;
  }, [occurrences, columnOfKid, kids, inactive, everyone, onPressOccurrence, guardianEvents, guardianColumn, onPressGuardian]);

  const timed = [...occurrences.filter((o) => !o.allDay), ...guardianEvents.filter((g) => !g.allDay)];
  const firstStart = timed.length > 0 ? Math.min(...timed.map((o) => o.startMinutes)) : null;
  const openAt = openAtProp ?? initialScrollY({
      hourHeight: DEFAULT_HOUR_HEIGHT,
      nowMinutes,
      firstStart,
      ongoingStart: ongoingStart(timed, nowMinutes),
    });

  return (
    <View style={styles.root}>
      <AllDayRow columns={columns} items={allDayItems} />
      <TimeGrid
        testID={testID}
        columns={columns}
        hourHeight={DEFAULT_HOUR_HEIGHT}
        nowMinutes={nowMinutes}
        initialScrollY={openAt}
        scrollKey={scrollKey}
        onScrollEndY={onScrollEndY}
        bottomInset={DOCK_CLEARANCE}
        onLongPressSlot={
          onLongPressSlot === undefined
            ? undefined
            : (column, minutes) => onLongPressSlot(kids[column]?.id ?? 'guardian', minutes)
        }
        draftColorOf={(column) => {
          const kid = kids[column];
          if (kid === undefined) return { color: TOKENS.guardian, deep: TOKENS.guardianDeep };
          const p = getKidPalette(kid.colorIndex);
          return { color: p.source, deep: p.deep };
        }}
        renderColumns={({ columnWidth, y }) =>
          placed.map(({ id, column, start, end, level, depth, item }) => {
            const top = y(start) + 1;
            const indent = level * cascadeStep(columnWidth, depth, INDENT);
            const height = Math.max(y(end) - y(start) - 2, MIN_BLOCK_H);
            const compact = columns >= 5; // 5+ columns → week-style compact blocks
            const showTime = columns < 5 || columnWidth >= 64; // time only if it fits
            if (item.kind === 'guardian') {
              const g = item.g;
              const emphasis = emphasisOf(inactive, everyone, 'guardian');
              return (
                <TimeBlock
                  key={id}
                  testID={`${testID === 'day-view' ? 'day-block' : `${testID}-block`}-${id}`}
                  top={top}
                  left={column * columnWidth + 2 + indent}
                  width={columnWidth - 4 - indent}
                  height={height}
                  level={level}
                  title={g.title}
                  startMinutes={g.startMinutes}
                  endMinutes={g.endMinutes}
                  color={TOKENS.guardian}
                  deep={TOKENS.guardianDeep}
                  focused={emphasis === 'solo'}
                  dimmed={emphasis === 'inactive'}
                  compact={compact}
                  showTime={showTime}
                  accessibilityLabel={`보호자 ${g.title}, ${fmtRange(g.startMinutes, g.endMinutes)}`}
                  onPress={onPressGuardian === undefined ? undefined : () => onPressGuardian(g)}
                />
              );
            }
            const occ = item.occ;
            const kid = kids[column];
            if (kid === undefined) return null;
            const palette = getKidPalette(occ.colorIndex);
            const emphasis = emphasisOf(inactive, everyone, kid.id);
            return (
              <TimeBlock
                key={id}
                testID={`${testID === 'day-view' ? 'day-block' : `${testID}-block`}-${id}`}
                top={top}
                left={column * columnWidth + 2 + indent}
                width={columnWidth - 4 - indent}
                height={height}
                level={level}
                title={occ.title}
                startMinutes={occ.startMinutes}
                endMinutes={occ.endMinutes}
                color={palette.source}
                deep={palette.deep}
                focused={emphasis === 'solo'}
                dimmed={emphasis === 'inactive'}
                needsPickup={occ.needsPickup}
                compact={compact}
                showTime={showTime}
                accessibilityLabel={`${kid.name} ${occ.title}, ${fmtRange(occ.startMinutes, occ.endMinutes)}${level > 0 ? ', 다른 일정과 시간이 겹침' : ''}`}
                onPress={() => onPressOccurrence(occ)}
              />
            );
          })
        }
      />
    </View>
  );
}

export const DayView = memo(DayViewImpl);

const styles = StyleSheet.create({
  root: { flex: 1 },
});
