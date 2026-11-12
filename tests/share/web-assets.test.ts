// The web viewer ships one avatar per app avatar key (ADR-016).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { AVATAR_KEYS } from '../../src/domain/avatar';

test('web/share/public/avatars has every avatar key', () => {
  for (const k of AVATAR_KEYS) {
    expect(existsSync(resolve(__dirname, '../../web/share/public/avatars', `${k}.png`))).toBe(true);
  }
});
