// app-multi-grid.jsx — 일간뷰의 [▦] 보기 토글로 진입하는 멀티-자녀 주간 그리드.
// 같은 주(SUN–SAT)를 자녀 4명의 lane으로 동시에 보여줌.
//
// 시각 규칙
// - 각 요일 컬럼 = N개 lane (자녀당 1개) 좌→우 KIDS 순서
// - lane 안에 자녀 색 세로 막대 = 일정 지속시간
// - 막대 위에 자녀 색 원형 칩 + 종류 아이콘 (학교/학원/활동/기타)
// - 막대/칩 탭 → 작은 popover 툴팁 (자녀·제목·시간·장소)
//
// 시간축
// - 06:00 – 21:00 표시 (16시간), 60min = 56px
// - now-line (라임) + AM/PM 라벨

const MG_HOUR_START = 6;
const MG_HOUR_END = 21;
const MG_HOUR_PX = 56;
const MG_GUTTER = 44;

function _minSinceMG(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h - MG_HOUR_START) * 60 + m;
}
function _yPxMG(hhmm) {
  return _minSinceMG(hhmm) / 60 * MG_HOUR_PX;
}

function MultiKidGridB({ tab, setTab, onModeSwitch }) {
  const A = AMATTA;
  const allKidIds = KIDS.map((k) => k.id);
  const [activeKids, setActiveKids] = React.useState(allKidIds);
  const [tooltip, setTooltip] = React.useState(null); // { kidId, ev, x, y } | null

  const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
  const WEEK = [3, 4, 5, 6, 7, 8, 9];
  const TODAY_IDX = 2; // Tue May 5
  const NOW_HHMM = '09:42';
  const nowY = _yPxMG(NOW_HHMM);

  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) {
      const target = Math.max(0, nowY - 110);
      scrollRef.current.scrollTop = target;
    }
  }, []);

  const HOURS = [];
  for (let h = MG_HOUR_START; h <= MG_HOUR_END; h++) HOURS.push(h);

  // Build per-day-per-kid event lists
  function eventsForKidDay(kidId, dayIdx) {
    return (window.WEEKLY_EVENTS && window.WEEKLY_EVENTS[kidId] || []).
    filter((e) => e.day === dayIdx);
  }

  function toggleKid(kidId) {
    setActiveKids((s) => s.includes(kidId) ?
    s.length === 1 ? s : s.filter((x) => x !== kidId) :
    [...allKidIds.filter((id) => s.includes(id) || id === kidId)]);
  }

  const todoCount = (typeof TODOS !== 'undefined' ? TODOS.filter((t) => !t.done).length : 0) + (
  typeof TASKS !== 'undefined' ? TASKS.filter((t) => !t.done).length : 0);

  const visibleKids = KIDS.filter((k) => activeKids.includes(k.id));

  return (
    <div style={{
      width: '100%', height: '100%', background: A.cream,
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54, position: 'relative'
    }}
    onClick={() => setTooltip(null)}>

      {/* ── Top bar — matches Daily View B; back button + WEEK toggle active ─ */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 14px 4px', gap: 10
      }}>
        <button onClick={onModeSwitch} style={{
          ...topBtnB(A), width: 28, height: 28, marginLeft: -4
        }}>
          <Icon.chevL size={20} />
        </button>
        <button style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          padding: '4px 4px', display: 'flex', alignItems: 'baseline', gap: 8,
          whiteSpace: 'nowrap', flex: 1, minWidth: 0,
          fontFamily: 'inherit', color: A.ink, margin: "0px 0px 0px -1px"
        }}>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, fontFamily: '"Pretendard", sans-serif' }}>이번 주</span>
          <span style={{
            fontSize: 13, fontWeight: 400, color: A.inkSub, letterSpacing: -0.2,
            display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: '"Pretendard", sans-serif'
          }}>
            5월 3일 – 9일
            <Icon.chevD size={16} stroke={A.inkSub} />
          </span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
          <ViewToggleB A={A} active="week" />
          <button style={topBtnB(A)}><Icon.search size={20} /></button>
        </div>
      </div>

      {/* ── Tabs (same as Daily View B) ───────────────────────── */}
      <div style={{
        padding: '0 14px',
        display: 'flex',
        borderBottom: `1px solid ${A.hair}`
      }}>
        {[
        ['schedule', '일정', null],
        ['todo', '준비물 & 할일', todoCount || 8]].
        map(([k, label, n]) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab && setTab(k)} style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '12px 16px 14px', position: 'relative',
              fontSize: 14, fontWeight: active ? 600 : 400,
              color: active ? A.ink : A.inkSub,
              display: 'flex', alignItems: 'center', gap: 6,
              letterSpacing: -0.3, fontFamily: 'Pretendard'
            }}>
              {label}
              {n != null &&
              <span style={{
                fontWeight: 400,
                background: active ? A.primary : A.ink04,
                color: active ? '#fff' : A.inkSub,
                borderRadius: 99, minWidth: 18,
                fontFamily: '"Pretendard", sans-serif', fontSize: "10px", width: "1px", padding: "2px"
              }}>{n}</span>
              }
              {active && <div style={{
                position: 'absolute', left: 0, right: 0, bottom: -1, height: 3,
                background: A.primary, borderRadius: 2
              }} />}
            </button>);

        })}
      </div>

      {/* ── Kid filter chips ───────────────────────────────────── */}
      <div style={{
        padding: '10px 14px 8px', display: 'flex', gap: 6,
        overflowX: 'auto', flexShrink: 0
      }}>
        {KIDS.map((k) => {
          const active = activeKids.includes(k.id);
          return (
            <button key={k.id} onClick={() => toggleKid(k.id)} style={{
              border: 'none',
              background: active ? A.ink04 : 'transparent',
              cursor: 'pointer', padding: '4px 13px 4px 4px', borderRadius: 99,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: active ? 1 : 0.45, flex: '0 0 auto',
              fontFamily: 'inherit',
              boxShadow: active ? 'none' : `inset 0 0 0 1px ${A.hair}`,
              transition: 'all .12s'
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 99,
                display: 'grid', placeItems: 'center', overflow: 'hidden', flex: '0 0 auto'
              }}>
                <AvatarPH kid={k} size={28} />
              </div>
              <span style={{
                fontSize: 13, fontWeight: 600, color: A.ink, letterSpacing: -0.2
              }}>{k.name}</span>
            </button>);

        })}
      </div>

      {/* ── Week strip ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: `${MG_GUTTER}px repeat(7, 1fr)`,
        borderBottom: `1px solid ${A.hair}`, paddingBottom: 8, paddingTop: 4,
        flexShrink: 0
      }}>
        <div />
        {DAYS_KR.map((d, i) => {
          const today = i === TODAY_IDX;
          const dowColor = i === 0 ? '#D04580' : i === 6 ? '#3F66D8' : A.inkSub;
          return (
            <div key={d} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
            }}>
              <div style={{
                fontSize: 10, fontWeight: 500, color: dowColor
              }}>{d}</div>
              <div style={{
                width: 26, height: 26, borderRadius: 99,
                display: 'grid', placeItems: 'center',
                background: today ? A.primary : 'transparent',
                color: today ? '#fff' : A.ink,
                fontWeight: today ? 600 : 500, fontSize: 14, letterSpacing: -0.2
              }}>{WEEK[i]}</div>
            </div>);

        })}
      </div>

      {/* ── Scrollable grid ────────────────────────────────────── */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        position: 'relative', WebkitOverflowScrolling: 'touch',
        paddingBottom: 96
      }}>
        <div style={{
          position: 'relative',
          height: (MG_HOUR_END - MG_HOUR_START + 1) * MG_HOUR_PX,
          display: 'grid', gridTemplateColumns: `${MG_GUTTER}px repeat(7, 1fr)`
        }}>
          {/* Time gutter — matches daily/weekly: number + AM/PM stacked */}
          <div style={{ position: 'relative' }}>
            {HOURS.map((h) => {
              const top = (h - MG_HOUR_START) * MG_HOUR_PX;
              const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
              const ap = h < 12 ? 'AM' : 'PM';
              const tooClose = Math.abs(top - nowY) < 14;
              if (tooClose) return null;
              return (
                <div key={h} style={{
                  position: 'absolute', top: top - 8, right: 6,
                  textAlign: 'right', lineHeight: 1
                }}>
                  <div style={{ fontSize: 11.5, fontWeight: 400, color: A.inkSub }}>{h12}</div>
                  <div style={{ fontSize: 7.5, color: A.ink30, fontWeight: 400, marginTop: 0 }}>{ap}</div>
                </div>);

            })}
          </div>

          {/* 7 day columns — each contains visibleKids.length lanes */}
          {DAYS_KR.map((_, dayIdx) => {
            const isToday = dayIdx === TODAY_IDX;
            return (
              <div key={dayIdx} style={{
                position: 'relative',
                borderLeft: `1px solid ${A.hair}`,
                background: isToday ? `${A.primary}06` : 'transparent'
              }}>
                {/* Hour grid lines */}
                {HOURS.map((h) => {
                  const top = (h - MG_HOUR_START) * MG_HOUR_PX;
                  return (
                    <div key={h} style={{
                      position: 'absolute', top, left: 0, right: 0, height: 1,
                      background: A.hair, opacity: 0.55
                    }} />);

                })}

                {/* Kid lanes */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', padding: '0 2px',
                  gap: 2
                }}>
                  {visibleKids.map((kid) => {
                    const pal = KID_PALETTE[kid.palette];
                    const evs = eventsForKidDay(kid.id, dayIdx);
                    return (
                      <div key={kid.id} style={{
                        flex: 1, position: 'relative', minWidth: 0
                      }}>
                        {evs.map((ev, i) => {
                          const top = _yPxMG(ev.start);
                          const h = _yPxMG(ev.end) - _yPxMG(ev.start);
                          const IconComp = Icon[ev.kind] || Icon.etc;
                          const isOpen = tooltip && tooltip.kidId === kid.id && tooltip.evIdx === i && tooltip.dayIdx === dayIdx;
                          return (
                            <button key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTooltip(isOpen ? null : { kidId: kid.id, evIdx: i, dayIdx, ev, kid });
                            }}
                            style={{
                              position: 'absolute', left: 0, right: 0, top: top + 1,
                              height: h - 2, background: pal.block,
                              borderRadius: 6,
                              boxShadow: isOpen ?
                              `inset 0 0 0 1.5px ${pal.dot}, 0 4px 12px rgba(0,0,0,0.12)` :
                              `inset 0 0 0 1px ${pal.dot}`,
                              border: 'none', cursor: 'pointer', padding: 0,
                              transition: 'box-shadow .12s',
                              zIndex: isOpen ? 6 : 1
                            }}>
                              {/* Type icon chip — pinned to the top of the bar */}
                              <div style={{
                                position: 'absolute', top: -9, left: '50%',
                                transform: 'translateX(-50%)',
                                width: 20, height: 20, borderRadius: 99,
                                background: pal.dot,
                                color: '#fff',
                                display: 'grid', placeItems: 'center',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.18)'
                              }}>
                                <IconComp size={15} fill="#fff" stroke="#fff" />
                              </div>
                            </button>);

                        })}
                      </div>);

                  })}
                </div>
              </div>);

          })}

          {/* Now line + badge */}
          <div style={{
            position: 'absolute', top: nowY - 9,
            left: 0, right: 0, height: 18,
            display: 'flex', alignItems: 'center',
            pointerEvents: 'none', zIndex: 5
          }}>
            <div style={{
              width: MG_GUTTER, display: 'flex', justifyContent: 'flex-end',
              paddingRight: 0
            }}>
              <div style={{
                background: '#E0E345', color: '#1d1d1b',
                fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                fontFamily: '"Pretendard", sans-serif',
                boxShadow: '0 2px 6px rgba(224,227,69,0.55)',
                letterSpacing: -0.1
              }}>{(() => {
                  const [h, m] = NOW_HHMM.split(':').map(Number);
                  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                  return `${h12}:${String(m).padStart(2, '0')}`;
                })()}</div>
            </div>
            <div style={{
              flex: 1, height: 1.5, background: '#E0E345', borderRadius: 1,
              marginLeft: -1
            }} />
          </div>

          {/* Tooltip popover */}
          {tooltip && (() => {
            const pal = KID_PALETTE[tooltip.kid.palette];
            const ev = tooltip.ev;
            const IconComp = Icon[ev.kind] || Icon.etc;
            // Position: above the event if room, else below
            const evTop = _yPxMG(ev.start);
            const placeAbove = evTop > 90;
            return (
              <div onClick={(e) => e.stopPropagation()} style={{
                position: 'absolute',
                top: placeAbove ? evTop - 54 : evTop + (_yPxMG(ev.end) - _yPxMG(ev.start)) + 8,
                left: `calc(${MG_GUTTER}px + ${tooltip.dayIdx / 7 * 100}% * (1 - ${MG_GUTTER}/402) + ${0.5 / 7 * (402 - MG_GUTTER)}px)`,
                transform: 'translateX(-50%)',
                background: '#fff', borderRadius: 9,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
                padding: '6px 8px', zIndex: 8,
                minWidth: 116, maxWidth: 160,
                pointerEvents: 'auto'
              }}>
                {/* Kid row: avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <AvatarPH kid={tooltip.kid} size={18} />
                  <span style={{
                    fontSize: 12, color: A.ink, fontWeight: 600,
                    letterSpacing: -0.3
                  }}>{tooltip.kid.name}</span>
                </div>
                {/* Title row: kind icon + title */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600, color: A.ink,
                  letterSpacing: -0.3, marginBottom: 1
                }}>
                  <IconComp size={12} fill={A.ink} stroke={A.ink} />
                  <span>{ev.title}</span>
                </div>
                <div style={{
                  fontSize: 10, color: A.inkSub, fontWeight: 400,
                  fontFamily: '"Pretendard", sans-serif', letterSpacing: -0.1
                }}>{fmt12hrShort(ev.start)}–{fmt12hrShort(ev.end)}</div>
                {ev.place &&
                <div style={{
                  fontSize: 10, color: A.inkSub, fontWeight: 400,
                  marginTop: 1, letterSpacing: -0.2
                }}>{ev.place}</div>
                }
              </div>);

          })()}
        </div>
      </div>

      {/* ── Bottom dock ─────────────────────────────────────── */}
      <BottomDockB onAdd={() => {}} />
    </div>);

}

Object.assign(window, { MultiKidGridB });