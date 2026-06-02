import { render } from '@testing-library/react-native';
import { Image } from 'react-native';

import { KidAvatar } from '../../../src/ui/common/KidAvatar';
import { AVATAR_FACES } from '../../../src/ui/assets';
import type { Child, ISODate } from '../../../src/domain/types';

const mkChild = (id: number, name: string, colorIndex: 0 | 1 | 2 | 3 | 4 | 5): Child => ({
  id,
  name,
  colorIndex,
  createdAt: '2026-05-01' as unknown as ISODate,
});

describe('KidAvatar', () => {
  test('renders the colorIndex-mapped face image (no ring)', () => {
    const child = mkChild(1, '민준', 0);
    const { UNSAFE_getByType } = render(<KidAvatar child={child} size={32} />);
    const img = UNSAFE_getByType(Image);
    expect(img.props.source).toBe(AVATAR_FACES.wink); // colorIndex 0 → wink
  });

  test('colorIndex 2 → cool face', () => {
    const child = mkChild(2, '지호', 2);
    const { UNSAFE_getByType } = render(<KidAvatar child={child} size={28} />);
    const img = UNSAFE_getByType(Image);
    expect(img.props.source).toBe(AVATAR_FACES.cool);
  });

  test('ring=true still resolves the same face source', () => {
    const child = mkChild(3, '서윤', 4);
    const { UNSAFE_getByType } = render(
      <KidAvatar child={child} size={30} ring />,
    );
    const img = UNSAFE_getByType(Image);
    expect(img.props.source).toBe(AVATAR_FACES.surprise);
  });

  test('passes through the child name as accessibilityLabel', () => {
    const child = mkChild(4, '서아', 3);
    const { getByLabelText } = render(<KidAvatar child={child} size={32} />);
    expect(getByLabelText('서아')).toBeTruthy();
  });
});
