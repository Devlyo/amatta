// Swipe left to delete — the iOS list gesture (Mail, Reminders).
//
// Drag the row left: a red "삭제" button slides in behind it. Let go past the
// button → it stays open, tap 삭제 to delete. Keep dragging (a long swipe,
// past FULL_SWIPE of the row) and let go → deleted straight away. The row then
// fades out while the rows below slide up (the caller's list uses
// `rowLayout`). `confirm` (optional) may ask first; resolving false closes
// the row again.

import { memo, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type LayoutChangeEvent } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  FadeOut,
  LinearTransition,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { TOKENS } from '../palette';
import { TYPE } from '../typography';

/** Width of the revealed 삭제 button. */
const ACTION_W = 80;
/** A swipe past this share of the row's width deletes on release. */
const FULL_SWIPE = 0.55;

/** For the list around the rows: siblings glide into a deleted row's place. */
export const rowLayout = LinearTransition.duration(200);

interface Props {
  children: ReactNode;
  onDelete: () => void;
  /** Ask before deleting; false keeps the row. */
  confirm?: () => Promise<boolean>;
  /** Spoken name of the row ("수건 삭제"). */
  accessibilityLabel: string;
  testID?: string;
}

function SwipeToDeleteImpl({ children, onDelete, confirm, accessibilityLabel, testID }: Props): React.ReactElement {
  const ref = useRef<SwipeableMethods | null>(null);
  const rowW = useSharedValue(0);
  const armed = useSharedValue(false);
  const busy = useRef(false);

  const remove = async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    const ok = confirm === undefined ? true : await confirm();
    busy.current = false;
    if (ok) onDelete();
    else ref.current?.close();
  };

  const onLayout = (e: LayoutChangeEvent): void => {
    rowW.value = e.nativeEvent.layout.width;
  };

  return (
    <Reanimated.View exiting={FadeOut.duration(160)} layout={rowLayout} onLayout={onLayout} testID={testID}>
      <ReanimatedSwipeable
        ref={ref}
        friction={1}
        rightThreshold={ACTION_W / 2}
        overshootRight
        overshootFriction={1}
        onSwipeableWillOpen={() => {
          // Released after a long swipe → delete without the extra tap.
          if (armed.value) void remove();
        }}
        renderRightActions={(_progress, translation) => (
          <DeleteAction
            translation={translation}
            rowW={rowW}
            armed={armed}
            onPress={() => void remove()}
            accessibilityLabel={`${accessibilityLabel} 삭제`}
            testID={testID !== undefined ? `${testID}-delete` : undefined}
          />
        )}
      >
        {children}
      </ReanimatedSwipeable>
    </Reanimated.View>
  );
}

export const SwipeToDelete = memo(SwipeToDeleteImpl);

/** Red button behind the row; it grows with a long swipe and arms the delete. */
function DeleteAction({
  translation,
  rowW,
  armed,
  onPress,
  accessibilityLabel,
  testID,
}: {
  translation: SharedValue<number>;
  rowW: SharedValue<number>;
  armed: SharedValue<boolean>;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}): React.ReactElement {
  useAnimatedReaction(
    () => rowW.value > 0 && -translation.value > rowW.value * FULL_SWIPE,
    (isFull) => {
      armed.value = isFull;
    },
  );
  // Fills the space the row has slid away from (at least the button width).
  const grow = useAnimatedStyle(() => ({ width: Math.max(ACTION_W, -translation.value) }));
  return (
    <Reanimated.View style={[styles.action, grow]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={styles.actionPress}
      >
        <Text style={styles.actionLabel}>삭제</Text>
      </Pressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  action: { backgroundColor: TOKENS.danger, justifyContent: 'center', alignItems: 'flex-end' },
  actionPress: { width: ACTION_W, height: '100%', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { ...TYPE.subhead, fontFamily: TYPE.headline.fontFamily, color: TOKENS.surface },
});
