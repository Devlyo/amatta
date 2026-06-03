import { render } from '@testing-library/react-native';
import { Image } from 'react-native';

import { KidAvatar } from '../../../src/ui/common/KidAvatar';
import { AVATAR_IMAGE_BY_KEY } from '../../../src/ui/assets';
import {
  avatarKeyForColorIndex,
  type AvatarKey,
} from '../../../src/domain/avatar';
import type { Child, ColorIndex, ISODate } from '../../../src/domain/types';

const mkChild = (
  id: number,
  name: string,
  colorIndex: ColorIndex,
  avatar?: AvatarKey,
): Child => ({
  id,
  name,
  colorIndex,
  avatar: avatar ?? avatarKeyForColorIndex(colorIndex),
  createdAt: '2026-05-01' as unknown as ISODate,
});

describe('KidAvatar', () => {
  test('renders child.avatar as the face image (no ring)', () => {
    // colorIndex 0 → avatarKeyForColorIndex → 'face-wink'.
    const child = mkChild(1, '민준', 0);
    const { UNSAFE_getByType } = render(<KidAvatar child={child} size={32} />);
    const img = UNSAFE_getByType(Image);
    expect(img.props.source).toBe(AVATAR_IMAGE_BY_KEY['face-wink']);
  });

  test('explicit avatar key on Child overrides the colorIndex default', () => {
    const child = mkChild(2, '지호', 2, 'face-calm');
    const { UNSAFE_getByType } = render(<KidAvatar child={child} size={28} />);
    const img = UNSAFE_getByType(Image);
    expect(img.props.source).toBe(AVATAR_IMAGE_BY_KEY['face-calm']);
  });

  test('ring=true still resolves the same face source', () => {
    const child = mkChild(3, '서윤', 4);
    const { UNSAFE_getByType } = render(
      <KidAvatar child={child} size={30} ring />,
    );
    const img = UNSAFE_getByType(Image);
    expect(img.props.source).toBe(AVATAR_IMAGE_BY_KEY['face-surprise']);
  });

  test('passes through the child name as accessibilityLabel', () => {
    const child = mkChild(4, '서아', 3);
    const { getByLabelText } = render(<KidAvatar child={child} size={32} />);
    expect(getByLabelText('서아')).toBeTruthy();
  });
});
