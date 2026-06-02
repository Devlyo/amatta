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

import type { Child, Occurrence } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import { KIND_ICON } from '../icons';
import {
  getKidPalette,
  TOKENS,
  type KidPalette,
} from '../palette';
import { fmt12hrShort } from '../utils/date';

const SLOT_H = 32;
const SLOT_MIN = 30;
const TIME_START_MIN = 6 * 60;
const TIME_END_MIN = 23 * 60;
const TOTAL_SLOTS = (TIME_END_MIN - TIME_START_MIN) / SLOT_MIN; // 34
const GRID_H = SLOT_H * TOTAL_SLOTS; // 1088
const GUTTER = 40;
const HOUR_COUNT = 18; // 06:00 .. 23:00 inclusive in the gutter
const HOUR_H = SLOT_H * 2; // 64

interface Props {
  kids: Child[]; // ordered left-to-right
  occurrences: Occurrence[]; // already filtered to today
  nowMinutes: number; // minutes since midnight, local time
  onBlockPress: (occ: Occurrence) => void;
}

export function ScheduleGrid({
  kids,
  occurrences,
  nowMinutes,
  onBlockPress,
}: Props): React.ReactElement {
  const scrollRef = useRef<ScrollView | null>(null);
  const showNow = nowMinutes >= TIME_START_MIN && nowMinutes <= TIME_END_MIN;
  const nowTop = ((nowMinutes - TIME_START_MIN) / SLOT_MIN) * SLOT_H;

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

  // Smart-scroll on mount: top - 110 (mirrors the prototype's first effect).
  useEffect(() => {
    if (!showNow || scrollRef.current === null) return;
    scrollRef.current.scrollTo({ y: Math.max(0, nowTop - 110), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.outer}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ height: GRID_H }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {/* ── Gutter ─────────────────────────────────────────────── */}
          <View style={styles.gutter}>
            {Array.from({ length: HOUR_COUNT }).map((_, i) => {
              const hour = 6 + i;
              const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
              const ap = hour < 12 ? 'AM' : 'PM';
              return (
                <View
                  key={hour}
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
  onPress: () => void;
}

function ScheduleBlockDaily({ occ, palette, onPress }: BlockProps): React.ReactElement {
  const slotIndex = (occ.startMinutes - TIME_START_MIN) / SLOT_MIN;
  const span = (occ.endMinutes - occ.startMinutes) / SLOT_MIN;
  const top = slotIndex * SLOT_H + 1;
  const height = span * SLOT_H - 2;
  const KindIcon = KIND_ICON[occ.type];

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
          <KindIcon size={13} color={TOKENS.ink} />
        </View>
        <Text style={styles.blockTitle} numberOfLines={1} ellipsizeMode="tail">
          {occ.title}
        </Text>
        {/* TODO(v2-schema): pickup pill (7px primary dot with 2px halo
            shadow) requires `needs_pickup` boolean which lands in v2. */}
      </View>
      <Text style={styles.blockTime}>
        {fmt12hrShort(occ.startMinutes)}–{fmt12hrShort(occ.endMinutes)}
      </Text>
      {height > 64 && place ? (
        <Text style={styles.blockPlace} numberOfLines={1} ellipsizeMode="tail">
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

const NOW_YELLOW = '#E0E345';

const styles = StyleSheet.create({
  outer: { flex: 1 },
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
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
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 12,
  },
  hourAp: {
    fontSize: 8,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink30,
    letterSpacing: 0.4,
    lineHeight: 9,
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
    borderRadius: 8,
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
    gap: 4,
  },
  blockIconWrap: {
    opacity: 0.85,
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
  blockTime: {
    fontSize: 10,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 12,
  },
  blockPlace: {
    fontSize: 10,
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
    paddingVertical: 2,
    borderRadius: 9999,
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
    fontSize: 10.5,
    color: '#1d1d1b',
    lineHeight: 12,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: NOW_YELLOW,
    borderRadius: 1,
  },
});
