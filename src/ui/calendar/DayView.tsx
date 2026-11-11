// Day view — ADR-007 §4: one column per kid plus the guardian column on the
// shared TimeGrid. Overlaps inside a column stack via layoutCascade.
// Guardian events come from the device calendar (ADR-008) and fill the last
// column in the guardian grey.

import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';

import { cascadeStep, clipToDay, layoutCascade } from '../../domain/layout';
import type { GuardianOccurrence } from '../../domain/guardian';
import type { Child, Occurrence } from '../../domain/types';
import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import { fanOutByMember } from '../../domain/occurrences';
import { fmtRange } from '../utils/date';
import { MemberFaces } from '../common/MemberFaces';
import { AllDayRow, type AllDayItem } from './AllDayRow';
import { DraggableBlock } from './DraggableBlock';
import { TimeBlock } from './TimeBlock';
import { TimeGrid } from './TimeGrid';
import { DEFAULT_HOUR_HEIGHT, initialScrollY, ongoingStart } from './time-axis';
import { makeStyles, useTheme } from '../appearance';

/** Horizontal step for each cascade level. */
const INDENT = 22;
/** Shortest block that still shows its title. */
const MIN_BLOCK_H = 20;
/** Floating dock clearance below 24:00. */
const DOCK_CLEARANCE = 96;

interface Props {
  /** 보호자 as a person (pill / column). False while 보호자 일정 is off in 설정. */
  guardian?: boolean;
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
  /** ADR-015: a block dragged to a new start (minutes delta). Resolve true when it moved. */
  onMoveOccurrence?: (occ: Occurrence, deltaMinutes: number) => Promise<boolean>;
}

type Placed =
  | { kind: 'kid'; occ: Occurrence }
  | { kind: 'guardian'; g: GuardianOccurrence }
  /** ADR-013: a WeMoa schedule the guardian joins, in the guardian column. */
  | { kind: 'shared'; occ: Occurrence };

/** Draw id: plain scheduleId for a one-kid schedule, else per person. */
export function copyId(occ: Occurrence, person: number | 'g'): string {
  return occ.memberIds !== undefined && (occ.memberIds.length > 1 || occ.withGuardian) ? `${occ.scheduleId}-${person}` : `${occ.scheduleId}`;
}

