// icon-sets.jsx — 4 icon set explorations for 학교/학원/활동/기타.
// Each set has its own visual language. The user picks one and we wire it
// into Icon.* in app-tokens.jsx.

const ICON_SETS = {
  // ── Set A · Solid pictogram ───────────────────────────────────────────
  filled: {
    name: 'A · 솔리드 픽토그램',
    note: '꽉 찬 픽토그램. 친근하고 가독성 좋음. 작은 사이즈에 강함.',
    icons: {
      school: (p={}) => (
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <path d="M12 2L2 7v1h20V7L12 2z"/>
          <path d="M4 10v10h6v-5h4v5h6V10H4zm3 3h2v2H7v-2zm8 0h2v2h-2v-2z"/>
        </svg>
      ),
      academy: (p={}) => (
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <path d="M3 5a1 1 0 011-1h6.5a2.5 2.5 0 011.5.5V20a3 3 0 00-1.5-.5H4a1 1 0 01-1-1V5z"/>
          <path d="M21 5a1 1 0 00-1-1h-6.5A2.5 2.5 0 0012 4.5V20a3 3 0 011.5-.5H20a1 1 0 001-1V5z"/>
        </svg>
      ),
      activity: (p={}) => (
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <path d="M12 2c.6 5 2.5 7 8 8-5.5 1-7.4 3-8 8-.6-5-2.5-7-8-8 5.5-1 7.4-3 8-8z"/>
        </svg>
      ),
      etc: (p={}) => (
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <circle cx="6" cy="12" r="2.2"/>
          <circle cx="12" cy="12" r="2.2"/>
          <circle cx="18" cy="12" r="2.2"/>
        </svg>
      ),
    },
  },

  // ── Set B · Soft outline ──────────────────────────────────────────────
  outline: {
    name: 'B · 아웃라인',
    note: '얇은 선. 가볍고 차분함. 텍스트 weight 400과 잘 어울림.',
    icons: {
      school: (p={}) => (
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none"
             stroke={p.fill||'currentColor'} strokeWidth="1.7"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9L12 4l9 5"/>
          <path d="M5 9v11h4v-5h6v5h4V9"/>
        </svg>
      ),
      academy: (p={}) => (
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none"
             stroke={p.fill||'currentColor'} strokeWidth="1.7"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h6.5a2 2 0 011.5.7v13a2.5 2.5 0 00-1.5-.5H4z"/>
          <path d="M20 5h-6.5a2 2 0 00-1.5.7v13a2.5 2.5 0 011.5-.5H20z"/>
        </svg>
      ),
      activity: (p={}) => (
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none"
             stroke={p.fill||'currentColor'} strokeWidth="1.7"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3c.5 4 2 5.5 6 6-4 .5-5.5 2-6 6-.5-4-2-5.5-6-6 4-.5 5.5-2 6-6z"/>
        </svg>
      ),
      etc: (p={}) => (
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none"
             stroke={p.fill||'currentColor'} strokeWidth="1.7" strokeLinecap="round">
          <circle cx="6" cy="12" r="1.6"/>
          <circle cx="12" cy="12" r="1.6"/>
          <circle cx="18" cy="12" r="1.6"/>
        </svg>
      ),
    },
  },

  // ── Set C · Concrete objects ──────────────────────────────────────────
  object: {
    name: 'C · 사물 메타포',
    note: '가방·졸업모·팔레트·클립. 그림책 같은 친근함.',
    icons: {
      school: (p={}) => (
        // 가방 (backpack)
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <path d="M9 4a3 3 0 016 0v1h-2V4a1 1 0 00-2 0v1H9V4z"/>
          <path d="M5 9a3 3 0 013-3h8a3 3 0 013 3v9a3 3 0 01-3 3H8a3 3 0 01-3-3V9zm4 2.5a1 1 0 011-1h4a1 1 0 011 1V14a1 1 0 01-1 1h-4a1 1 0 01-1-1v-2.5z"/>
        </svg>
      ),
      academy: (p={}) => (
        // 졸업모 (mortarboard)
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <path d="M2 9l10-5 10 5-10 5L2 9z"/>
          <path d="M6 12v3.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V12l-6 3-6-3z"/>
          <path d="M20 10v5" stroke={p.fill||'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      activity: (p={}) => (
        // 팔레트 (paint palette)
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <path d="M12 3C6.5 3 3 6.8 3 11.5c0 4.7 3.6 8.5 8 8.5 1 0 1.6-.6 1.6-1.5 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h1.7c3 0 5.1-2 5.1-5C20 6.7 16.4 3 12 3z"/>
          <circle cx="7" cy="9" r="1.3" fill="#fff"/>
          <circle cx="12" cy="7" r="1.3" fill="#fff"/>
          <circle cx="16.5" cy="9.5" r="1.3" fill="#fff"/>
        </svg>
      ),
      etc: (p={}) => (
        // 클립 (paperclip)
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none"
             stroke={p.fill||'currentColor'} strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 6l-7 7a3 3 0 004.2 4.2l7-7a5 5 0 00-7-7l-7 7a7 7 0 0010 10l4-4"/>
        </svg>
      ),
    },
  },

  // ── Set D · Abstract geometric ────────────────────────────────────────
  geometric: {
    name: 'D · 추상 도형',
    note: '단순 도형 위주. 정보 밀도 낮은 곳에 강함, 미니멀.',
    icons: {
      school: (p={}) => (
        // 지붕 삼각형
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <path d="M12 4L22 19H2L12 4z"/>
        </svg>
      ),
      academy: (p={}) => (
        // 책 등 (3개 vertical bars)
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <rect x="4"  y="5" width="3.4" height="14" rx="1"/>
          <rect x="10.3" y="5" width="3.4" height="14" rx="1"/>
          <rect x="16.6" y="5" width="3.4" height="14" rx="1"/>
        </svg>
      ),
      activity: (p={}) => (
        // 5-point star
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
          <path d="M12 3l2.5 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.8 19.5l1.1-6L3.5 9.3l6-.8L12 3z"/>
        </svg>
      ),
      etc: (p={}) => (
        // 동심원 ◯●
        <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none"
             stroke={p.fill||'currentColor'} strokeWidth="1.8">
          <circle cx="12" cy="12" r="8"/>
          <circle cx="12" cy="12" r="3" fill={p.fill||'currentColor'}/>
        </svg>
      ),
    },
  },
};

// ─── Comparison artboard ───────────────────────────────────────────────────
function IconSetCompare() {
  const A = AMATTA;
  const CAT_LABELS = [
    ['school',   '학교'],
    ['academy',  '학원'],
    ['activity', '활동'],
    ['etc',      '기타'],
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: A.cream,
      padding: 24, color: A.ink,
      fontFamily: 'Paperlogy, Pretendard, -apple-system, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4 }}>
          카테고리 아이콘 · 4세트 비교
        </div>
        <div style={{ fontSize: 12, color: A.inkSub, marginTop: 4, fontWeight: 400 }}>
          학교 · 학원 · 활동 · 기타 — 마음에 드는 세트 알려줘
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 14, flex: 1, minHeight: 0,
      }}>
        {Object.entries(ICON_SETS).map(([key, set]) => (
          <div key={key} style={{
            background: '#fff', borderRadius: 16, padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
            boxShadow: `inset 0 0 0 1px ${A.hair}`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3 }}>
                {set.name}
              </div>
              <div style={{ fontSize: 10.5, color: A.inkSub, marginTop: 2, fontWeight: 400, letterSpacing: -0.1 }}>
                {set.note}
              </div>
            </div>

            {/* Large display row */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8, padding: '14px 6px',
              background: A.cream, borderRadius: 12,
            }}>
              {CAT_LABELS.map(([cat, label]) => {
                const IconComp = set.icons[cat];
                return (
                  <div key={cat} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4,
                  }}>
                    <IconComp size={26} fill={A.ink}/>
                    <div style={{ fontSize: 9.5, color: A.inkSub, fontWeight: 400 }}>{label}</div>
                  </div>
                );
              })}
            </div>

            {/* In-context: schedule chip preview */}
            <div style={{ fontSize: 10, color: A.inkSub, fontWeight: 400, marginTop: 2 }}>
              일정 블록 안에서
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { cat:'school',   title:'학교',    bg:KID_PALETTE.peach.block },
                { cat:'academy',  title:'영어',    bg:KID_PALETTE.mint.block  },
                { cat:'activity', title:'태권도',  bg:KID_PALETTE.sky.block   },
                { cat:'etc',      title:'기타',    bg:'#EFECE6'                },
              ].map(({cat, title, bg}) => {
                const IconComp = set.icons[cat];
                return (
                  <div key={cat} style={{
                    background: bg, borderRadius: 8, padding: '5px 8px',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <IconComp size={12} fill={A.ink}/>
                    <span style={{ fontSize: 11, fontWeight: 600, color: A.ink }}>{title}</span>
                    <span style={{ fontSize: 9.5, color: A.inkSub, marginLeft: 'auto', fontFamily:'ui-monospace, monospace', fontWeight: 400 }}>15:30</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Alternatives for Set C — 활동 / 기타 ───────────────────────────────────
// User chose Set C overall but wants alternatives for these two.
// Keep the "concrete object" language consistent with 가방/졸업모.
const C_ACTIVITY_ALTS = {
  ball: {
    name: '공',
    note: '운동 활동 직관적',
    icon: (p={}) => (
      <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
        <circle cx="12" cy="12" r="9"/>
        <path d="M3.5 12c2.5-2.5 14.5-2.5 17 0M12 3c-2.5 2.5-2.5 15.5 0 18M5.5 5.5c4 3 9 3 13 0M5.5 18.5c4-3 9-3 13 0"
              stroke={p.bg||'#fff'} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.85"/>
      </svg>
    ),
  },
  brush: {
    name: '붓',
    note: '미술·만들기 활동',
    icon: (p={}) => (
      <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
        <path d="M14 3l7 7-9.5 9.5a2.1 2.1 0 01-3 0L5 16.5a2.1 2.1 0 010-3L14 3z"/>
        <path d="M3 21c2-.3 3.5-1.5 3.8-3.5L8 19.5c-1 2-3 2.5-5 1.5z"/>
      </svg>
    ),
  },
  music: {
    name: '음표',
    note: '음악·예체능 활동',
    icon: (p={}) => (
      <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
        <path d="M9 17a3 3 0 100-6 3 3 0 000 6zM18 14a3 3 0 100-6 3 3 0 000 6z"/>
        <path d="M9 14V5l12-2v9" stroke={p.fill||'currentColor'} strokeWidth="1.8"
              fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
};

const C_ETC_ALTS = {
  pin: {
    name: '압정',
    note: '"기타 메모" 느낌, 따뜻함',
    icon: (p={}) => (
      <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
        <path d="M14 2l8 8-4 1.5-3.5 3.5-1 5-5-5-5 1L6 12.5 9.5 9 14 2z"/>
        <path d="M9 15l-6 6" stroke={p.fill||'currentColor'} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  tag: {
    name: '태그',
    note: '라벨 느낌, 분류 의미 강조',
    icon: (p={}) => (
      <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
        <path d="M3 12l9-9h8v8l-9 9a2 2 0 01-3 0l-5-5a2 2 0 010-3z"/>
        <circle cx="16" cy="8" r="1.6" fill={p.bg||'#fff'}/>
      </svg>
    ),
  },
  sticky: {
    name: '메모',
    note: '포스트잇, 가장 가벼움',
    icon: (p={}) => (
      <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill={p.fill||'currentColor'}>
        <path d="M4 4h12l4 4v12H4z"/>
        <path d="M16 4v4h4" stroke={p.bg||'#fff'} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
};

function IconSetCAlts() {
  const A = AMATTA;
  const C = ICON_SETS.object;

  const Cell = ({ label, IconComp, sub, bg }) => (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '14px 12px',
      display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
      boxShadow: `inset 0 0 0 1px ${A.hair}`,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, background: bg,
        display: 'grid', placeItems: 'center',
      }}>
        <IconComp size={32} fill={A.ink}/>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: -0.3 }}>{label}</div>
      <div style={{ fontSize: 10, color: A.inkSub, fontWeight: 400, textAlign: 'center', lineHeight: 1.35 }}>{sub}</div>
    </div>
  );

  const ContextRow = ({ items }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map(({ title, bg, IconComp }, i) => (
        <div key={i} style={{
          background: bg, borderRadius: 8, padding: '5px 8px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <IconComp size={12} fill={A.ink}/>
          <span style={{ fontSize: 11, fontWeight: 600, color: A.ink }}>{title}</span>
          <span style={{ fontSize: 9.5, color: A.inkSub, marginLeft: 'auto',
            fontFamily: 'ui-monospace, monospace', fontWeight: 400 }}>15:30</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{
      width: '100%', height: '100%', background: A.cream,
      padding: 24, color: A.ink, overflow: 'auto',
      fontFamily: 'Paperlogy, Pretendard, -apple-system, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4 }}>
          Set C · 활동 / 기타 대안
        </div>
        <div style={{ fontSize: 12, color: A.inkSub, marginTop: 4, fontWeight: 400 }}>
          학교(가방) · 학원(졸업모)는 그대로. 활동·기타만 새 옵션을 골라줘.
        </div>
      </div>

      {/* 활동 alternatives */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3, marginBottom: 8 }}>
          활동 · 3개 대안
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Cell label="현재 (팔레트)" IconComp={C.icons.activity} sub="미술 메타포 강함" bg={KID_PALETTE.sky.block}/>
          {Object.entries(C_ACTIVITY_ALTS).map(([k, v]) => (
            <Cell key={k} label={`${v.name}`} IconComp={v.icon} sub={v.note} bg={KID_PALETTE.sky.block}/>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { key:'current', icon: C.icons.activity },
            { key:'ball',    icon: C_ACTIVITY_ALTS.ball.icon },
            { key:'brush',   icon: C_ACTIVITY_ALTS.brush.icon },
            { key:'music',   icon: C_ACTIVITY_ALTS.music.icon },
          ].map(({ key, icon }) => (
            <ContextRow key={key} items={[
              { title:'수영',   bg:KID_PALETTE.peach.block, IconComp: icon },
              { title:'태권도', bg:KID_PALETTE.sky.block,   IconComp: icon },
              { title:'발레',   bg:KID_PALETTE.mint.block,  IconComp: icon },
            ]}/>
          ))}
        </div>
      </div>

      {/* 기타 alternatives */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3, marginBottom: 8 }}>
          기타 · 3개 대안
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Cell label="현재 (클립)" IconComp={C.icons.etc} sub="첨부 느낌이라 약함" bg={A.softGray}/>
          {Object.entries(C_ETC_ALTS).map(([k, v]) => (
            <Cell key={k} label={`${v.name}`} IconComp={v.icon} sub={v.note} bg={A.softGray}/>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { key:'current', icon: C.icons.etc },
            { key:'pin',     icon: C_ETC_ALTS.pin.icon },
            { key:'tag',     icon: C_ETC_ALTS.tag.icon },
            { key:'sticky',  icon: C_ETC_ALTS.sticky.icon },
          ].map(({ key, icon }) => (
            <ContextRow key={key} items={[
              { title:'병원 예약', bg:A.softGray, IconComp: icon },
              { title:'생일파티',  bg:A.softGray, IconComp: icon },
            ]}/>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ICON_SETS, IconSetCompare, IconSetCAlts });
