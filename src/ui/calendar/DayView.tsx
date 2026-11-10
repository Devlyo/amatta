// Day view — ADR-007 §4: one column per kid plus the guardian column on the
// shared TimeGrid. Overlaps inside a column stack via layoutCascade.
// Guardian (iPhone Calendar) events arrive in Phase 5; the column is already
// laid out so the grid does not reflow when they do.

import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { cascadeStep, clipToDay, layoutCascade } from '../../domain/layout';
import type { Child, Occurrence } from '../../domain/types';
import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import { getKidPalette, TOKENS } from '../palette';
import { fmtRange } from '../utils/date';
import { AllDayRow, type AllDayItem } from './AllDayRow';
import { TimeBlock } from './TimeBlock';
import { TimeGrid } from './TimeGrid';
import { DEFAULT_HOUR_HEIGHT, initialScrollY } from './time-axis';

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
  onPressOccurrence: (occ: Occurrence) => void;
  /** Long press on an empty slot: the column's person and the pressed time. */
  onLongPressSlot?: (person: PersonKey, minutes: number) => void;
}

function DayViewImpl({
  kids,
  occurrences,
  nowMinutes,
  inactive,
  scrollKey,
  onPressOccurrence,
  onLongPressSlot,
}: Props): React.ReactElement {
  const columnOfKid = useMemo(() => new Map(kids.map((k, i) => [k.id, i])), [kids]);
  const columns = kids.length + 1; // + guardian
  const everyone = useMemo<PersonKey[]>(() => [...kids.map((k) => k.id), 'guardian'], [kids]);

  const placed = useMemo(() => {
    const byId = new Map<string, Occurrence>();
    const inputs = [];
    for (const occ of occurrences) {
      if (occ.allDay) continue; // drawn in the all-day row
      const column = columnOfKid.get(occ.childId);
      if (column === undefined) continue;
      const range = clipToDay(occ.startMinutes, occ.endMinutes);
      if (range === null) continue;
      const id = `${occ.scheduleId}`;
      byId.set(id, occ);
      inputs.push({ id, column, start: range.start, end: range.end });
    }
    return layoutCascade(inputs).map((p) => ({ ...p, occ: byId.get(p.id) as Occurrence }));
  }, [occurrences, columnOfKid]);

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
    return out;
  }, [occurrences, columnOfKid, kids, inactive, everyone, onPressOccurrence]);

  const timed = occurrences.filter((o) => !o.allDay);
  const firstStart = timed.length > 0 ? Math.min(...timed.map((o) => o.startMinutes)) : null;
  const openAt = initialScrollY({ hourHeight: DEFAULT_HOUR_HEIGHT, nowMinutes, firstStart });

  return (
    <View style={styles.root}>
      <AllDayRow columns={columns} items={allDayItems} />
      <TimeGrid
        testID="day-view"
        columns={columns}
        hourHeight={DEFAULT_HOUR_HEIGHT}
        nowMinutes={nowMinutes}
        initialScrollY={openAt}
        scrollKey={scrollKey}
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
          placed.map(({ id, column, start, end, level, depth, occ }) => {
            const kid = kids[column];
            if (kid === undefined) return null;
            const palette = getKidPalette(occ.colorIndex);
            const emphasis = emphasisOf(inactive, everyone, kid.id);
            const top = y(start) + 1;
            const indent = level * cascadeStep(columnWidth, depth, INDENT);
            return (
              <TimeBlock
                key={id}
                testID={`day-block-${id}`}
                top={top}
                left={column * columnWidth + 2 + indent}
                width={columnWidth - 4 - indent}
                height={Math.max(y(end) - y(start) - 2, MIN_BLOCK_H)}
                level={level}
                title={occ.title}
                startMinutes={occ.startMinutes}
                endMinutes={occ.endMinutes}
                color={palette.source}
                deep={palette.deep}
                focused={emphasis === 'solo'}
                dimmed={emphasis === 'inactive'}
                needsPickup={occ.needsPickup}
              // 5+ columns (many kids) → week-style compact blocks; time only if it fits.
              compact={columns >= 5}
              showTime={columns < 5 || columnWidth >= 64}
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
