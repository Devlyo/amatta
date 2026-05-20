// pickup-options.jsx — 10 alternative gradient colors for the "Next Pickup" pill.
// Keep the same gradient shape (light → deep → light) and glow so the
// "shiny" feeling stays identical. User picks one via Tweaks.

// Each option: light (edge), deep (middle), shadow rgb triplet.
// All have the same shimmer pattern: linear-gradient(100deg, light 0%, deep 60%, light 100%)
const PICKUP_OPTIONS = {
  // ── 옐로우 패밀리 — primary(#FBB008)와 같은 톤족 ──────────────────────────
  primary: {
    name: '① 앰버 (현재)',
    note: '#FBB008. Primary 그대로. 같은 노랑이라 다소 단조로움.',
    light: '#FBB008', deep: '#C8851E', shadow: '255,176,8',
  },
  lemon: {
    name: '② 레몬',
    note: '쨍한 레몬. Primary보다 차가운 노랑, 가장 눈에 띔.',
    light: '#FFD800', deep: '#C8A500', shadow: '255,216,0',
  },
  sunshine: {
    name: '③ 선샤인',
    note: '살짝 밝은 톤. 부드럽고 친근.',
    light: '#FFC42E', deep: '#D89E1A', shadow: '255,196,46',
  },
  honey: {
    name: '④ 허니 골드',
    note: '깊은 황금. Primary보다 한 단계 진해서 깊이감 ↑',
    light: '#E5A623', deep: '#B07B16', shadow: '229,166,35',
  },
  mustard: {
    name: '⑤ 머스타드',
    note: '톤 다운. 가장 차분, 빈티지 느낌. 픽업 강조 안 함.',
    light: '#C8851E', deep: '#8E5C12', shadow: '200,133,30',
  },
  darkGold: {
    name: '⑥ 다크 골드',
    note: '깊은 골드. 거의 브라운에 가까움, 정돈된 느낌.',
    light: '#A87E22', deep: '#6E5114', shadow: '168,126,34',
  },
  butter: {
    name: '⑦ 버터',
    note: '파스텔 버터. 가장 라이트, 픽업이 거의 안 도드라짐.',
    light: '#F1D682', deep: '#C9AA4A', shadow: '241,214,130',
  },
  amberGlow: {
    name: '⑧ 앰버 글로우',
    note: '노랑-주황 중간. 따뜻하지만 차별화 명확.',
    light: '#FF9B2E', deep: '#C46F14', shadow: '255,155,46',
  },

  // ── 노랑과 어울리는 보완 톤 (단조로움 깨기) ────────────────────────────
  cocoa: {
    name: '⑨ 코코아 브라운',
    note: '노랑+갈색은 클래식. 콘트라스트 + 따뜻함, 추천.',
    light: '#8B5A2B', deep: '#5C3A18', shadow: '139,90,43',
  },
  espresso: {
    name: '⑩ 에스프레소',
    note: '딥 브라운. 가장 무게감 있고 어른스러움.',
    light: '#4E342E', deep: '#2C1810', shadow: '78,52,46',
  },
  ink: {
    name: '⑪ 잉크 블랙',
    note: '거의 검정. GNB 플러스 버튼이랑 톤 통일 → 시스템 일관성.',
    light: '#33333D', deep: '#1A1A22', shadow: '40,40,50',
  },

  // ── 기존 대안 (보색/유사색 등) 참고용 ────────────────────────────────
  indigo: {
    name: '⑫ 인디고',
    note: '노랑의 보색. 강한 콘트라스트.',
    light: '#4A66E8', deep: '#1F2D8A', shadow: '74,102,232',
  },
  sunset: {
    name: '⑬ 선셋 오렌지',
    note: '유사색. 따뜻한 톤 패밀리 안에서 채도 다름.',
    light: '#FF7144', deep: '#C84518', shadow: '255,113,68',
  },
  petunia: {
    name: '⑭ 페투니아 핑크',
    note: '의외성. 가족 앱에 따뜻함, 발랄함.',
    light: '#E07AE0', deep: '#A044A0', shadow: '224,122,224',
  },
};

// Compute readable text color from light hex (luminance heuristic)
function pickupOnColor(light) {
  const h = light.replace('#','');
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  const L = (0.299*r + 0.587*g + 0.114*b) / 255;
  return L > 0.65 ? '#1d1d1b' : '#fff';
}

