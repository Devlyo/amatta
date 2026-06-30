// 1:1 port of ScheduleB in docs/design/amatta-v1/app-daily-b.jsx:483–637.
//
// Tokens:
//   slotH    = 32         (per 30-min slot — hour = 64px)
//   GUTTER   = 40         (left time column)
//   total    = 18 hours visualised (06:00..23:00 = 18 marks; 34 slots)
//   gridH    = slotH * totalSlots = 32 * 34 = 1088
//
// Body container: padding '0 12px', height gridH, CSS grid (mapped to flex row
// with a 40px gutter and N children with flex:1).
//
// Gutter labels:
//   - hour number: 11/400/Pretendard inkSub
//   - AM/PM:       8/400/Geist Mono ink30, letterSpacing 0.4
//   stacked, right-aligned at `right: 5px`, `top: i * slotH * 2 - 6`.
//
// Kid columns:
//   borderLeft 1px hair, position relative.
//   18 horizontal hairline rules at `top: i * 64`, height 1, hair, opacity .7.
//
// Block per event:
//   absolute, left 3, right 3, top = slotIndex * slotH + 1, height = span - 2,
//   background palette.bg, borderRadius 8, boxShadow: 'inset 0 0 0 1px pal.dot'
//   → borderWidth: 1, borderColor: pal.dot. Padding '6 7 5'. Column flex,
//   gap 1, overflow hidden.
//   Title row: 12/600 (SemiBold) ink, letterSpacing -0.2, gap 4. Icon=13 ink
//   opacity .85; title flex:1 ellipsize. (pickup dot SKIPPED — needs_pickup
//   not in v1 schema.)
//   Time row: 10/400 inkSub fmt12hrShort(start)–fmt12hrShort(end).
//   Place row: only when block height > 64 — 10/400 inkSub, marginTop auto,
//   ellipsize.
//
// Now line:
//   absolute left 0, right 12, top = nowTop, row, alignItems: center.
//   Pill: bg #E0E345, color #1d1d1b, 10.5/600 (SemiBold), padding '2 7',
//   radius 99, shadow '0 2px 6px rgba(224,227,69,0.55)', marginLeft 10,
//   marginRight -2.
//   Pill text: h12:mm (no AM/PM suffix).
//   Line: flex 1, height 1.5, bg #E0E345, radius 1.

import { useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GRID_END_HOUR, GRID_START_HOUR, SLOT_MIN } from '../../domain/constants';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import { KIND_ICON } from '../icons';
import {
  getKidPalette,
  TOKENS,
  type KidPalette,
} from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { fmt12hrShort, todayIso } from '../utils/date';

const SLOT_H = 32;
// Derived from domain constants — GRID_END_HOUR may exceed 23 (e.g. 25 =
// 1 AM next day) so the gutter wraps via `hour % 24` at render time.
const TIME_START_MIN = GRID_START_HOUR * 60;
const TIME_END_MIN = GRID_END_HOUR * 60;
const TOTAL_SLOTS = (TIME_END_MIN - TIME_START_MIN) / SLOT_MIN;
const GRID_H = SLOT_H * TOTAL_SLOTS;
const GUTTER = 40;
const HOUR_COUNT = GRID_END_HOUR - GRID_START_HOUR; // hour-label rows
const HOUR_H = SLOT_H * 2; // 64
// Was 120 (BottomDock clearance); user wants the scroll content to end
// flush at the last hour with no trailing gap, matching WeeklyGrid.
const SCROLL_BOTTOM_PAD = 0;

interface Props {
  kids: Child[]; // ordered left-to-right
  occurrences: Occurrence[]; // already filtered to today
  nowMinutes: number; // minutes since midnight, local time
  currentDate: ISODate; // for today-vs-other-day smart-scroll branching
  onBlockPress: (occ: Occurrence) => void;
}

