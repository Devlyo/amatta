import { GRID_SLOTS, GRID_START_HOUR, SLOT_MIN } from './constants';
import type { ColorIndex, Minutes, Occurrence } from './types';

export interface BlockLayout {
  scheduleId: number;
  childIdx: number;
  topSlot: number;
  heightSlots: number;
  colorIndex: ColorIndex;
  title: string;
  startMinutes: Minutes;
  endMinutes: Minutes;
}

export function layoutDay(
  occurrences: Occurrence[],
  childrenOrder: number[],
): BlockLayout[] {
  const indexByChildId = new Map<number, number>();
  for (let i = 0; i < childrenOrder.length; i++) {
    const cid = childrenOrder[i];
    if (cid === undefined) continue;
    indexByChildId.set(cid, i);
  }

  const out: BlockLayout[] = [];
  const gridStartMin = GRID_START_HOUR * 60;

  for (let i = 0; i < occurrences.length; i++) {
    const occ = occurrences[i];
    if (occ === undefined) continue;

    const childIdx = indexByChildId.get(occ.childId);
    if (childIdx === undefined) continue;

    const rawTop = Math.floor((occ.startMinutes - gridStartMin) / SLOT_MIN);
    const rawHeight = Math.max(
      1,
      Math.ceil((occ.endMinutes - occ.startMinutes) / SLOT_MIN),
    );

    let topSlot = rawTop < 0 ? 0 : rawTop;
    let heightSlots = rawHeight;
    if (topSlot + heightSlots > GRID_SLOTS) {
      heightSlots = GRID_SLOTS - topSlot;
    }
    if (heightSlots < 1) continue;

    out.push({
      scheduleId: occ.scheduleId,
      childIdx,
      topSlot,
      heightSlots,
      colorIndex: occ.colorIndex,
      title: occ.title,
      startMinutes: occ.startMinutes,
      endMinutes: occ.endMinutes,
    });
  }

  return out;
}
