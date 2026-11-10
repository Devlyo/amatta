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
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { GuardianOccurrence } from '../../domain/guardian';
import { guardianClashes } from '../../domain/pickup-conflict';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { TOKENS } from '../palette';
import { IconAlertCircle } from '../icons';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { fmtRange } from '../utils/date';
import { PickupCard } from './PickupCard';
import { computePickupCards } from './pickup-data';

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
        const clash = card === undefined ? undefined : guardianClashes(card.pickupMinutes, guardianEvents)[0];
        if (clash === undefined) return null;
        return (
          <View style={styles.clash} testID="pickup-guardian-clash" accessibilityRole="alert">
            <IconAlertCircle size={14} color={TOKENS.pickupWarn} />
            <Text style={styles.clashText}>
              보호자 일정 &quot;{clash.title}&quot;({fmtRange(clash.startMinutes, clash.endMinutes)})와 겹쳐요
            </Text>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
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
  clashText: { ...TYPE.footnote, color: TOKENS.pickupWarn, flex: 1 },
  viewport: {
    overflow: 'hidden',
    borderRadius: RADIUS.box,
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
    backgroundColor: TOKENS.surface,
  },
  dotActive: {
    width: 10,
    opacity: 1,
  },
  dotInactive: {
    width: 3,
    opacity: 0.5,
  },
});
