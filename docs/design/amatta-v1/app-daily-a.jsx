// app-daily-a.jsx — Variation A · Conservative
// Closest to v0: clean, restrained Headspace tone. White-ish bg, tinted kid columns,
// soft outlined schedule blocks, clear hierarchy.

function DailyA({ tab, setTab }) {
  const A = AMATTA;

  return (
    <div style={{
      width: '100%', height: '100%', background: A.cream,
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54, // below status bar
    }}>
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px 4px', gap: 6,
      }}>
        <button style={topBtnA(A)}><Icon.chevL size={20}/></button>
        <div style={{ flex: 1, paddingLeft: 6, minWidth: 0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6 }}>{TODAY.label}</span>
            <span style={{ fontSize: 12, color: A.ink50, fontWeight: 600 }}>{TODAY.weekday} · TODAY</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
          <button style={topBtnA(A)}><Icon.grid size={18}/></button>
          <button style={topBtnA(A)}><Icon.search size={18}/></button>
        </div>
      </div>

      {/* ── Next pickup card ─────────────────────────────────────── */}
      <div style={{ padding: '8px 16px 6px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: A.primaryTint, borderRadius: 14, padding: '10px 12px',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: A.primary,
            display: 'grid', placeItems: 'center', color: '#fff',
            boxShadow: '0 2px 6px rgba(255,147,2,0.35)',
          }}>
            <Icon.car size={18} fill="#fff"/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: A.primaryDeep, fontWeight: 700, letterSpacing: 0.2 }}>다음 픽업 · 1시간 10분 후</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 1 }}>
              오후 3:30 · 지호 <span style={{color:A.ink50, fontWeight:500}}>· 태권도</span>
            </div>
          </div>
          <button style={{
            border: 'none', background: '#fff', color: A.ink, fontWeight: 700,
            fontSize: 12, padding: '6px 12px', borderRadius: 99,
          }}>보기</button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div style={{ padding: '6px 16px 8px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: A.ink04, padding: 4, borderRadius: 99, gap: 4,
        }}>
          {['schedule','todo'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              border: 'none', cursor: 'pointer',
              padding: '8px 10px', borderRadius: 99,
              background: tab === t ? A.ink : 'transparent',
              color: tab === t ? '#fff' : A.ink70,
              fontWeight: 700, fontSize: 13,
              transition: 'all .18s ease',
            }}>{t === 'schedule' ? '일정' : '준비물 & 할일'}</button>
          ))}
        </div>
      </div>

      {/* ── Kid header row ───────────────────────────────────────── */}
      {tab === 'schedule' ? <ScheduleA/> : <TodoA/>}

      {/* ── Bottom dock + FAB ───────────────────────────────────── */}
      <BottomDockA/>
    </div>
  );
}

function topBtnA(A) {
  return {
    width: 36, height: 36, borderRadius: 99, border: 'none',
    background: A.ink04, color: A.ink, cursor: 'pointer',
    display: 'grid', placeItems: 'center',
  };
}

