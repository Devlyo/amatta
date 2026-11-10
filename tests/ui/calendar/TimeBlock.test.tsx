import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  BLOCK_DIMMED_OPACITY,
  TimeBlock,
  type TimeBlockProps,
} from '../../../src/ui/calendar/TimeBlock';
import { getKidPalette, withAlpha } from '../../../src/ui/palette';

const lavender = getKidPalette(5);

function renderBlock(over: Partial<TimeBlockProps> = {}) {
  const props: TimeBlockProps = {
    top: 10,
    left: 0,
    width: 80,
    height: 46,
    level: 0,
    title: '피아노',
    startMinutes: 15 * 60,
    endMinutes: 16 * 60,
    color: lavender.source,
    deep: lavender.deep,
    accessibilityLabel: '서연 피아노, 3–4PM',
    testID: 'block',
    ...over,
  };
  return render(<TimeBlock {...props} />);
}

function flatStyle(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;
}

describe('TimeBlock', () => {
  test('day view shows title and the "3–4PM" range', () => {
    renderBlock();
    expect(screen.getByText('피아노')).toBeTruthy();
    expect(screen.getByText('3–4PM')).toBeTruthy();
  });

  test('fills with the owner colour at 40%, 60% when focused', () => {
    renderBlock();
    expect(flatStyle('block').backgroundColor).toBe(withAlpha(lavender.source, 0.4));
    screen.unmount();
    renderBlock({ focused: true });
    expect(flatStyle('block').backgroundColor).toBe(withAlpha(lavender.source, 0.6));
  });

  test('dimmed blocks fade to 20%', () => {
    renderBlock({ dimmed: true });
    expect(flatStyle('block').opacity).toBe(BLOCK_DIMMED_OPACITY);
  });

  test('cascade level controls stacking order', () => {
    renderBlock({ level: 2 });
    expect(flatStyle('block').zIndex).toBe(3);
  });

  test('compact (week) hides the time unless showTime', () => {
    renderBlock({ compact: true });
    expect(screen.queryByText('3–4PM')).toBeNull();
    screen.unmount();
    renderBlock({ compact: true, showTime: true });
    expect(screen.getByText('3–4PM')).toBeTruthy();
  });

  test('pickup dot on wide and compact blocks (5-column day view: 4 kids + 보호자)', () => {
    renderBlock({ needsPickup: true });
    expect(screen.getByTestId('time-block-pickup')).toBeTruthy();
    screen.unmount();
    renderBlock({ needsPickup: true, compact: true });
    expect(screen.getByTestId('time-block-pickup')).toBeTruthy();
    screen.unmount();
    renderBlock({ needsPickup: false });
    expect(screen.queryByTestId('time-block-pickup')).toBeNull();
  });

  test('press calls onPress and exposes an accessibility label', () => {
    const onPress = jest.fn();
    renderBlock({ onPress });
    fireEvent.press(screen.getByLabelText('서연 피아노, 3–4PM'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
