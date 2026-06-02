import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { ROW_HEIGHT } from '../../domain/constants';
import { TOKENS } from '../palette';

interface Props {
  slotIndex: number;
  isHourBoundary: boolean;
}

function SlotCellImpl({ isHourBoundary }: Props): React.ReactElement {
  return (
    <View
      style={[
        styles.cell,
        { borderBottomColor: isHourBoundary ? TOKENS.ink12 : TOKENS.ink06 },
      ]}
    />
  );
}

// React.memo with default shallow prop comparison — slotIndex + isHourBoundary
// are primitives so cells never re-render once mounted.
export const SlotCell = memo(SlotCellImpl);

const styles = StyleSheet.create({
  cell: {
    height: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
