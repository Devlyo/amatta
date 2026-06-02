import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import type { ColorIndex } from '../../domain/types';
import { getKidPalette, TOKENS } from '../palette';

interface Props {
  colorIndex: ColorIndex;
  size?: number;
  /**
   * If true, draws a 2px white inner ring + outer kid-source ring (design §3
   * "Avatar / dot"). RN has no box-shadow, so the ring is an outer View.
   */
  ring?: boolean;
}

function ColorDotImpl({ colorIndex, size = 12, ring = false }: Props): React.ReactElement {
  const palette = getKidPalette(colorIndex);

  if (!ring) {
    return (
      <View
        style={[
          styles.dot,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.source },
        ]}
      />
    );
  }

  // Outer ring: kid-source. Inner gap: white. Center: kid-source.
  // Outer wrapper is (size + 4) so source ring is 2px thick around 2px white gap.
  const outer = size + 4;
  const inner = size;
  return (
    <View
      style={[
        styles.outer,
        {
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          backgroundColor: palette.source,
        },
      ]}
    >
      <View
        style={[
          styles.gap,
          {
            width: inner + 2,
            height: inner + 2,
            borderRadius: (inner + 2) / 2,
            backgroundColor: TOKENS.surface,
          },
        ]}
      >
        <View
          style={[
            styles.dot,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: palette.source,
            },
          ]}
        />
      </View>
    </View>
  );
}

export const ColorDot = memo(ColorDotImpl);

const styles = StyleSheet.create({
  dot: {},
  outer: { alignItems: 'center', justifyContent: 'center' },
  gap: { alignItems: 'center', justifyContent: 'center' },
});
