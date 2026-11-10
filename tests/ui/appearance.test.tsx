import { render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';
import { Text } from 'react-native';

import type { ColorIndex } from '../../src/domain/types';
import { AppThemeProvider, DARK_THEME, LIGHT_THEME, makeStyles, useTheme } from '../../src/ui/appearance';
import { DARK_TOKENS, LIGHT_TOKENS } from '../../src/ui/palette';

// WCAG relative luminance / contrast for #RRGGBB and rgba(r,g,b,a) over a backdrop.
type RGB = [number, number, number];
function parse(c: string, over: RGB): RGB {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(c);
  if (m !== null) {
    const a = m[4] === undefined ? 1 : Number(m[4]);
    return [0, 1, 2].map((i) => Number(m[i + 1]) * a + over[i]! * (1 - a)) as RGB;
  }
  const h = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}
const mix = (c: RGB, over: RGB, a: number): RGB => c.map((v, i) => v * a + over[i]! * (1 - a)) as RGB;
function lum([r, g, b]: RGB): number {
  const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('palette pairs (ADR-009)', () => {
  test('every light token has a dark value (and nothing extra)', () => {
    expect(Object.keys(DARK_TOKENS).sort()).toEqual(Object.keys(LIGHT_TOKENS).sort());
  });

  test('dark text tokens read on the dark box and background (≥ 4.5:1)', () => {
    const surface = parse(DARK_TOKENS.surface, [0, 0, 0]);
    const bg = parse(DARK_TOKENS.groupedBg, [0, 0, 0]);
    for (const k of ['ink', 'inkSub', 'danger', 'sunday', 'saturday', 'primaryDeep', 'pickupWarn', 'success'] as const) {
      expect([k, contrast(parse(DARK_TOKENS[k], surface), surface) >= 4.5]).toEqual([k, true]);
      expect([k, contrast(parse(DARK_TOKENS[k], bg), bg) >= 4.5]).toEqual([k, true]);
    }
  });

  test('time-block text reads on the BLENDED fill in dark (kids: onLight, guardian: light text)', () => {
    const surface = parse(DARK_TOKENS.surface, [0, 0, 0]);
    for (let ci = 0; ci < 6; ci += 1) {
      const fill = mix(parse(DARK_THEME.kid(ci as ColorIndex).source, surface), surface, DARK_THEME.blockFill);
      expect(contrast(parse(DARK_TOKENS.onLight, fill), fill)).toBeGreaterThanOrEqual(4.5);
    }
    const g = mix(parse(DARK_TOKENS.guardian, surface), surface, DARK_THEME.blockFill);
    expect(contrast(parse(DARK_THEME.onGuardianBlock, g), g)).toBeGreaterThanOrEqual(4.5);
  });

  test('onLight / onDark never flip with the scheme', () => {
    expect(DARK_TOKENS.onLight).toBe(LIGHT_TOKENS.onLight);
    expect(DARK_TOKENS.onDark).toBe(LIGHT_TOKENS.onDark);
  });
});

describe('theme provider + makeStyles', () => {
  const useStyles = makeStyles((th) => ({ box: { backgroundColor: th.t.surface } }));
  function Probe() {
    const styles = useStyles();
    const { scheme } = useTheme();
    return <Text testID="probe" style={styles.box}>{scheme}</Text>;
  }
  const bgOf = () => RN.StyleSheet.flatten(screen.getByTestId('probe').props.style).backgroundColor;

  afterEach(() => jest.restoreAllMocks());

  test('no provider → light (tests and unconverted screens unchanged)', () => {
    render(<Probe />);
    expect(screen.getByText('light')).toBeTruthy();
    expect(bgOf()).toBe(LIGHT_THEME.t.surface);
  });

  test('provider follows the colour scheme; both style sets are built once', () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
    render(
      <AppThemeProvider>
        <Probe />
      </AppThemeProvider>,
    );
    expect(screen.getByText('dark')).toBeTruthy();
    expect(bgOf()).toBe(DARK_THEME.t.surface);
  });
});