function ScheduleA() {
  const A = AMATTA;
  const slotH = 30;        // 30min slot height
  const totalSlots = (TIME_END - TIME_START) / SLOT_MIN; // 34
  const gridH = slotH * totalSlots;
  const nowTop = ((toMin(NOW_HHMM) - TIME_START) / SLOT_MIN) * slotH;

  // Smart scroll to NOW - 90min
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, nowTop - 90);
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Kid column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: `54px repeat(${KIDS.length}, 1fr)`,
        padding: '0 12px', borderBottom: `1px solid ${A.hair}`,
      }}>
        <div/>
        {KIDS.map(k => {
          const pal = KID_PALETTE[k.palette];
          return (
            <div key={k.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 12px', gap: 6,
            }}>
              <AvatarPH kid={k} size={36}/>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{k.name}</div>
              <div style={{ fontSize: 10, color: A.ink50, fontWeight: 600 }}>{k.grade} · {k.age}세</div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: `54px repeat(${KIDS.length}, 1fr)`,
          padding: '0 12px', height: gridH, position: 'relative',
        }}>
          {/* Time gutter */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: 18 }).map((_, i) => {
              const hour = 6 + i;
              const ap = hour < 12 ? '오전' : '오후';
              const h12 = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
              return (
                <div key={hour} style={{
                  position: 'absolute', top: i * slotH * 2 - 7, left: 0,
                  fontSize: 10, color: A.ink50, fontWeight: 600,
                }}>{ap} {h12}</div>
              );
            })}
          </div>

          {/* Per-kid columns */}
          {KIDS.map(k => {
            const pal = KID_PALETTE[k.palette];
            const events = SCHEDULE[k.id];
            return (
              <div key={k.id} style={{
                position: 'relative', background: pal.bg + '55',
                borderLeft: `1px solid ${A.hair}`,
              }}>
                {/* hour grid lines */}
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: 0, right: 0,
                    top: i * slotH * 2, height: 1, background: A.hair, opacity: 0.6,
                  }}/>
                ))}
                {/* events */}
                {events.map(ev => {
                  const top = slotIndex(ev.start) * slotH;
                  const h = slotSpan(ev.start, ev.end) * slotH;
                  return (
                    <div key={ev.id} title={ev.title} style={{
                      position: 'absolute', left: 3, right: 3, top: top + 1,
                      height: h - 2, background: pal.block, borderRadius: 8,
                      padding: '5px 6px 4px', overflow: 'hidden',
                      boxShadow: `inset 0 0 0 1px ${pal.block}`, color: pal.ink,
                      display: 'flex', flexDirection: 'column', gap: 1,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.15, display:'flex', alignItems:'center', gap:3 }}>
                        <span style={{ display:'inline-flex', alignItems:'center', flex:'0 0 auto', opacity:0.85 }}><KindIcon kind={ev.kind} size={11} fill={pal.ink}/></span>
                        {ev.title}
                        {ev.pickup && <Icon.car size={11} fill={pal.ink}/>}
                      </div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.85 }}>
                        {fmt12hrShort(ev.start)}–{fmt12hrShort(ev.end)}
                      </div>
                      {h > 60 && <div style={{ fontSize: 9, opacity: 0.7, marginTop: 'auto' }}>{ev.place}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Now line */}
          <div style={{
            position: 'absolute', left: 12, right: 12, top: nowTop,
            display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 4,
          }}>
            <div style={{
              background: A.primary, color: '#fff', fontSize: 10, fontWeight: 800,
              padding: '2px 6px', borderRadius: 99, marginRight: -2,
              fontFamily: '"Pretendard", sans-serif',
            }}>{NOW_HHMM}</div>
            <div style={{ flex: 1, height: 2, background: A.primary, borderRadius: 1 }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function TodoA() {
  const A = AMATTA;
  const [items, setItems] = React.useState(TODOS);
  const toggle = (id) => setItems(s => s.map(x => x.id === id ? { ...x, done: !x.done } : x));
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 80px' }}>
      <div style={{ fontSize: 12, color: A.ink50, fontWeight: 700, padding: '6px 4px 10px' }}>
        오늘 일정에 필요한 준비물 {items.length}개
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(t => {
          const kid = KIDS.find(k => k.id === t.kid);
          const pal = KID_PALETTE[kid.palette];
          return (
            <div key={t.id} onClick={() => toggle(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px', borderRadius: 14,
              background: '#fff', border: `1px solid ${A.hair}`, cursor: 'pointer',
              opacity: t.done ? 0.55 : 1,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 7,
                background: t.done ? A.ink : '#fff',
                border: t.done ? 'none' : `1.5px solid ${A.ink30}`,
                display: 'grid', placeItems: 'center', color: '#fff',
                flex: '0 0 auto',
              }}>{t.done && <Icon.check size={14} stroke="#fff"/>}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  textDecoration: t.done ? 'line-through' : 'none',
                }}>{t.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: pal.ink,
                    background: pal.bg, padding: '2px 6px', borderRadius: 99,
                  }}>{kid.name}</span>
                  <span style={{ fontSize: 11, color: A.ink50, fontWeight: 600 }}>{fmtKo(t.due)}까지</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BottomDockA() {
  const A = AMATTA;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 28, background: 'linear-gradient(to top, #fff 60%, rgba(255,255,255,0))',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center',
        padding: '10px 28px 6px', position: 'relative',
      }}>
        <button style={dockBtnA(A, true)}>
          <Icon.home size={22} fill={A.ink}/>
          <span style={{ fontSize: 10, fontWeight: 700 }}>TODAY</span>
        </button>
        <a href="Settings.html" style={{ ...dockBtnA(A, false), textDecoration: 'none' }}>
          <Icon.gear size={22} fill={A.ink50}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: A.ink50 }}>SETTING</span>
        </a>
        <button style={{
          position: 'absolute', left: '50%', top: -10, transform: 'translateX(-50%)',
          width: 56, height: 56, borderRadius: 99, border: 'none',
          background: A.primary, color: '#fff', cursor: 'pointer',
          boxShadow: '0 8px 20px rgba(255,147,2,0.45), 0 2px 4px rgba(0,0,0,0.08)',
          display: 'grid', placeItems: 'center',
        }}>
          <Icon.plus size={26}/>
        </button>
      </div>
    </div>
  );
}
function dockBtnA(A, active) {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
    color: active ? A.ink : A.ink50,
  };
}

Object.assign(window, { DailyA });
