// Smoke-render tests for each icon component ported from amatta-v1.
// We don't assert on path data (covered by visual review) — just that the
// component returns an Svg element and accepts size/color without crashing.

import { render } from '@testing-library/react-native';

import {
  IconAcademy,
  IconActivity,
  IconBell,
  IconCar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconEtc,
  IconGear,
  IconGrid,
  IconHome,
  IconPlus,
  IconSchool,
  IconSearch,
  IconSparkle,
  IconXMark,
  KIND_ICON,
} from '../../src/ui/icons';

describe('icons — smoke render', () => {
  test.each([
    ['IconCar', IconCar],
    ['IconSearch', IconSearch],
    ['IconGrid', IconGrid],
    ['IconHome', IconHome],
    ['IconGear', IconGear],
    ['IconBell', IconBell],
    ['IconSparkle', IconSparkle],
    ['IconChevronLeft', IconChevronLeft],
    ['IconChevronRight', IconChevronRight],
    ['IconChevronDown', IconChevronDown],
    ['IconPlus', IconPlus],
    ['IconCheck', IconCheck],
    ['IconXMark', IconXMark],
    ['IconSchool', IconSchool],
    ['IconAcademy', IconAcademy],
    ['IconActivity', IconActivity],
    ['IconEtc', IconEtc],
  ] as const)('%s renders with default props', (_name, Cmp) => {
    const { toJSON } = render(<Cmp />);
    expect(toJSON()).not.toBeNull();
  });

  test('IconSchool accepts size + color', () => {
    const { toJSON } = render(<IconSchool size={24} color="#FF7144" />);
    expect(toJSON()).not.toBeNull();
  });
});

describe('KIND_ICON map', () => {
  test('maps every ScheduleType to a component', () => {
    expect(KIND_ICON.school).toBe(IconSchool);
    expect(KIND_ICON.academy).toBe(IconAcademy);
    expect(KIND_ICON.activity).toBe(IconActivity);
    expect(KIND_ICON.other).toBe(IconEtc);
  });
});