function DayViewImpl({
  kids: allKids,
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
  guardian = true,
  onPressGuardian,
  onMoveOccurrence,
}: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  // ADR-015: the block being dragged shows its new range live.
  const [preview, setPreview] = useState<{ id: string; d: number } | null>(null);
  // People switched off in the filter are hidden (no column, no blocks) —
  // only the people that are on share the width. Everyone off → every
  // column stays, empty.
  const everyone = useMemo<PersonKey[]>(() => guardian ? [...allKids.map((k) => k.id), 'guardian'] : allKids.map((k) => k.id), [allKids, guardian]);
  const noneOn = everyone.every((k) => inactive.includes(k));
  const kids = useMemo(
    () => (noneOn ? allKids : allKids.filter((k) => !inactive.includes(k.id))),
    [allKids, inactive, noneOn],
  );
  const showGuardian = guardian && (noneOn || !inactive.includes('guardian'));
  const columnOfKid = useMemo(
    () => new Map(noneOn ? [] : kids.map((k, i) => [k.id, i])),
    [kids, noneOn],
  );
  const columns = Math.max(1, kids.length + (showGuardian ? 1 : 0));
  const guardianEventsShown = useMemo(
    () => (showGuardian && !noneOn ? guardianEvents : []),
    [guardianEvents, showGuardian, noneOn],
  );

  const guardianColumn = kids.length;
  const kidsById = useMemo(() => new Map(allKids.map((k) => [k.id, k])), [allKids]);
  // ADR-013 view A: a copy in every member's column.
  const copies = useMemo(() => fanOutByMember(occurrences, kidsById), [occurrences, kidsById]);
  const sharedForGuardian = useMemo(
    () => (showGuardian && !noneOn ? occurrences.filter((o) => o.withGuardian === true) : []),
    [occurrences, showGuardian, noneOn],
  );
  const facesOf = (occ: Occurrence): React.ReactNode => {
    const ids = occ.memberIds ?? [occ.childId];
    if (ids.length + (occ.withGuardian ? 1 : 0) < 2) return null;
    const members = ids.map((id) => kidsById.get(id)).filter((k): k is Child => k !== undefined);
    return <MemberFaces kids={members} withGuardian={occ.withGuardian === true} size={16} />;
  };
  const placed = useMemo(() => {
    const byId = new Map<string, Placed>();
    const inputs = [];
    for (const occ of copies) {
      if (occ.allDay) continue; // drawn in the all-day row
      const column = columnOfKid.get(occ.childId);
      if (column === undefined) continue;
      const range = clipToDay(occ.startMinutes, occ.endMinutes);
      if (range === null) continue;
      const id = copyId(occ, occ.childId);
      byId.set(id, { kind: 'kid', occ });
      inputs.push({ id, column, start: range.start, end: range.end });
    }
    for (const occ of sharedForGuardian) {
      if (occ.allDay) continue;
      const range = clipToDay(occ.startMinutes, occ.endMinutes);
      if (range === null) continue;
      const id = copyId(occ, 'g');
      byId.set(id, { kind: 'shared', occ });
      inputs.push({ id, column: guardianColumn, start: range.start, end: range.end });
    }
    for (const g of guardianEventsShown) {
      if (g.allDay) continue;
      const range = clipToDay(g.startMinutes, g.endMinutes);
      if (range === null) continue;
      const id = `g:${g.key}`;
      byId.set(id, { kind: 'guardian', g });
      inputs.push({ id, column: guardianColumn, start: range.start, end: range.end });
    }
    return layoutCascade(inputs).map((p) => ({ ...p, item: byId.get(p.id) as Placed }));
  }, [copies, sharedForGuardian, columnOfKid, guardianEventsShown, guardianColumn]);

  const allDayItems = useMemo<AllDayItem[]>(() => {
    const out: AllDayItem[] = [];
    for (const occ of copies) {
      if (!occ.allDay) continue;
      const column = columnOfKid.get(occ.childId);
      const kid = column === undefined ? undefined : kids[column];
      if (column === undefined || kid === undefined) continue;
      const p = theme.kid(occ.colorIndex);
      const emphasis = emphasisOf(inactive, everyone, kid.id);
      out.push({
        id: copyId(occ, occ.childId),
        column,
        title: occ.title,
        color: p.source,
        deep: p.bar,
        focused: emphasis === 'solo',
        dimmed: emphasis === 'inactive',
        accessibilityLabel: `${kid.name} ${occ.title}, 하루 종일`,
        onPress: () => onPressOccurrence(occ),
      });
    }
    const gEmphasis = emphasisOf(inactive, everyone, 'guardian');
    for (const occ of sharedForGuardian) {
      if (!occ.allDay) continue;
      out.push({
        id: copyId(occ, 'g'),
        column: guardianColumn,
        title: occ.title,
        color: theme.t.guardian,
        deep: theme.t.guardianDeep,
        focused: gEmphasis === 'solo',
        dimmed: gEmphasis === 'inactive',
        accessibilityLabel: `보호자 ${occ.title}, 하루 종일`,
        onPress: () => onPressOccurrence(occ),
      });
    }
    for (const g of guardianEventsShown) {
      if (!g.allDay) continue;
      out.push({
        id: `g:${g.key}`,
        column: guardianColumn,
        title: g.title,
        color: theme.t.guardian,
        deep: theme.t.guardianDeep,
        focused: gEmphasis === 'solo',
        dimmed: gEmphasis === 'inactive',
        accessibilityLabel: `보호자 ${g.title}, 하루 종일`,
        onPress: () => onPressGuardian?.(g),
      });
    }
    return out;
  }, [copies, sharedForGuardian, columnOfKid, kids, inactive, everyone, onPressOccurrence, guardianEventsShown, guardianColumn, onPressGuardian, theme]);

  const timed = [...occurrences.filter((o) => !o.allDay), ...guardianEventsShown.filter((g) => !g.allDay)];
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
          if (kid === undefined) return { color: theme.t.guardian, deep: theme.t.guardianDeep };
          const p = theme.kid(kid.colorIndex);
          return { color: p.source, deep: p.bar };
        }}
        renderColumns={({ columnWidth, y }) =>
          placed.map(({ id, column, start, end, level, depth, item }) => {
            const top = y(start) + 1;
            const indent = level * cascadeStep(columnWidth, depth, INDENT);
            const height = Math.max(y(end) - y(start) - 2, MIN_BLOCK_H);
            const compact = columns >= 5; // 5+ columns → week-style compact blocks
            const showTime = columns < 5 || columnWidth >= 64; // time only if it fits
            const drag = (occ: Occurrence, block: React.ReactElement): React.ReactElement => (
              <DraggableBlock
                key={id}
                enabled={onMoveOccurrence !== undefined}
                startMinutes={occ.startMinutes}
                endMinutes={occ.endMinutes}
                pxPerMin={DEFAULT_HOUR_HEIGHT / 60}
                placeKey={`${occ.date as unknown as string}|${occ.startMinutes}|${occ.endMinutes}`}
                onPreview={(d) => setPreview(d === null ? null : { id, d })}
                onDrop={(d) => (onMoveOccurrence === undefined ? Promise.resolve(false) : onMoveOccurrence(occ, d))}
                testID={`${testID === 'day-view' ? 'day-block' : `${testID}-block`}-${id}`}
                slotTestID={`${testID === 'day-view' ? 'day-slot' : `${testID}-slot`}-${id}`}
                style={{ position: 'absolute', top, left: column * columnWidth + 2 + indent, width: columnWidth - 4 - indent, height, zIndex: level + 1 }}
              >
                {block}
              </DraggableBlock>
            );
            const shown = (occ: Occurrence): { s: number; e: number } => {
              const d = preview !== null && preview.id === id ? preview.d : 0;
              return { s: occ.startMinutes + d, e: occ.endMinutes + d };
            };
            if (item.kind === 'shared') {
              const occ = item.occ;
              const emphasis = emphasisOf(inactive, everyone, 'guardian');
              const t = shown(occ);
              return drag(
                occ,
                <TimeBlock
                  testID={`${testID === 'day-view' ? 'day-block' : `${testID}-block`}-${id}`}
                  top={0}
                  left={0}
                  width={columnWidth - 4 - indent}
                  height={height}
                  level={level}
                  title={occ.title}
                  startMinutes={t.s}
                  endMinutes={t.e}
                  color={theme.t.guardian}
                  guardian
                  deep={theme.t.guardianDeep}
                  focused={emphasis === 'solo'}
                  dimmed={emphasis === 'inactive'}
                  needsPickup={occ.needsPickup}
                  compact={compact}
                  showTime={showTime}
                  footer={facesOf(occ)}
                  accessibilityLabel={`보호자 ${occ.title}, ${fmtRange(occ.startMinutes, occ.endMinutes)}`}
                  onPress={() => onPressOccurrence(occ)}
                  holdToDrag={onMoveOccurrence !== undefined}
                />,
              );
            }
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
                  color={theme.t.guardian}
                  guardian
                  deep={theme.t.guardianDeep}
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
            const palette = theme.kid(occ.colorIndex);
            const emphasis = emphasisOf(inactive, everyone, kid.id);
            const t = shown(occ);
            return drag(
              occ,
              <TimeBlock
                testID={`${testID === 'day-view' ? 'day-block' : `${testID}-block`}-${id}`}
                top={0}
                left={0}
                width={columnWidth - 4 - indent}
                height={height}
                level={level}
                title={occ.title}
                startMinutes={t.s}
                endMinutes={t.e}
                color={palette.source}
                deep={palette.bar}
                focused={emphasis === 'solo'}
                dimmed={emphasis === 'inactive'}
                needsPickup={occ.needsPickup}
                compact={compact}
                showTime={showTime}
                footer={facesOf(occ)}
                accessibilityLabel={`${kid.name} ${occ.title}, ${fmtRange(occ.startMinutes, occ.endMinutes)}${level > 0 ? ', 다른 일정과 시간이 겹침' : ''}`}
                onPress={() => onPressOccurrence(occ)}
                holdToDrag={onMoveOccurrence !== undefined}
              />,
            );
          })
        }
      />
    </View>
  );
}

export const DayView = memo(DayViewImpl);

const useStyles = makeStyles((th) => ({
  root: { flex: 1 },
}));
