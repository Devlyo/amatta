// Native horizontal paging strip shared by the day and month views — ADR-007 §4.
//
// `pages` full-width pages side by side in one ScrollView, paged by iOS
// itself (drag follows the finger, flicks use system physics). Only the
// current page ±1 is rendered; the rest of the strip stays empty until the
// window moves there, so the strip can be long without cost.

import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { makeStyles } from '../appearance';

interface Props {
  pages: number;
  /** Page in view. */
  current: number;
  /** Re-positions the strip on `current` whenever it changes (jumps only). */
  jumpKey: string;
  renderPage: (page: number, width: number) => ReactNode;
  /** The user paged to another page. */
  onPage: (page: number) => void;
  /** True while pinching — paging is switched off. */
  locked?: SharedValue<boolean>;
  testID: string;
}

function PagingStripImpl({
  pages,
  current,
  jumpKey,
  renderPage,
  onPage,
  locked,
  testID,
}: Props): React.ReactElement {
  const styles = useStyles();
  const ref = useRef<Reanimated.ScrollView>(null);
  const [pageW, setPageW] = useState(0);
  const onLayout = (e: LayoutChangeEvent): void => setPageW(e.nativeEvent.layout.width);
  const targetX = current * pageW;

  // A fresh strip has no content size yet and would clamp the offset to 0 —
  // keep the target pending until the content is wide enough.
  const pendingX = useRef<number | null>(null);
  useEffect(() => {
    if (pageW <= 0) return;
    pendingX.current = targetX;
    ref.current?.scrollTo({ x: targetX, animated: false });
    // Only on jumps (and size changes), never on the user's own paging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpKey, pageW]);
  const onContentSize = (w: number): void => {
    const x = pendingX.current;
    if (x === null || w < x + pageW) return;
    pendingX.current = null;
    ref.current?.scrollTo({ x, animated: false });
  };

  const stripProps = useAnimatedProps(() => ({ scrollEnabled: locked === undefined || !locked.value }));
  const settle = (x: number): void => {
    if (pageW <= 0) return;
    const page = Math.round(x / pageW);
    if (page !== current && page >= 0 && page < pages) onPage(page);
  };

  return (
    <View style={styles.viewport} onLayout={onLayout} testID={`${testID}-viewport`}>
      {pageW > 0 ? (
        <Reanimated.ScrollView
          ref={ref}
          testID={testID}
          horizontal
          pagingEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          animatedProps={stripProps}
          contentOffset={{ x: targetX, y: 0 }}
          onContentSizeChange={onContentSize}
          onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
          onScrollEndDrag={(e) => {
            // Released exactly on a page → no momentum event follows.
            if ((e.nativeEvent.velocity?.x ?? 0) === 0) settle(e.nativeEvent.contentOffset.x);
          }}
        >
          <View style={{ width: pageW * pages, height: '100%' }}>
            {[current - 1, current, current + 1]
              .filter((p) => p >= 0 && p < pages)
              .map((p) => (
                <View key={p} style={[styles.page, { left: p * pageW, width: pageW }]}>
                  {renderPage(p, pageW)}
                </View>
              ))}
          </View>
        </Reanimated.ScrollView>
      ) : null}
    </View>
  );
}

export const PagingStrip = memo(PagingStripImpl);

const useStyles = makeStyles((th) => ({
  viewport: { flex: 1 },
  page: { position: 'absolute', top: 0, bottom: 0 },
}));
