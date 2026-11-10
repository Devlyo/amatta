import { clashesWithPickup, guardianClashes, pickupClashes } from '../../src/domain/pickup-conflict';

const h = (x: number) => x * 60;

describe('pickup ↔ guardian clash', () => {
  test('a guardian event running at the pickup moment clashes', () => {
    expect(clashesWithPickup(h(18), { startMinutes: h(17.5), endMinutes: h(20) })).toBe(true); // 저녁 약속 5:30–8
  });
  test('within 15 min either side clashes; further away does not', () => {
    expect(clashesWithPickup(h(18), { startMinutes: h(18) + 10, endMinutes: h(19) })).toBe(true); // starts 6:10
    expect(clashesWithPickup(h(18), { startMinutes: h(17), endMinutes: h(18) - 10 })).toBe(true); // ends 5:50
    expect(clashesWithPickup(h(18), { startMinutes: h(18) + 15, endMinutes: h(19) })).toBe(false); // starts 6:15
    expect(clashesWithPickup(h(18), { startMinutes: h(16), endMinutes: h(17.5) })).toBe(false); // ends 5:30
  });
  test('all-day guardian events never clash', () => {
    expect(clashesWithPickup(h(18), { startMinutes: 0, endMinutes: h(24), allDay: true })).toBe(false);
  });
  test('lists: which guardian events / which pickups', () => {
    const guardian = [
      { id: 'dinner', startMinutes: h(17.5), endMinutes: h(20) },
      { id: 'lunch', startMinutes: h(12), endMinutes: h(13) },
    ];
    expect(guardianClashes(h(18), guardian).map((g) => g.id)).toEqual(['dinner']);
    const kids = [
      { id: 'piano', startMinutes: h(17), endMinutes: h(18), needsPickup: true },
      { id: 'school', startMinutes: h(9), endMinutes: h(14), needsPickup: true },
      { id: 'art', startMinutes: h(17), endMinutes: h(18), needsPickup: false },
    ];
    expect(pickupClashes({ startMinutes: h(17.5), endMinutes: h(20) }, kids).map((k) => k.id)).toEqual(['piano']);
  });
});
