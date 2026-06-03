import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { Child } from '../../domain/types';
import { AVATAR_IMAGE_BY_KEY } from '../assets';
import { getKidPalette, TOKENS } from '../palette';

interface Props {
  child: Child;
  size?: number;
  /**
   * If true, draws a 2px white inner ring + outer kid-source ring (design §3
   * "Avatar / dot"). Pure RN — no box-shadow.
   */
  ring?: boolean;
}

function KidAvatarImpl({ child, size = 32, ring = false }: Props): React.ReactElement {
  const palette = getKidPalette(child.colorIndex);
  const source = AVATAR_IMAGE_BY_KEY[child.avatar];

  if (!ring) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel={child.name}
      />
    );
  }

  // Outer: kid-source. Inner gap: white. Center: image.
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
        <Image
          source={source}
          style={{ width: inner, height: inner }}
          resizeMode="contain"
          accessibilityLabel={child.name}
        />
      </View>
    </View>
  );
}

export const KidAvatar = memo(KidAvatarImpl);

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center' },
  gap: { alignItems: 'center', justifyContent: 'center' },
});
