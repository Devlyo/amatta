import { memo } from 'react';
import { Image, View } from 'react-native';

import type { Child } from '../../domain/types';
import { AVATAR_IMAGE_BY_KEY } from '../assets';
import { withAlpha } from '../palette';
import { makeStyles, useTheme } from '../appearance';

interface Props {
  child: Child;
  size?: number;
  /**
   * If true, draws a 2px white inner ring + outer kid-source ring (design §3
   * "Avatar / dot"). Pure RN — no box-shadow.
   */
  ring?: boolean;
}

/** Kid avatar circle fill (board AV1-B). */
export const AVATAR_CIRCLE_ALPHA = 0.45;

function KidAvatarImpl({ child, size = 32, ring = false }: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const palette = theme.kid(child.colorIndex);
  const source = AVATAR_IMAGE_BY_KEY[child.avatar];

  if (!ring) {
    // Board AV1-B (2026-11-11): the face sits on a 45% kid-colour circle, like
    // the 보호자 grey circle.
    const face = Math.round(size * 0.92);
    return (
      <View
        testID="kid-avatar-circle"
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(palette.source, AVATAR_CIRCLE_ALPHA) },
        ]}
      >
        <Image
          source={source}
          style={{ width: face, height: face }}
          resizeMode="contain"
          accessibilityLabel={child.name}
        />
      </View>
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
            backgroundColor: theme.t.surface,
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

const useStyles = makeStyles((th) => ({
  outer: { alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gap: { alignItems: 'center', justifyContent: 'center' },
}));
