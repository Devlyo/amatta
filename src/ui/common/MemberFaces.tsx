// ADR-013: stacked faces for a schedule shared by several people (board M1/M3).
// Kids in member order, then the guardian (grey dot + person icon) when they join.

import { memo } from 'react';
import { Image, View } from 'react-native';

import type { Child } from '../../domain/types';
import { AVATAR_IMAGE_BY_KEY } from '../assets';
import { withAlpha } from '../palette';
import { AVATAR_CIRCLE_ALPHA } from './KidAvatar';
import { IconPerson } from '../icons';
import { RADIUS } from '../radius';
import { makeStyles, useTheme } from '../appearance';

interface Props {
  kids: readonly Child[];
  withGuardian?: boolean;
  size?: number;
  testID?: string;
}

function MemberFacesImpl({ kids, withGuardian = false, size = 16, testID }: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const overlap = Math.round(size * 0.3);
  const names = [...kids.map((k) => k.name), ...(withGuardian ? ['보호자'] : [])].join(', ');
  return (
    <View style={styles.row} testID={testID} accessibilityLabel={`함께: ${names}`}>
      {kids.map((k, i) => (
        <View
          key={k.id}
          style={[
            styles.face,
            {
              width: size,
              height: size,
              marginLeft: i === 0 ? 0 : -overlap,
              backgroundColor: withAlpha(theme.kid(k.colorIndex).source, AVATAR_CIRCLE_ALPHA),
            },
          ]}
        >
          <Image source={AVATAR_IMAGE_BY_KEY[k.avatar]} style={{ width: size, height: size }} resizeMode="contain" />
        </View>
      ))}
      {withGuardian ? (
        <View
          style={[
            styles.face,
            styles.guardian,
            { width: size, height: size, marginLeft: kids.length === 0 ? 0 : -overlap },
          ]}
        >
          <IconPerson size={Math.round(size * 0.62)} color={theme.t.ink} />
        </View>
      ) : null}
    </View>
  );
}

export const MemberFaces = memo(MemberFacesImpl);

const useStyles = makeStyles((th) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  face: {
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: th.t.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardian: { backgroundColor: th.t.guardian },
}));
