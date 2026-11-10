import {
  AXIS_TOP_PAD,
  axisHeight,
  hourLabel,
  initialScrollY,
  minutesToY,
  nowLabel,
} from '../../../src/ui/calendar/time-axis';

describe('time axis (00:00–24:00)', () => {
  test('minutesToY is linear from the top pad', () => {
    expect(minutesToY(0, 46)).toBe(AXIS_TOP_PAD);
    expect(minutesToY(60, 46)).toBe(AXIS_TOP_PAD + 46);
    expect(minutesToY(90, 40)).toBe(AXIS_TOP_PAD + 60);
  });

  test('axisHeight covers 24 hours', () => {
    expect(axisHeight(46)).toBe(AXIS_TOP_PAD + 24 * 46);
  });

  test('hourLabel uses a 12-hour clock with AM/PM', () => {
    expect(hourLabel(0)).toEqual({ num: '12', ap: 'AM' });
    expect(hourLabel(9)).toEqual({ num: '9', ap: 'AM' });
    expect(hourLabel(12)).toEqual({ num: '12', ap: 'PM' });
    expect(hourLabel(13)).toEqual({ num: '1', ap: 'PM' });
    expect(hourLabel(24)).toEqual({ num: '12', ap: 'AM' });
  });

  test('nowLabel drops AM/PM and pads minutes', () => {
    expect(nowLabel(13 * 60 + 20)).toBe('1:20');
    expect(nowLabel(9 * 60 + 5)).toBe('9:05');
    expect(nowLabel(0)).toBe('12:00');
    expect(nowLabel(12 * 60)).toBe('12:00');
  });
});

describe('initialScrollY', () => {
  const hourHeight = 46;

  test('today: NOW sits ~1.5h below the top', () => {
    expect(initialScrollY({ hourHeight, nowMinutes: 13 * 60, firstStart: 9 * 60 })).toBe(11.5 * hourHeight);
  });

  test('other day with events: 30 min above the first event', () => {
    expect(initialScrollY({ hourHeight, nowMinutes: null, firstStart: 15 * 60 })).toBe(14.5 * hourHeight);
  });

  test('other day without events: 7 AM', () => {
    expect(initialScrollY({ hourHeight, nowMinutes: null, firstStart: null })).toBe(7 * hourHeight);
  });

  test('never negative near midnight', () => {
    expect(initialScrollY({ hourHeight, nowMinutes: 30, firstStart: null })).toBe(0);
  });
});
