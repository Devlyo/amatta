// Hold a time block, then drag it to a new time (and, in the week view, a new
// day) — iPhone Calendar style. ADR-015, boards DR1–DR3.
//
//   · hold 0.3s → the block lifts (slightly larger, shadow); a tap still opens it
//   · drag → snaps to 15-minute steps vertically and whole columns sideways;
//     the block's own time label shows the new range while dragging
//   · release → `onDrop(deltaMinutes, deltaColumns)`; the caller saves (or asks)
//     and resolves true when it moved, false to spring back
//
// While a block is lifted the grid stops scrolling (TimeGridDragContext).

import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { TimeGridDragContext } from './TimeGrid';
import { elevationFor } from '../elevation';
import { makeStyles } from '../appearance';

export const DRAG_HOLD_MS = 300;
export const DRAG_STEP_MIN = 15;

/** Snap a vertical drag (px) to whole steps of minutes, clamped to the day. */
export function snapMinutes(dy: number, pxPerMin: number, start: number, end: number): number {
  'worklet';
  if (pxPerMin <= 0) return 0;
  const raw = Math.round(dy / pxPerMin / DRAG_STEP_MIN) * DRAG_STEP_MIN;
  const min = -start;
  const max = 24 * 60 - end;
  return Math.max(min, Math.min(max, raw));
}

/** Snap a sideways drag (px) to whole columns within [minCol, maxCol]. */
export function snapColumns(dx: number, columnWidth: number, minDelta: number, maxDelta: number): number {
  'worklet';
  if (columnWidth <= 0) return 0;
  return Math.max(minDelta, Math.min(maxDelta, Math.round(dx / columnWidth)));
}

interface Props {
  enabled: boolean;
  startMinutes: number;
  endMinutes: number;
  pxPerMin: number;
  /** Week view: allow sideways moves of whole columns. */
  columnWidth?: number;
  minColumnDelta?: number;
  maxColumnDelta?: number;
  /** Live preview of the snapped start while dragging (null when not dragging). */
  onPreview?: (deltaMinutes: number | null) => void;
  onDrop: (deltaMinutes: number, deltaColumns: number) => Promise<boolean>;
  /** Changes when the block's saved place changes (resets the drag offset). */
  placeKey: string;
  style: object;
  testID?: string;
  /** testID of the positioned wrapper (geometry lives here). */
  slotTestID?: string;
  children: ReactNode;
}

export function DraggableBlock({
  enabled,
  startMinutes,
  endMinutes,
  pxPerMin,
  columnWidth = 0,
  minColumnDelta = 0,
  maxColumnDelta = 0,
  onPreview,
  onDrop,
  placeKey,
  style,
  testID,
  slotTestID,
  children,
}: Props): React.ReactElement {
  const styles = useStyles();
  const grid = useContext(TimeGridDragContext);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lifted = useSharedValue(0);
  const lastStep = useSharedValue(0);
  const [active, setActive] = useState(false);
  const pending = useRef(false);

  // The data moved (new start / column after a save) → drop the offset.
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
    pending.current = false;
  }, [placeKey, tx, ty]);

  const begin = (): void => {
    setActive(true);
    grid?.begin();
  };
  const preview = (d: number | null): void => onPreview?.(d);
  const finish = (dMin: number, dCol: number): void => {
    grid?.end();
    setActive(false);
    onPreview?.(null);
    if (dMin === 0 && dCol === 0) {
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      return;
    }
    pending.current = true;
    void onDrop(dMin, dCol).then((moved) => {
      if (!moved && pending.current) {
        pending.current = false;
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });
  };

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activateAfterLongPress(DRAG_HOLD_MS)
    .withTestId(testID !== undefined ? `${testID}-drag` : 'block-drag')
    .onStart(() => {
      lifted.value = withTiming(1, { duration: 120 });
      lastStep.value = 0;
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      const dMin = snapMinutes(e.translationY, pxPerMin, startMinutes, endMinutes);
      const dCol = snapColumns(e.translationX, columnWidth, minColumnDelta, maxColumnDelta);
      ty.value = dMin * pxPerMin;
      tx.value = dCol * columnWidth;
      if (dMin !== lastStep.value) {
        lastStep.value = dMin;
        runOnJS(preview)(dMin);
      }
    })
    .onEnd((e) => {
      lifted.value = withTiming(0, { duration: 160 });
      const dMin = snapMinutes(e.translationY, pxPerMin, startMinutes, endMinutes);
      const dCol = snapColumns(e.translationX, columnWidth, minColumnDelta, maxColumnDelta);
      runOnJS(finish)(dMin, dCol);
    })
    .onFinalize((_e, success) => {
      if (!success) {
        lifted.value = withTiming(0, { duration: 160 });
      }
    });

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: 1 + lifted.value * 0.04 }],
    shadowOpacity: lifted.value * 0.25,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View testID={slotTestID} style={[style, styles.lift, active ? styles.top : null, anim]} collapsable={false}>
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((th) => ({
  lift: { ...elevationFor(th).stack, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, shadowOpacity: 0 },
  top: { zIndex: 100 },
}));

