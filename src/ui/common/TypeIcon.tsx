import { memo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { ScheduleType } from '../../domain/types';
import { TOKENS } from '../palette';

interface Props {
  type: ScheduleType;
  size?: number;
  color?: string;
}

// Design §5 — 4 fixed schedule types. lucide icons are referenced in the
// design doc, but the project uses @expo/vector-icons; we map to the
// closest Ionicons equivalents. Adjust if a lucide-rn dep is later added.
const ICON_BY_TYPE: Record<ScheduleType, keyof typeof Ionicons.glyphMap> = {
  school: 'school',
  academy: 'book',
  activity: 'barbell',
  other: 'ellipsis-horizontal',
};

function TypeIconImpl({ type, size = 12, color = TOKENS.ink }: Props): React.ReactElement {
  return <Ionicons name={ICON_BY_TYPE[type]} size={size} color={color} />;
}

export const TypeIcon = memo(TypeIconImpl);
