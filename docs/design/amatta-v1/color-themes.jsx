// color-themes.jsx — Primary + Kid Palette combos for the brand exploration.
// Each theme bundles: primary, primaryDeep, primaryTint + a peach/mint/sky
// palette so the whole brand reads cohesively. User picks one.

const COLOR_THEMES = [
  {
    id: 'sunset-pop',
    name: '① 선셋 팝',
    note: 'Sunset Orange 메인 + 라벤더/민트/블루 자녀. 따뜻 + 채도 살아있는 기본형.',
    primary: '#FF7144',
    primaryDeep: '#D8501F',
    primaryTint: '#FFE8D2',
    kids: {
      peach: { bg: '#F2EDFF', block: '#E0D2FF', ink: '#5A3DA8', dot: '#C7B0FF' }, // French Lavender
      mint:  { bg: '#E5F7D6', block: '#C0F0AA', ink: '#456A2A', dot: '#8DD56C' }, // Vibrant Mint
      sky:   { bg: '#D8E6FF', block: '#B8C8F5', ink: '#1F2D8A', dot: '#334ED8' }, // Electric Blue
    },
  },
  {
    id: 'electric',
    name: '② 일렉트릭',
    note: 'Electric Blue 메인 + 오렌지/시트러스/페투니아. 모던, 콘트라스트 강함.',
    primary: '#334ED8',
    primaryDeep: '#1F2D8A',
    primaryTint: '#D8E6FF',
    kids: {
      peach: { bg: '#FFE8D2', block: '#FFD0AE', ink: '#B94522', dot: '#FF7144' }, // Sunset Orange
      mint:  { bg: '#F4F5C0', block: '#ECEE7A', ink: '#6E7228', dot: '#C4C82F' }, // Citrus Green (deeper)
      sky:   { bg: '#FCE5FC', block: '#F8C8F8', ink: '#7A2B7A', dot: '#E07AE0' }, // Petunia Pink
    },
  },
  {
    id: 'deep-green',
    name: '③ 딥 그린 + 비비드',
    note: 'Deep Green 메인 + 자녀는 비비드 3색. 무게감 있는 베이스에 자녀가 톡톡 튐.',
    primary: '#33473B',
    primaryDeep: '#1F2D24',
    primaryTint: '#C5D9CC',
    kids: {
      peach: { bg: '#FFE8D2', block: '#FFD0AE', ink: '#B94522', dot: '#FF7144' }, // Sunset Orange
      mint:  { bg: '#F4F5C0', block: '#ECEE7A', ink: '#6E7228', dot: '#C4C82F' }, // Citrus Green
      sky:   { bg: '#D8E6FF', block: '#B8C8F5', ink: '#1F2D8A', dot: '#334ED8' }, // Electric Blue
    },
  },
  {
    id: 'lavender',
    name: '④ 라벤더 팝',
    note: 'French Lavender 메인 + 따뜻 자녀. 부드럽지만 모던, 가장 친근.',
    primary: '#9E84D6',
    primaryDeep: '#6E4FBE',
    primaryTint: '#E0D2FF',
    kids: {
      peach: { bg: '#FFE8D2', block: '#FFD0AE', ink: '#B94522', dot: '#FF7144' }, // Sunset Orange
      mint:  { bg: '#E5F7D6', block: '#C0F0AA', ink: '#456A2A', dot: '#8DD56C' }, // Vibrant Mint
      sky:   { bg: '#FCE5FC', block: '#F8C8F8', ink: '#7A2B7A', dot: '#E07AE0' }, // Petunia Pink
    },
  },
  {
    id: 'citrus',
    name: '⑤ 시트러스',
    note: 'Citrus Green 메인 + 핑크/오렌지/블루. 옵티미스틱하고 에너지 폭발.',
    primary: '#B4B832',
    primaryDeep: '#8A8E20',
    primaryTint: '#ECEE7A',
    kids: {
      peach: { bg: '#FFE8D2', block: '#FFD0AE', ink: '#B94522', dot: '#FF7144' }, // Sunset Orange
      mint:  { bg: '#FCE5FC', block: '#F8C8F8', ink: '#7A2B7A', dot: '#E07AE0' }, // Petunia Pink
      sky:   { bg: '#D8E6FF', block: '#B8C8F5', ink: '#1F2D8A', dot: '#334ED8' }, // Electric Blue
    },
  },
  {
    id: 'petunia',
    name: '⑥ 페투니아 팝',
    note: 'Petunia Pink 메인 + 시트러스/민트/블루. 가장 컬러풀, 가장 즐거움.',
    primary: '#D267D2',
    primaryDeep: '#A044A0',
    primaryTint: '#FCE5FC',
    kids: {
      peach: { bg: '#F4F5C0', block: '#ECEE7A', ink: '#6E7228', dot: '#C4C82F' }, // Citrus Green
      mint:  { bg: '#E5F7D6', block: '#C0F0AA', ink: '#456A2A', dot: '#8DD56C' }, // Vibrant Mint
      sky:   { bg: '#D8E6FF', block: '#B8C8F5', ink: '#1F2D8A', dot: '#334ED8' }, // Electric Blue
    },
  },
  // ─── 레몬 노랑 시리즈 ───────────────────────────────────────────────
  {
    id: 'soft-lemon',
    name: '⑦ 소프트 레몬',
    note: '부드러운 레몬 + 따뜻한 자녀. 친근 + 채도 살아있는 균형.',
    primary: '#FFD24A',
    primaryDeep: '#E0A800',
    primaryTint: '#FFF1B8',
    kids: {
      peach: { bg: '#FFE8D2', block: '#FFD0AE', ink: '#B94522', dot: '#FF7144' }, // Sunset Orange
      mint:  { bg: '#E5F7D6', block: '#C0F0AA', ink: '#456A2A', dot: '#8DD56C' }, // Vibrant Mint
      sky:   { bg: '#D8E6FF', block: '#B8C8F5', ink: '#1F2D8A', dot: '#334ED8' }, // Electric Blue
    },
  },
  {
    id: 'vivid-lemon',
    name: '⑧ 비비드 레몬',
    note: '쨍한 레몬 + 자녀 비비드. 가장 에너지 넘침, 알림 같은 느낌.',
    primary: '#FFE100',
    primaryDeep: '#C9A800',
    primaryTint: '#FFF480',
    kids: {
      peach: { bg: '#FFE8D2', block: '#FFD0AE', ink: '#B94522', dot: '#FF7144' }, // Sunset Orange
      mint:  { bg: '#E5F7D6', block: '#C0F0AA', ink: '#456A2A', dot: '#8DD56C' }, // Vibrant Mint
      sky:   { bg: '#FCE5FC', block: '#F8C8F8', ink: '#7A2B7A', dot: '#E07AE0' }, // Petunia Pink
    },
  },
  {
    id: 'amber-lemon',
    name: '⑨ 앰버 레몬',
    note: '현재 #FBB008 톤. 머스타드-앰버 쪽, 조금 더 차분하고 어른스러움.',
    primary: '#FBB008',
    primaryDeep: '#C8851E',
    primaryTint: '#FFE5B0',
    kids: {
      peach: { bg: '#F2EDFF', block: '#E0D2FF', ink: '#5A3DA8', dot: '#C7B0FF' }, // French Lavender
      mint:  { bg: '#E5F7D6', block: '#C0F0AA', ink: '#456A2A', dot: '#8DD56C' }, // Vibrant Mint
      sky:   { bg: '#D8E6FF', block: '#B8C8F5', ink: '#1F2D8A', dot: '#334ED8' }, // Electric Blue
    },
  },
];