export function ScheduleGrid({
  kids,
  occurrences,
  nowMinutes,
  currentDate,
  onBlockPress,
}: Props): React.ReactElement {
  const scrollRef = useRef<ScrollView | null>(null);
  const showNow = nowMinutes >= TIME_START_MIN && nowMinutes <= TIME_END_MIN;
  const nowTop = ((nowMinutes - TIME_START_MIN) / SLOT_MIN) * SLOT_H;
  // At the 4-kid cap each column is ~1/4 wide, so shrink the block's inner
  // text one notch to keep titles readable instead of clipping to one char.
  const compact = kids.length >= 4;

  // Bucket occurrences by childId for column rendering.
  const eventsByChild = useMemo(() => {
    const map = new Map<number, Occurrence[]>();
    for (const occ of occurrences) {
      const list = map.get(occ.childId);
      if (list === undefined) map.set(occ.childId, [occ]);
      else list.push(occ);
    }
    return map;
  }, [occurrences]);

  // Smart-scroll: today → keep NOW visible. Other dates → bring the first
  // occurrence of the day into view. Re-fires on currentDate change so a
  // swipe to a new day jumps to that day's first event.
  useEffect(() => {
    if (scrollRef.current === null) return;
    const isToday = (currentDate as unknown as string) === (todayIso() as unknown as string);
    let targetY = 0;
    if (isToday && showNow) {
      targetY = Math.max(0, nowTop - 110);
    } else if (occurrences.length > 0) {
      // Earliest start time of the day. Subtract 60px so the first event has
      // a little breathing room above it.
      let earliest = Number.POSITIVE_INFINITY;
      for (const occ of occurrences) {
        if (occ.startMinutes < earliest) earliest = occ.startMinutes;
      }
      if (Number.isFinite(earliest)) {
        const firstTop = ((earliest - TIME_START_MIN) / SLOT_MIN) * SLOT_H;
        targetY = Math.max(0, firstTop - 60);
      }
    }
    scrollRef.current.scrollTo({ y: targetY, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  return (
    <View style={styles.outer}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ height: GRID_H + SCROLL_BOTTOM_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {/* ── Gutter ─────────────────────────────────────────────── */}
          <View style={styles.gutter}>
            {/* HOUR_COUNT + 1 so the final hour-line (i = HOUR_COUNT,
                rawHour = GRID_END_HOUR) gets a label too — without the
                +1 the 1 AM cap of the extended grid had no gutter text. */}
            {Array.from({ length: HOUR_COUNT + 1 }).map((_, i) => {
              const rawHour = GRID_START_HOUR + i;
              // Wrap past midnight: 24 → 0 (AM), 25 → 1 (AM).
              const hour = rawHour % 24;
              const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
              const ap = hour < 12 ? 'AM' : 'PM';
              return (
                <View
                  key={rawHour}
                  style={[styles.hourLabel, { top: i * HOUR_H - 6 }]}
                >
                  <Text style={styles.hourNum}>{h12}</Text>
                  <Text style={styles.hourAp}>{ap}</Text>
                </View>
              );
            })}
          </View>

          {/* ── Kid columns ────────────────────────────────────────── */}
          {kids.map((k) => {
            const palette = getKidPalette(k.colorIndex);
            const events = eventsByChild.get(k.id) ?? [];
            return (
              <View key={k.id} style={styles.col}>
                {/* hourly hairlines */}
                {Array.from({ length: HOUR_COUNT }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.hairLine, { top: i * HOUR_H }]}
                  />
                ))}
                {events.map((ev) => (
                  <ScheduleBlockDaily
                    key={`${ev.scheduleId}-${ev.date as unknown as string}`}
                    occ={ev}
                    palette={palette}
                    compact={compact}
                    onPress={() => onBlockPress(ev)}
                  />
                ))}
              </View>
            );
          })}

          {/* ── Now line ───────────────────────────────────────────── */}
          {showNow ? <NowLine top={nowTop} nowMinutes={nowMinutes} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Schedule block
// ─────────────────────────────────────────────────────────────────────────

interface BlockProps {
  occ: Occurrence;
  palette: KidPalette;
  compact: boolean;
  onPress: () => void;
}

function ScheduleBlockDaily({ occ, palette, compact, onPress }: BlockProps): React.ReactElement {
  const slotIndex = (occ.startMinutes - TIME_START_MIN) / SLOT_MIN;
  const span = (occ.endMinutes - occ.startMinutes) / SLOT_MIN;
  const top = slotIndex * SLOT_H + 1;
  const height = span * SLOT_H - 2;
  const KindIcon = KIND_ICON[occ.type];

  // Short block (≤ 1 slot / ≤30 min): drop the time row and scale the title
  // font proportionally to the block's true duration down to a 6px floor, so a
  // cramped block stays legible without clipping or overlapping its neighbour.
  const isShort = span <= 1;
  const frac = Math.max(0, Math.min(1, (occ.endMinutes - occ.startMinutes) / SLOT_MIN));
  const shortFontSize = Math.max(6, Math.round(6 + (12 - 6) * frac)); // floor 6 → full 12

  // The schedule occurrence has no `location` (the v1 prototype's `place`).
  // Schedule.location lives on the source Schedule row — `Occurrence` derived
  // from `expandOccurrences()` drops it. R3 will plumb `location` through.
  // For now: render the place row when block is tall enough but show '' —
  // visually identical to a block without a place.
  // TODO(R3-occurrences): thread `location` through Occurrence so the place
  // row matches amatta-v1 ("교실", "센터수영장", etc.).
  const place = '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${occ.title} 일정`}
      style={[
        styles.block,
        {
          top,
          height,
          backgroundColor: palette.bg,
          borderColor: palette.source,
        },
      ]}
    >
      <View style={styles.blockTitleRow}>
        <View style={styles.blockIconWrap}>
          <KindIcon size={compact ? 11 : 13} color={TOKENS.ink} />
        </View>
        <Text
          style={[
            styles.blockTitle,
            compact ? styles.blockTextCompact : null,
            isShort ? { fontSize: shortFontSize, lineHeight: shortFontSize + 2 } : null,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {occ.title}
        </Text>
        {occ.needsPickup ? <View style={styles.pickupDot} /> : null}
        {/* TODO(EAS-dev-build): add 2px white outline ring (boxShadow inset)
            when react-native-svg works in our Expo Go binary. */}
      </View>
      {/* Short blocks show title only (no room for the time row). */}
      {isShort ? null : (
        <Text style={[styles.blockTime, compact ? styles.blockTextCompact : null]}>
          {fmt12hrShort(occ.startMinutes)}–{fmt12hrShort(occ.endMinutes)}
        </Text>
      )}
      {height > 64 && place ? (
        <Text
          style={[styles.blockPlace, compact ? styles.blockTextCompact : null]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {place}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Now line
// ─────────────────────────────────────────────────────────────────────────

interface NowProps {
  top: number;
  nowMinutes: number;
}

// Pill is ~18px tall (paddingVertical 2 × 2 + label lineHeight 12 + a hair).
// We want the LINE's vertical center to land exactly at `top` (the px
// derived from current minutes), so we shift the whole row up by half the
// pill height. Mirrors app-multi-grid.jsx's `top: nowY - 9` pattern, which
// is the corrected version from the same prototype suite.
const NOW_ROW_H = 18;
const NOW_OFFSET = NOW_ROW_H / 2;

function NowLine({ top, nowMinutes }: NowProps): React.ReactElement {
  const h = Math.floor(nowMinutes / 60);
  const m = nowMinutes % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const label = `${h12}:${String(m).padStart(2, '0')}`;
  return (
    <View
      pointerEvents="none"
      style={[styles.nowWrap, { top: top - NOW_OFFSET, height: NOW_ROW_H }]}
    >
      <View style={styles.nowPill}>
        <Text style={styles.nowPillLabel}>{label}</Text>
      </View>
      <View style={styles.nowLine} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────

const NOW_YELLOW = TOKENS.nowLine;

const styles = StyleSheet.create({
  outer: { flex: 1 },
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    height: GRID_H,
    position: 'relative',
  },

  // Gutter (left time column)
  gutter: {
    width: GUTTER,
    position: 'relative',
  },
  hourLabel: {
    position: 'absolute',
    right: 5,
    alignItems: 'flex-end',
  },
  hourNum: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 12,
  },
  hourAp: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink30,
    letterSpacing: 0.4,
    lineHeight: 14,
  },

  // Kid column
  col: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: TOKENS.hair,
  },
  hairLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: TOKENS.hair,
    opacity: 0.7,
  },

  // Block
  block: {
    position: 'absolute',
    left: 3,
    right: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1, // inset 0 0 0 1px palette.source
    paddingTop: 6,
    paddingRight: 7,
    paddingBottom: 5,
    paddingLeft: 7,
    overflow: 'hidden',
    // gap: 1 between rows
    gap: 1,
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  blockIconWrap: {
    opacity: 0.85,
  },
  // 4-kid compact override (fontSize one notch down). lineHeights on the base
  // styles (14/12) already exceed 10 so there is no clipping.
  blockTextCompact: {
    fontSize: 10,
  },
  blockTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendardSemiBold, // 600 (prototype tail also has fontWeight:500; SemiBold reads as the intended title weight)
    color: TOKENS.ink,
    letterSpacing: -0.2,
    lineHeight: 14,
  },
  pickupDot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.primary,
    marginLeft: SPACING.xs,
  },
  blockTime: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 12,
  },
  blockPlace: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    marginTop: 'auto',
    lineHeight: 12,
  },

  // Now line
  nowWrap: {
    position: 'absolute',
    left: 0,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 4,
  },
  nowPill: {
    backgroundColor: NOW_YELLOW,
    paddingHorizontal: 7,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
    marginLeft: 10,
    marginRight: -2,
    // boxShadow: '0 2px 6px rgba(224,227,69,0.55)'
    shadowColor: NOW_YELLOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 3,
  },
  nowPillLabel: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 12,
    color: TOKENS.ink,
    lineHeight: 12,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: NOW_YELLOW,
    borderRadius: 1, // hairline
  },
});
