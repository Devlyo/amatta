// Thin shim — the real implementation now lives in `src/ui/icons.tsx`
// (hand-drafted SVGs ported from amatta-v1). Kept here so existing
// `import { TypeIcon } from '../common/TypeIcon'` call sites keep compiling
// during R1; R2 will rewrite consumers to import from `icons` directly.

import { memo } from 'react';

import type { ScheduleType } from '../../domain/types';
import { KIND_ICON } from '../icons';
import { TOKENS } from '../palette';

interface Props {
  type: ScheduleType;
  size?: number;
  color?: string;
}

function TypeIconImpl({ type, size = 12, color = TOKENS.ink }: Props): React.ReactElement {
  const Cmp = KIND_ICON[type];
  return <Cmp size={size} color={color} />;
}

export const TypeIcon = memo(TypeIconImpl);