// ─── Mini UI preview applied to a theme ────────────────────────────────────
function ThemePreview({ theme }) {
  const A = AMATTA;
  const KIDS_MINI = [
    { name: '민준', palette: 'peach', avatar: 'rabbit',  title: '수영',   time: '15:00' },
    { name: '서윤', palette: 'mint',  avatar: 'panda',   title: '미술',   time: '14:30' },
    { name: '지호', palette: 'sky',   avatar: 'cat',     title: '태권도', time: '15:30' },
  ];

  // Auto-pick readable text color for the gradient pill based on primary luminance.
  // Yellows / pales need dark ink; saturated darks need white.
  const primaryHex = theme.primary.replace('#','');
  const r = parseInt(primaryHex.slice(0,2),16);
  const g = parseInt(primaryHex.slice(2,4),16);
  const b = parseInt(primaryHex.slice(4,6),16);
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  const onPrimary = luminance > 0.65 ? '#1d1d1b' : '#fff';
  const onPrimarySub = luminance > 0.65 ? 'rgba(29,29,27,0.65)' : 'rgba(255,255,255,0.9)';

  // Pickup pill mini
  return (
    <div style={{
      background: A.cream, borderRadius: 14, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Pickup pill */}
      <div style={{
        background: `linear-gradient(100deg, ${theme.primary} 0%, ${theme.primaryDeep} 100%)`,
        borderRadius: 12, padding: '8px 10px',
        color: onPrimary, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8,
          background: onPrimary === '#fff' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.10)',
          display: 'grid', placeItems: 'center',
          boxShadow: `inset 0 0 0 1px ${onPrimary === '#fff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)'}`,
        }}>
          <Icon.car size={14} fill={onPrimary}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 400, letterSpacing: 0.5, color: onPrimarySub }}>
            NEXT PICKUP · 1h 10m
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: -0.2 }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', marginRight: 4 }}>15:30</span>
            지호 · 태권도
          </div>
        </div>
      </div>

      {/* Kid header chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
        {KIDS_MINI.map(k => {
          const pal = theme.kids[k.palette];
          return (
            <div key={k.name} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 6px', background: A.softGray, borderRadius: 8,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 99,
                background: '#fff',
                display: 'grid', placeItems: 'center',
                overflow: 'hidden', flex: '0 0 auto',
              }}>
                <KidCharacter kind={k.avatar} fill={pal.dot} ink={A.ink} size={17}/>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: A.ink, letterSpacing: -0.2 }}>{k.name}</div>
            </div>
          );
        })}
      </div>

      {/* Event blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {KIDS_MINI.map(k => {
          const pal = theme.kids[k.palette];
          return (
            <div key={k.name} style={{
              background: pal.block, borderRadius: 6, padding: '5px 8px',
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: `inset 0 -2px 0 ${pal.dot}30`,
            }}>
              <Icon.activity size={9} fill={A.ink}/>
              <span style={{ fontSize: 10, fontWeight: 600, color: A.ink }}>{k.title}</span>
              <span style={{
                fontSize: 8.5, fontWeight: 400, color: A.inkSub,
                marginLeft: 'auto', fontFamily: 'ui-monospace, monospace',
              }}>{k.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ColorThemeCompare() {
  const A = AMATTA;
  return (
    <div style={{
      width: '100%', height: '100%', background: A.cream,
      padding: 24, color: A.ink, overflow: 'auto',
      fontFamily: 'Paperlogy, Pretendard, -apple-system, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4 }}>
          컬러 테마 · HyFlow 톤 + 레몬 시리즈 (9개)
        </div>
        <div style={{ fontSize: 12, color: A.inkSub, marginTop: 4, fontWeight: 400 }}>
          ①~⑥ HyFlow 팔레트 조합 + ⑦~⑨ 레몬 노랑 3가지 변형.
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
      }}>
        {COLOR_THEMES.map(theme => (
          <div key={theme.id} style={{
            background: '#fff', borderRadius: 16,
            boxShadow: `inset 0 0 0 1px ${A.hair}`,
            padding: 14,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Header */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3 }}>
                {theme.name}
              </div>
              <div style={{ fontSize: 10.5, color: A.inkSub, marginTop: 3, fontWeight: 400, letterSpacing: -0.1, lineHeight: 1.4 }}>
                {theme.note}
              </div>
            </div>

            {/* Color swatches row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Primary big swatch */}
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: theme.primary,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', bottom: 3, left: 5,
                  fontSize: 7.5, color: '#fff', fontWeight: 600,
                  fontFamily: 'ui-monospace, monospace', opacity: 0.85,
                }}>P</div>
              </div>
              {/* Kid dots */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {['peach','mint','sky'].map(k => (
                  <div key={k} style={{ display: 'flex', gap: 3 }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 4,
                      background: theme.kids[k].dot,
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                    }}/>
                    <span style={{
                      width: 14, height: 14, borderRadius: 4,
                      background: theme.kids[k].block,
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                    }}/>
                  </div>
                ))}
              </div>
              {/* hex codes */}
              <div style={{
                marginLeft: 'auto', fontSize: 8.5, color: A.inkSub,
                fontFamily: 'ui-monospace, monospace', fontWeight: 400,
                textAlign: 'right', lineHeight: 1.4,
              }}>
                <div>{theme.primary}</div>
                <div>{theme.kids.peach.dot}</div>
                <div>{theme.kids.mint.dot}</div>
                <div>{theme.kids.sky.dot}</div>
              </div>
            </div>

            {/* Mini preview */}
            <ThemePreview theme={theme}/>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { COLOR_THEMES, ThemePreview, ColorThemeCompare });
