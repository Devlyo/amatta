// Light / dark theme — ADR-009 (plan .omc/plans/ralplan-dark-mode.md, approach A).
//
// Two fixed theme objects; the provider picks one from the OS / app colour
// scheme. Screens read colours through the theme instead of the static
// `TOKENS` (which stays as the light alias until step 4):
//
//   const useStyles = makeStyles((th) => ({ box: { backgroundColor: th.t.surface } }));
//   function Thing() { const styles = useStyles(); const { t } = useTheme(); … }
//
// `makeStyles` builds BOTH StyleSheets once when the file loads; the hook only
// picks one — no per-render style creation (TimeBlock renders hundreds).
// Default context = light, so tests and not-yet-converted screens are unchanged.

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import type { ColorIndex } from '../domain/types';
import { DARK_TOKENS, getKidPaletteFor, LIGHT_TOKENS, type KidPalette, type TokenName } from './palette';

export type Scheme = 'light' | 'dark';

export interface Theme {
  scheme: Scheme;
  /** Colour tokens for this scheme. */
  t: Readonly<Record<TokenName, string>>;
  kid: (colorIndex: ColorIndex) => KidPalette;
  /** Time-block fill alpha (normal / focused kid). Dark fills stronger: pastels at 60% go muddy on dark. */
  blockFill: number;
  blockFillFocused: number;
  /** Text on a guardian block (dark guardian grey needs light text — contrast). */
  onGuardianBlock: string;
  /** Shadow opacity multiplier — shadows need more weight on dark. */
  shadowOpacity: number;
}

export const LIGHT_THEME: Theme = {
  scheme: 'light',
  t: LIGHT_TOKENS,
  kid: (ci) => getKidPaletteFor(ci, 'light'),
  blockFill: 0.6,
  blockFillFocused: 0.8,
  onGuardianBlock: LIGHT_TOKENS.onLight,
  shadowOpacity: 1,
};

export const DARK_THEME: Theme = {
  scheme: 'dark',
  t: DARK_TOKENS,
  kid: (ci) => getKidPaletteFor(ci, 'dark'),
  blockFill: 0.85,
  blockFillFocused: 0.95,
  onGuardianBlock: DARK_TOKENS.onDark,
  shadowOpacity: 3,
};

export function themeFor(scheme: Scheme): Theme {
  return scheme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

const ThemeContext = createContext<Theme>(LIGHT_THEME);

/** Follows the colour scheme the app runs in (OS setting, or the app's Appearance override). */
export function AppThemeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = themeFor(scheme);
  useEffect(() => {
    // Root window behind sheets / keyboard transitions (and Android needs it
    // for userInterfaceStyle to apply at all).
    void SystemUI.setBackgroundColorAsync(theme.t.groupedBg).catch(() => undefined);
  }, [theme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Scheme-aware StyleSheet: `fn` runs twice at module load (light + dark);
 * the returned hook picks the current one.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(fn: (theme: Theme) => T): () => T {
  const light = StyleSheet.create(fn(LIGHT_THEME));
  const dark = StyleSheet.create(fn(DARK_THEME));
  return function useStyles(): T {
    return useTheme().scheme === 'dark' ? dark : light;
  };
}