// ─── A single pickup pill rendered with the given option ───────────────────
function PickupPill({ option, label, sub, time = '15:30', who = '지호 · 태권도' }) {
  const A = AMATTA;
  const onPrimary = pickupOnColor(option.light);
  const onSub = onPrimary === '#fff' ? 'rgba(255,255,255,0.85)' : 'rgba(29,29,27,0.6)';

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(100deg, ${option.light} 0%, ${option.deep} 60%, ${option.light} 100%)`,
      borderRadius: 16, padding: '10px 12px',
      color: onPrimary, display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: `0 6px 16px rgba(${option.shadow},0.28)`,
    }}>
      {/* sparkles preserved */}
      <div style={{ position: 'absolute', top: 6, right: 14, color: onPrimary, opacity: onPrimary === '#fff' ? 0.6 : 0.4 }}>
        <Icon.sparkle size={11}/>
      </div>
      <div style={{ position: 'absolute', bottom: 4, right: 64, color: onPrimary, opacity: onPrimary === '#fff' ? 0.4 : 0.25 }}>
        <Icon.sparkle size={8}/>
      </div>

      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: onPrimary === '#fff' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.10)',
        display: 'grid', placeItems: 'center', flex: '0 0 auto',
        boxShadow: `inset 0 0 0 1px ${onPrimary === '#fff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)'}`,
      }}>
        <Icon.car size={20} fill={onPrimary}/>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 400, letterSpacing: 0.6,
          textTransform: 'uppercase', color: onSub,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 99,
            background: onPrimary,
            animation: 'amattaPulse 1.6s ease-in-out infinite',
          }}/>
          NEXT PICKUP · 1h 10m
        </div>
        <div style={{
          fontSize: 15, fontWeight: 600, marginTop: 3, letterSpacing: -0.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', marginRight: 6 }}>{time}</span>
          {who}
        </div>
      </div>

      <button style={{
        border: 'none', background: onPrimary === '#fff' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.95)',
        color: '#1d1d1b',
        fontWeight: 600, fontSize: 11, padding: '7px 12px', borderRadius: 99,
        cursor: 'pointer', flex: '0 0 auto', letterSpacing: -0.2,
      }}>보기</button>
    </div>
  );
}

// ─── Comparison artboard ───────────────────────────────────────────────────
function PickupOptionsCompare() {
  const A = AMATTA;
  return (
    <div style={{
      width: '100%', height: '100%', background: A.cream,
      padding: 24, color: A.ink, overflow: 'auto',
      fontFamily: 'Paperlogy, Pretendard, -apple-system, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4 }}>
          Next Pickup · 옐로우 패밀리 + 보완 톤
        </div>
        <div style={{ fontSize: 12, color: A.inkSub, marginTop: 4, fontWeight: 400, lineHeight: 1.5 }}>
          ①~⑧ 노랑 패밀리 (같은 톤 안에서 깊이 차이로 차별화) · ⑨~⑪ 노랑과 짝 잘 맞는 보완 톤 (브라운/잉크) · ⑫~⑭ 보색/유사색 참고.
          <br/>
          <strong style={{ fontWeight: 600, color: A.ink }}>추천:</strong> ④ 허니 골드, ⑤ 머스타드, ⑨ 코코아 브라운 — 노랑 primary와 충돌 없이 깊이감 만듦.
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
      }}>
        {Object.entries(PICKUP_OPTIONS).map(([key, opt]) => (
          <div key={key} style={{
            background: '#fff', borderRadius: 14,
            boxShadow: `inset 0 0 0 1px ${A.hair}`,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3 }}>{opt.name}</div>
              <div style={{
                fontSize: 9.5, color: A.inkSub, fontWeight: 400,
                fontFamily: 'ui-monospace, monospace',
              }}>{opt.light} → {opt.deep}</div>
            </div>
            <div style={{ fontSize: 10.5, color: A.inkSub, fontWeight: 400, letterSpacing: -0.1 }}>
              {opt.note}
            </div>
            <PickupPill option={opt}/>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes amattaPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.4); opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { PICKUP_OPTIONS, pickupOnColor, PickupPill, PickupOptionsCompare });
