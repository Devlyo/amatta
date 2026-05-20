// app-weekly-drawers.jsx — Bottom sheets for the weekly view.
// KidDrawer (자녀 선택), CalendarDrawer (월 달력 + 점 표시), SearchDrawer.

// ─── Generic bottom sheet ──────────────────────────────────────────────────
function BottomSheet({ open, onClose, height = 'auto', title, children }) {
  const A = AMATTA;
  return (
    <React.Fragment>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(20,18,16,0.34)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .22s ease',
          zIndex: 50,
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .26s cubic-bezier(.22,.8,.36,1)',
        zIndex: 51, maxHeight: '78%',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Grabber */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 38, height: 4, borderRadius: 99, background: A.ink12 }}/>
        </div>
        {title && (
          <div style={{
            padding: '10px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3, color: A.ink }}>{title}</div>
            <button onClick={onClose} style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: A.inkSub, padding: 4, display: 'grid', placeItems: 'center',
            }}>
              <Icon.xMark size={18}/>
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </React.Fragment>
  );
}

// ─── KidDrawer (자녀 선택) ─────────────────────────────────────────────────
function KidDrawer({ open, onClose, currentKidId, onPick }) {
  const A = AMATTA;
  return (
    <BottomSheet open={open} onClose={onClose} title="자녀 선택">
      <div style={{ padding: '6px 12px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {KIDS.map(k => {
          const pal = KID_PALETTE[k.palette];
          const isActive = k.id === currentKidId;
          return (
            <button key={k.id} onClick={() => { onPick(k.id); onClose(); }} style={{
              border: 'none', cursor: 'pointer', textAlign: 'left',
              background: isActive ? A.ink04 : 'transparent',
              borderRadius: 14, padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
              transition: 'background .12s',
            }}>
              <AvatarPH kid={k} size={28}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.3, color: A.ink, fontFamily: '"Pretendard", sans-serif' }}>
                  {k.name}
                </div>
              </div>
              {isActive && <div style={{
                width: 22, height: 22, borderRadius: 99,
                background: A.ink, display: 'grid', placeItems: 'center',
              }}>
                <Icon.check size={12} stroke="#fff"/>
              </div>}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

// ─── CalendarDrawer (월 달력 + 자녀 색상 점) ──────────────────────────────
// Show May 2026 — TODAY is May 5 (Tue). day-of-week 0=Sun..6=Sat.
// Dots: for each date, for each kid, check WEEKLY_EVENTS by that kid for that DOW.
function CalendarDrawer({ open, onClose, selectedDate, onPickDate }) {
  const A = AMATTA;
  const [year, setYear] = React.useState(2026);
  const [month, setMonth] = React.useState(5); // May
  const TODAY = { y: 2026, m: 5, d: 5 };

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function dotsFor(date) {
    const dow = new Date(year, month - 1, date).getDay();
    const out = [];
    for (const k of KIDS) {
      const events = (window.WEEKLY_EVENTS && window.WEEKLY_EVENTS[k.id]) || [];
      const hasEvent = events.some(e => e.day === dow && !e.cancelled);
      if (hasEvent) out.push(KID_PALETTE[k.palette].dot);
    }
    return out;
  }

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 16px 20px' }}>
        {/* Month nav */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 4px 12px',
        }}>
          <button onClick={prevMonth} style={navIconBtn(A)}><Icon.chevL size={18}/></button>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3, color: A.ink }}>
            {year}년 {month}월
          </div>
          <button onClick={nextMonth} style={navIconBtn(A)}><Icon.chevR size={18}/></button>
        </div>

        {/* DOW header — weekend colored, weekday inkSub */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {['일','월','화','수','목','금','토'].map((d, i) => (
            <div key={d} style={{
              textAlign: 'center', fontSize: 10.5, fontWeight: 500, padding: '4px 0',
              color: i === 0 ? '#D04580' : (i === 6 ? '#3F66D8' : A.inkSub),
            }}>{d}</div>
          ))}
        </div>

        {/* Grid — all date numbers use ink color regardless of DOW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }}>
          {cells.map((d, i) => {
            if (d == null) return <div key={i} style={{ height: 48 }}/>;
            const isToday = year === TODAY.y && month === TODAY.m && d === TODAY.d;
            const isSelected = selectedDate && selectedDate.y === year && selectedDate.m === month && selectedDate.d === d;
            const dots = dotsFor(d);
            return (
              <button key={i} onClick={() => { onPickDate({ y: year, m: month, d }); onClose(); }}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  height: 48, padding: '4px 0',
                }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 99,
                  display: 'grid', placeItems: 'center',
                  background: isToday ? A.primary : (isSelected ? A.ink06 : 'transparent'),
                  color: isToday ? '#fff' : A.ink,
                  fontWeight: (isToday || isSelected) ? 600 : 400, fontSize: 14,
                  border: isSelected && !isToday ? `1.5px solid ${A.primary}` : 'none',
                }}>{d}</div>
                <div style={{ display: 'flex', gap: 2, height: 6, alignItems: 'center' }}>
                  {dots.slice(0, 3).map((c, j) => (
                    <span key={j} style={{
                      width: 5, height: 5, borderRadius: 99, background: c,
                    }}/>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}

// ─── SearchDrawer ──────────────────────────────────────────────────────────
function SearchDrawer({ open, onClose, onPickResult }) {
  const A = AMATTA;
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
    else setQ('');
  }, [open]);

  // Flatten all events from all kids into searchable items
  const items = React.useMemo(() => {
    const out = [];
    for (const k of KIDS) {
      const evs = (window.WEEKLY_EVENTS && window.WEEKLY_EVENTS[k.id]) || [];
      evs.forEach((e, i) => out.push({
        kid: k, ev: e,
        key: `${k.id}-${i}`,
        text: `${e.title} ${e.place || ''} ${k.name}`,
      }));
    }
    return out;
  }, []);

  const filtered = q.trim()
    ? items.filter(it => it.text.toLowerCase().includes(q.trim().toLowerCase()))
    : [];

  const recent = ['수영', '영어', '태권도', '미술'];

  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* Search input */}
      <div style={{ padding: '6px 16px 10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: A.ink04, borderRadius: 12, padding: '8px 12px',
        }}>
          <Icon.search size={16} fill={A.inkSub}/>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="일정·장소·자녀 검색"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 14, fontFamily: 'inherit', color: A.ink, letterSpacing: -0.2,
            }}
          />
          {q && (
            <button onClick={() => setQ('')} style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: 0, color: A.inkSub,
            }}>
              <Icon.xMark size={14}/>
            </button>
          )}
        </div>
      </div>

      {/* Recent or results */}
      <div style={{ padding: '0 16px 24px' }}>
        {q.trim() === '' ? (
          <React.Fragment>
            <div style={{ fontSize: 11, fontWeight: 500, color: A.inkSub, padding: '8px 4px' }}>최근 검색</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recent.map(r => (
                <button key={r} onClick={() => setQ(r)} style={{
                  border: `1px solid ${A.hair}`, background: '#fff',
                  borderRadius: 99, padding: '6px 12px',
                  fontSize: 12, fontWeight: 500, color: A.ink,
                  cursor: 'pointer', letterSpacing: -0.2,
                }}>{r}</button>
              ))}
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={{ fontSize: 11, fontWeight: 500, color: A.inkSub, padding: '8px 4px' }}>
              결과 {filtered.length}건
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.length === 0 && (
                <div style={{ fontSize: 13, color: A.inkSub, padding: '20px 4px', textAlign: 'center' }}>
                  검색 결과가 없습니다
                </div>
              )}
              {filtered.map(it => {
                const pal = KID_PALETTE[it.kid.palette];
                const DAYS_KR = ['일','월','화','수','목','금','토'];
                return (
                  <button key={it.key}
                    onClick={() => { onPickResult && onPickResult(it); onClose(); }}
                    style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      textAlign: 'left', padding: '10px 8px', borderRadius: 10,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                    <div style={{
                      width: 4, alignSelf: 'stretch', borderRadius: 99,
                      background: pal.dot,
                    }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, letterSpacing: -0.2, color: A.ink,
                      }}>{it.ev.title}</div>
                      <div style={{
                        fontSize: 11, color: A.inkSub, fontWeight: 400, marginTop: 2,
                        fontFamily: '"Pretendard", sans-serif',
                      }}>
                        {it.kid.name} · {DAYS_KR[it.ev.day]} {it.ev.start}–{it.ev.end} · {it.ev.place}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        )}
      </div>
    </BottomSheet>
  );
}

function navIconBtn(A) {
  return {
    border: 'none', background: 'transparent', cursor: 'pointer',
    padding: 6, display: 'grid', placeItems: 'center',
    color: A.inkSub,
  };
}

Object.assign(window, { BottomSheet, KidDrawer, CalendarDrawer, SearchDrawer });
