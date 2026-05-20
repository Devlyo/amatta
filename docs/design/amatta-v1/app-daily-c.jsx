// app-daily-c.jsx — Variation C · Bold
// Headspace-grade saturated columns, white floating event cards, big illustrated hero,
// playful sparkle decorations. The most expressive of the three.

function DailyC({ tab, setTab }) {
  const A = AMATTA;

  return (
    <div style={{
      width: '100%', height: '100%', background: A.cream,
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54,
    }}>
      {/* ── Top bar — minimal, all left-aligned ─────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 18px 0',
      }}>
        <button style={topBtnC(A, A.ink04)}><Icon.chevL size={18}/></button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={topBtnC(A, A.ink04)}><Icon.grid size={16}/></button>
          <button style={topBtnC(A, A.ink04)}><Icon.search size={16}/></button>
        </div>
      </div>

      {/* ── Big title ───────────────────────────────────────────── */}
      <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: A.ink50, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: '"Pretendard", sans-serif' }}>
            TUE · 5월 5일
          </div>
          <div style={{
            fontSize: 38, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1,
            marginTop: 4,
          }}>
            오늘 <span style={{ color: A.primary }}>일정</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', color: A.primary, marginBottom: 4 }}>
          <Icon.sparkle size={20}/>
        </div>
      </div>

      {/* ── HERO pickup banner — big bold illustration block ───── */}
      <div style={{ padding: '8px 14px 10px' }}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: A.primary, borderRadius: 24,
          padding: '14px 16px 14px', color: '#fff',
          boxShadow: '0 12px 28px rgba(255,147,2,0.32)',
        }}>
          {/* swooshy decoration */}
          <svg style={{ position: 'absolute', right: -20, top: -30, opacity: 0.25 }} width="160" height="160" viewBox="0 0 160 160">
            <circle cx="120" cy="40" r="50" fill="#FBE26E"/>
            <circle cx="140" cy="120" r="30" fill="#fff"/>
          </svg>
          <div style={{ position: 'absolute', top: 12, right: 16, color: '#FFE6CC' }}><Icon.sparkle size={14}/></div>
          <div style={{ position: 'absolute', bottom: 14, right: 26, color: '#FFF', opacity: 0.85 }}><Icon.sparkle size={10}/></div>

          {/* placeholder illustration slot */}
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            width: 78, height: 78, borderRadius: 20,
            background: 'rgba(255,255,255,0.22)',
            border: '1.5px dashed rgba(255,255,255,0.55)',
            display: 'grid', placeItems: 'center',
            fontFamily: '"Pretendard", sans-serif', fontSize: 8, color: 'rgba(255,255,255,0.95)',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <div>
              <Icon.car size={32} fill="rgba(255,255,255,0.95)"/>
              <div style={{ marginTop: 2 }}>character<br/>+ car</div>
            </div>
          </div>

          <div style={{ paddingRight: 100 }}>
            <div style={{
              display: 'inline-block', background: 'rgba(0,0,0,0.18)',
              padding: '3px 10px', borderRadius: 99,
              fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
            }}>다음 픽업 · 1h 10m</div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.8, marginTop: 8, lineHeight: 1 }}>
              지호 · 태권도
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 13, fontWeight: 700, marginTop: 8,
              background: 'rgba(255,255,255,0.22)', padding: '4px 10px', borderRadius: 99,
              fontFamily: '"Pretendard", sans-serif',
            }}>
              15:30 → 16:30
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs as toggle pills ────────────────────────────────── */}
      <div style={{ padding: '4px 14px 10px', display: 'flex', gap: 8 }}>
        {[['schedule','일정','📅'],['todo','준비물 & 할일','📋']].map(([k,label]) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{
              border: 'none', cursor: 'pointer',
              padding: '8px 14px', borderRadius: 99,
              background: active ? A.ink : A.ink04,
              color: active ? '#fff' : A.ink70,
              fontWeight: 800, fontSize: 13, letterSpacing: -0.2,
            }}>{label}</button>
          );
        })}
      </div>

      {tab === 'schedule' ? <ScheduleC/> : <TodoC/>}
      <BottomDockC/>
    </div>
  );
}

function topBtnC(A, bg) {
  return {
    width: 36, height: 36, borderRadius: 12, border: 'none',
    background: bg, color: A.ink, cursor: 'pointer',
    display: 'grid', placeItems: 'center',
  };
}

