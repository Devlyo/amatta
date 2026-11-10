// Month view as a native paging strip — ADR-007 §4.
//
// Months side by side on a PagingStrip (`pages` pages from `origin`): a drag
// follows the finger and iOS pages a month. The weekday names row stays put
// above the strip.

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { PersonKey } from '../../domain/people-filter';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { shiftIsoMonth } from '../utils/date';
import { monthsBetween } from './calendar-layout';
import { MonthNames, MonthView, type MonthLiveRows } from './MonthView';
import { PagingStrip } from './PagingStrip';

interface Props {
  /** The current date — its month is the page in view. */
  anchor: ISODate;
  /** First day of the month at page 0. */
  origin: ISODate;
  pages: number;
  /** Re-positions the strip on the anchor's page whenever it changes. */
  jumpKey: string;
  today: ISODate;
  kids: readonly Child[];
  occurrences: readonly Occurrence[];
  inactive: readonly PersonKey[];
  rowHeight: number;
  live?: MonthLiveRows;
  /** True while pinching — paging is switched off. */
  locked?: SharedValue<boolean>;
  /** The user paged to another month (page index from `origin`). */
  onPage: (page: number) => void;
  onPressDay: (date: ISODate) => void;
}

function MonthStripImpl({
  anchor,
  origin,
  pages,
  jumpKey,
  today,
  kids,
  occurrences,
  inactive,
  rowHeight,
  live,
  locked,
  onPage,
  onPressDay,
}: Props): React.ReactElement {
  const current = monthsBetween(origin, anchor);
  return (
    <View style={styles.root}>
      <MonthNames />
      <PagingStrip
        testID="month-strip"
        pages={pages}
        current={current}
        jumpKey={jumpKey}
        locked={locked}
        onPage={onPage}
        renderPage={(p) => (
          <MonthView
            anchor={shiftIsoMonth(origin, p)}
            today={today}
            kids={kids}
            occurrences={occurrences}
            inactive={inactive}
            zoomed={false}
            rowHeight={rowHeight}
            live={live}
            showNames={false}
            testID={p === current ? 'month-view' : `month-view-${p - current}`}
            onPressDay={onPressDay}
          />
        )}
      />
    </View>
  );
}

export const MonthStrip = memo(MonthStripImpl);

const styles = StyleSheet.create({
  root: { flex: 1 },
});
