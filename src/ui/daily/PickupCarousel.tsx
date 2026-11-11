// PickupCarousel — horizontal pager of PickupCards. Spec §2.2.
//
// Renders nothing when there are no pickup cards (today and no pickups, or a
// non-today date) so the TopBar abuts the TabStrip and the slot collapses
// to zero height — matches the prototype branch when `PICKUPS=[]`.
//
// The amatta-v1 prototype uses pointer-drag math; we lean on RN's native
// `ScrollView pagingEnabled` for the same snap behavior with less custom
// gesture code (spec §2.2). Active-dot index comes from the current scroll
// offset divided by the viewport width captured on layout.

import { useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from 'react-native';

import type { GuardianOccurrence } from '../../domain/guardian';
import { guardianClashes, pickupsClash } from '../../domain/pickup-conflict';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { IconAlertCircle } from '../icons';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { fmt12hrShort, fmtRange } from '../utils/date';
import { PickupCard } from './PickupCard';
import { computePickupCards } from './pickup-data';
import { makeStyles, useTheme } from '../appearance';

interface Props {
  occurrences: Occurrence[];
  childrenById: Map<number, Child>;
  nowMinutes: number;
  currentDate: ISODate;
  pickupLogIsComplete: (scheduleId: number, occurrenceDateInt: number) => boolean;
  /** Today's guardian events — a clash with the shown pickup gets one line under the card. */
  guardianEvents?: readonly GuardianOccurrence[];
}

export function PickupCarousel({
  occurrences,
  childrenById,
  nowMinutes,
  currentDate,
  pickupLogIsComplete,
  guardianEvents = [],
}: Props): React.ReactElement | null {
  const theme = useTheme();
  const styles = useStyles();
  const [activeIdx, setActiveIdx] = useState(0);
  const [viewportW, setViewportW] = useState(0);

  const cards = computePickupCards(
    occurrences,
    pickupLogIsComplete,
    childrenById,
    nowMinutes,
    currentDate,
  );

  if (cards.length === 0) return null;

  const handleLayout = (e: LayoutChangeEvent): void => {
    setViewportW(e.nativeEvent.layout.width);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (viewportW === 0) return;
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / viewportW);
    if (next !== activeIdx) setActiveIdx(next);
  };

  return (
    <View style={styles.outer}>
      <View style={styles.viewport} onLayout={handleLayout}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {cards.map((card, i) => (
            <View
              key={`${card.scheduleId}-${card.occurrenceDateInt}`}
              style={[styles.slide, { width: viewportW }]}
            >
              <PickupCard data={card} index={i} />
            </View>
          ))}
        </ScrollView>

        {cards.length > 1 ? (
          <View style={styles.dotsRow} pointerEvents="none">
            {cards.map((c, i) => (
              <View
                key={`${c.scheduleId}-${c.occurrenceDateInt}`}
                style={[
                  styles.dot,
                  i === activeIdx ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
      {(() => {
        // Screen only — never a push (ADR-007 owner decision, ADR-002/003).
        const card = cards[Math.min(activeIdx, cards.length - 1)];
        if (card === undefined) return null;
        // Another kid's pickup around the same time (the other cards).
        const others = cards.filter((c) => c !== card && pickupsClash(c.pickupMinutes, card.pickupMinutes));
        const first = others[0];
        const kidLine =
          first === undefined
            ? null
            : `${first.who} ${first.what}${others.length > 1 ? ` 외 ${others.length - 1}명` : ''} 픽업(${fmt12hrShort(first.pickupMinutes)})과 겹쳐요`;
        const clash = guardianClashes(card.pickupMinutes, guardianEvents)[0];
        const guardianLine =
          clash === undefined
            ? null
            : `보호자 일정 ${clash.title}(${fmtRange(clash.startMinutes, clash.endMinutes)})와 겹쳐요`;
        const lines = [
          { key: 'kids', text: kidLine, testID: 'pickup-kids-clash' },
          { key: 'guardian', text: guardianLine, testID: 'pickup-guardian-clash' },
        ].filter((l): l is { key: string; text: string; testID: string } => l.text !== null);
        if (lines.length === 0) return null;
        return (
          <View style={styles.clashes}>
            {lines.map((l) => (
              <View key={l.key} style={styles.clash} testID={l.testID} accessibilityRole="alert">
                <IconAlertCircle size={14} color={theme.t.pickupWarn} />
                <Text style={styles.clashText}>{l.text}</Text>
              </View>
            ))}
          </View>
        );
      })()}
    </View>
  );
}

const useStyles = makeStyles((th) => ({
  // Full width of the home content column (the screen supplies the side
  // padding), same as the grouped boxes below it.
  // Design board "0 홈": the line sits 8px under the card, no box.
  outer: { gap: SPACING.sm },
  clash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.xs,
  },
  clashText: { ...TYPE.footnote, color: th.t.pickupWarn, flex: 1 },
  clashes: { gap: SPACING.xs },
  viewport: {
    overflow: 'hidden',
    borderRadius: RADIUS.card,
    position: 'relative',
  },
  slide: {
    // width set dynamically from onLayout so each slide spans the viewport.
  },
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    zIndex: 2,
  },
  dot: {
    height: 3,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.surface,
  },
  dotActive: {
    width: 10,
    opacity: 1,
  },
  dotInactive: {
    width: 3,
    opacity: 0.5,
  },
}));