function ScheduleC() {
  const A = AMATTA;
  const slotH = 32;
  const totalSlots = (TIME_END - TIME_START) / SLOT_MIN;
  const gridH = slotH * totalSlots;
  const nowTop = ((toMin(NOW_HHMM) - TIME_START) / SLOT_MIN) * slotH;

  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, nowTop - 110);
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Kid column headers — bold colored swimlane caps */}
      <div style={{
        display: 'grid', gridTemplateColumns: `44px repeat(${KIDS.length}, 1fr)`,
        gap: 6, padding: '0 12px 8px',
      }}>
        <div/>
        {KIDS.map(k => {
          const pal = KID_PALETTE[k.palette];
          return (
            <div key={k.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 4px 12px',
              background: pal.dot, borderRadius: '14px 14px 0 0',
              color: '#fff', position: 'relative',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 99,
                background: '#fff', color: pal.ink,
                display: 'grid', placeItems: 'center',
                fontFamily: '"Pretendard", sans-serif', fontSize: 9, fontWeight: 700,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                position: 'relative',
              }}>
                {k.avatar.slice(0,3)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, marginTop: 6, letterSpacing: -0.3 }}>{k.name}</div>
              <div style={{
                fontSize: 9, fontWeight: 800, opacity: 0.85, marginTop: -1,
                fontFamily: '"Pretendard", sans-serif',
              }}>{k.grade}·{k.age}</div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: `44px repeat(${KIDS.length}, 1fr)`,
          gap: 6, padding: '0 12px', height: gridH, position: 'relative',
        }}>
          {/* Gutter */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: 18 }).map((_, i) => {
              const hour = 6 + i;
              const h12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
              return (
                <div key={hour} style={{
                  position: 'absolute', top: i * slotH * 2 - 7, left: 0, right: 0,
                  textAlign: 'right', paddingRight: 4,
                  fontSize: 11, fontWeight: 800, color: A.ink50,
                  fontFamily: '"Pretendard", sans-serif',
                }}>
                  {String(h12).padStart(2,'0')}
                  <span style={{ fontSize: 7, opacity: 0.7, marginLeft: 1 }}>{hour < 12 ? 'a' : 'p'}</span>
                </div>
              );
            })}
          </div>

          {/* Kid columns — saturated tinted background, white event cards */}
          {KIDS.map(k => {
            const pal = KID_PALETTE[k.palette];
            const events = SCHEDULE[k.id];
            return (
              <div key={k.id} style={{
                position: 'relative', background: pal.bg, borderRadius: 12,
                overflow: 'hidden',
              }}>
                {/* subtle hour dots */}
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: '50%', top: i * slotH * 2, transform: 'translate(-50%,-50%)',
                    width: 4, height: 4, borderRadius: 99, background: pal.dot, opacity: 0.25,
                  }}/>
                ))}
                {events.map(ev => {
                  const top = slotIndex(ev.start) * slotH;
                  const h = slotSpan(ev.start, ev.end) * slotH;
                  return (
                    <div key={ev.id} style={{
                      position: 'absolute', left: 5, right: 5, top: top + 2,
                      height: h - 4, background: '#fff', borderRadius: 12,
                      padding: '7px 8px 6px',
                      boxShadow: `0 2px 8px rgba(0,0,0,0.06), inset 0 0 0 1px ${pal.block}`,
                      display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 900, color: pal.ink, letterSpacing: -0.2,
                        lineHeight: 1.1,
                      }}>
                        <span style={{ display:'inline-flex', alignItems:'center', flex:'0 0 auto', opacity:0.85 }}><KindIcon kind={ev.kind} size={12} fill={pal.ink}/></span>
                        {ev.title}
                        {ev.pickup && <div style={{
                          marginLeft: 'auto',
                          background: AMATTA.primary, color: '#fff', borderRadius: 6,
                          width: 16, height: 16, display: 'grid', placeItems: 'center',
                        }}><Icon.car size={10} fill="#fff"/></div>}
                      </div>
                      <div style={{
                        fontSize: 9.5, fontWeight: 800, color: AMATTA.ink50,
                        fontFamily: '"Pretendard", sans-serif',
                      }}>{fmt12hrShort(ev.start)}–{fmt12hrShort(ev.end)}</div>
                      {h > 60 && (
                        <div style={{ fontSize: 9, fontWeight: 700, color: AMATTA.ink50, marginTop: 'auto' }}>
                          {ev.place}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Now bar — full-width with floating badge */}
          <div style={{
            position: 'absolute', left: 12, right: 12, top: nowTop,
            display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 4,
          }}>
            <div style={{ width: 36, fontFamily: '"Pretendard", sans-serif', textAlign: 'right' }}>
              <div style={{
                display: 'inline-block', background: A.primary, color: '#fff',
                fontSize: 10, fontWeight: 900, padding: '3px 7px', borderRadius: 99,
                boxShadow: '0 3px 8px rgba(255,147,2,0.5)',
              }}>{NOW_HHMM}</div>
            </div>
            <div style={{
              flex: 1, height: 2,
              background: `repeating-linear-gradient(to right, ${A.primary} 0 6px, transparent 6px 10px)`,
              marginLeft: 6,
            }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function TodoC() {
  const A = AMATTA;
  const [items, setItems] = React.useState(TODOS);
  const toggle = (id) => setItems(s => s.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const remaining = items.filter(t => !t.done).length;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px 90px' }}>
      {/* Progress header */}
      <div style={{
        background: A.ink, color: '#fff', borderRadius: 18,
        padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 99, background: A.primary,
          display: 'grid', placeItems: 'center',
        }}>
          <Icon.bell size={20} fill="#fff"/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>오늘 챙길 것 {remaining}개</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>모두 마치면 알림이 꺼져요</div>
        </div>
        <div style={{
          fontSize: 22, fontWeight: 900,
          fontFamily: '"Pretendard", sans-serif',
        }}>{items.length - remaining}<span style={{ opacity: 0.5, fontSize: 14 }}>/{items.length}</span></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(t => {
          const kid = KIDS.find(k => k.id === t.kid);
          const pal = KID_PALETTE[kid.palette];
          return (
            <div key={t.id} onClick={() => toggle(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 16,
              background: t.done ? A.ink04 : pal.bg, cursor: 'pointer',
              opacity: t.done ? 0.6 : 1,
              borderLeft: `5px solid ${pal.dot}`,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 99,
                background: t.done ? pal.dot : '#fff',
                border: t.done ? 'none' : `2px solid ${pal.dot}`,
                display: 'grid', placeItems: 'center', color: '#fff',
                flex: '0 0 auto',
              }}>{t.done && <Icon.check size={14} stroke="#fff"/>}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 800, color: pal.ink, letterSpacing: -0.2,
                  textDecoration: t.done ? 'line-through' : 'none',
                }}>{t.title}</div>
                <div style={{
                  fontSize: 10, color: pal.ink, opacity: 0.7, marginTop: 2,
                  fontFamily: '"Pretendard", sans-serif', fontWeight: 700,
                }}>{kid.name} · {t.due}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BottomDockC() {
  const A = AMATTA;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 28, paddingTop: 8,
      background: `linear-gradient(to top, ${A.cream} 60%, rgba(252,251,247,0))`,
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center',
        padding: '6px 32px', position: 'relative',
      }}>
        <button style={dockBtnC(A, true)}>
          <div style={{
            width: 44, height: 36, borderRadius: 14,
            background: A.primaryTint, color: A.primaryDeep,
            display: 'grid', placeItems: 'center',
          }}>
            <Icon.home size={20} fill={A.primaryDeep}/>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: A.primaryDeep, marginTop: 4 }}>TODAY</span>
        </button>
        <a href="Settings.html" style={{ ...dockBtnC(A, false), textDecoration: 'none' }}>
          <div style={{
            width: 44, height: 36, borderRadius: 14,
            background: 'transparent', color: A.ink50,
            display: 'grid', placeItems: 'center',
          }}>
            <Icon.gear size={20} fill={A.ink50}/>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: A.ink50, marginTop: 4 }}>SETTING</span>
        </a>
        <button style={{
          position: 'absolute', left: '50%', top: -22, transform: 'translateX(-50%)',
          width: 62, height: 62, borderRadius: 99,
          border: `4px solid ${A.cream}`,
          background: A.primary, color: '#fff', cursor: 'pointer',
          boxShadow: '0 10px 24px rgba(255,147,2,0.5)',
          display: 'grid', placeItems: 'center',
        }}>
          <Icon.plus size={28}/>
        </button>
      </div>
    </div>
  );
}
function dockBtnC(A, active) {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  };
}

Object.assign(window, { DailyC });
