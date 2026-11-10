// restoreFromBackup flow (ADR-012) with injected steps — no picker, alerts or DB.

import { backupDateLabel, restoreFromBackup, type RestoreSteps } from '../../src/state/restore';

const goodFile = JSON.stringify({
  exportedAt: '2026-11-10T13:15:00.000Z',
  schemaVersion: 5,
  children: [{ id: 1, name: '민준', colorIndex: 0, avatar: 'face-wink', createdAt: '2026-01-01' }],
  schedules: [],
  exceptions: [],
  notificationSettings: [],
  checklistItems: [],
  todos: [],
  pickupLog: [],
  checklistCompletion: [],
  appSettings: [],
});

function steps(over: Partial<RestoreSteps> = {}): RestoreSteps & { calls: string[] } {
  const calls: string[] = [];
  const s: RestoreSteps = {
    pick: async () => {
      calls.push('pick');
      return { kind: 'picked', text: goodFile, name: 'wemoa-export.json' };
    },
    confirm: async () => {
      calls.push('confirm');
      return true;
    },
    report: (p) => calls.push(`report:${p}`),
    keepCurrent: async () => {
      calls.push('keepCurrent');
    },
    apply: async () => {
      calls.push('apply');
    },
    reload: async () => {
      calls.push('reload');
    },
    ...over,
  };
  return Object.assign(s, { calls });
}

describe('restoreFromBackup', () => {
  test('settings: confirm → keep current → apply → reload, in that order', async () => {
    const s = steps();
    await expect(restoreFromBackup('settings', s)).resolves.toBe('restored');
    expect(s.calls).toEqual(['pick', 'confirm', 'keepCurrent', 'apply', 'reload']);
  });

  test('welcome: no safety copy (nothing to keep)', async () => {
    const s = steps();
    await expect(restoreFromBackup('welcome', s)).resolves.toBe('restored');
    expect(s.calls).toEqual(['pick', 'confirm', 'apply', 'reload']);
  });

  test('cancelling the picker or the alert changes nothing', async () => {
    const a = steps({ pick: async () => ({ kind: 'cancelled' }) });
    await expect(restoreFromBackup('settings', a)).resolves.toBe('cancelled');
    expect(a.calls).toEqual([]);
    const b = steps({ confirm: async () => false });
    await expect(restoreFromBackup('settings', b)).resolves.toBe('cancelled');
    expect(b.calls).toEqual(['pick']);
  });

  test('picker problems and bad files are reported, nothing applied', async () => {
    for (const kind of ['unavailable', 'unreadable'] as const) {
      const s = steps({ pick: async () => ({ kind }) });
      await expect(restoreFromBackup('settings', s)).resolves.toBe('rejected');
      expect(s.calls).toEqual([`report:${kind}`]);
    }
    const bad = steps({ pick: async () => ({ kind: 'picked', text: '{"schemaVersion":9}', name: 'x.json' }) });
    await expect(restoreFromBackup('settings', bad)).resolves.toBe('rejected');
    expect(bad.calls).toEqual(['report:newer']);
  });

  test('an import failure is reported and nothing reloads', async () => {
    const s = steps({
      apply: async () => {
        throw new Error('boom');
      },
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(restoreFromBackup('settings', s)).resolves.toBe('failed');
    expect(s.calls).toEqual(['pick', 'confirm', 'keepCurrent', 'report:failed']);
    warn.mockRestore();
  });

  test('a failed safety copy stops before touching the data', async () => {
    const s = steps({
      keepCurrent: async () => {
        throw new Error('disk full');
      },
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(restoreFromBackup('settings', s)).resolves.toBe('failed');
    expect(s.calls).not.toContain('apply');
    warn.mockRestore();
  });
});

describe('backupDateLabel', () => {
  test('local time, 오전/오후, unknown', () => {
    expect(backupDateLabel(new Date(2026, 10, 10, 22, 5))).toBe('11월 10일 오후 10:05');
    expect(backupDateLabel(new Date(2026, 0, 2, 0, 30))).toBe('1월 2일 오전 12:30');
    expect(backupDateLabel(null)).toBe('날짜 모름');
  });
});
