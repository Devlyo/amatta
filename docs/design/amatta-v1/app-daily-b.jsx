// app-daily-b.jsx — Variation B (v3 polish)
// Changes: pickup pill compact, count chip only on 준비물&할일, 16px horizontal
// tab padding, kid header shorter (with 세 suffix), tighter time gutter,
// bigger floating bottom dock with no FAB border, KIND_EMOJI in event blocks.

function DailyB({ tab, setTab, primary: primaryProp }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;
  // Drawer state shared by top-bar triggers
  const [drawer, setDrawer] = React.useState(null); // 'calendar' | 'search' | 'new-event' | 'event-detail' | null
  const [selectedDate, setSelectedDate] = React.useState({ y: 2026, m: 5, d: 5 });
  const [newEventKidId, setNewEventKidId] = React.useState('minjun');
  const [selectedEvent, setSelectedEvent] = React.useState(null); // {event, kid}
  const openEvent = (event, kid) => {setSelectedEvent({ event, kid });setDrawer('event-detail');};
  // Pickup pill text color — auto from primary luminance
  const _h = primary.replace('#', '');
  const _r = parseInt(_h.slice(0, 2), 16);
  const _g = parseInt(_h.slice(2, 4), 16);
  const _b = parseInt(_h.slice(4, 6), 16);
  const _lum = (0.299 * _r + 0.587 * _g + 0.114 * _b) / 255;
  const onPrimary = _lum > 0.65 ? '#1d1d1b' : '#fff';
  const onPrimarySub = onPrimary === '#fff' ? 'rgba(255,255,255,0.85)' : 'rgba(29,29,27,0.6)';
  const todoCount = TODOS.filter((t) => !t.done).length + TASKS.filter((t) => !t.done).length;

  return (
    <div style={{
      width: '100%', height: '100%', background: A.cream,
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54
    }}>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 14px 4px', gap: 10
      }}>
        <button
          onClick={() => setDrawer('calendar')}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '4px 4px', display: 'flex', alignItems: 'baseline', gap: 8,
            whiteSpace: 'nowrap', flex: 1, minWidth: 0,
            fontFamily: 'inherit', color: A.ink
          }}>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, fontFamily: 'Pretendard' }}>오늘</span>
          <span style={{
            fontSize: 13, fontWeight: 400, color: A.inkSub, letterSpacing: -0.2,
            display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: '"Pretendard", sans-serif'
          }}>
            5월 5일 · 화
            <Icon.chevD size={16} stroke={A.inkSub} />
          </span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
          <ViewToggleB A={A} />
          <button onClick={() => setDrawer('search')} style={topBtnB(A)}><Icon.search size={20} /></button>
        </div>
      </div>

      {/* ── Pickup banner carousel ──────────────────────────────── */}
      <PickupCarousel primary={primary} />

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div style={{
        padding: '0 14px',
        display: 'flex',
        borderBottom: `1px solid ${A.hair}`
      }}>
        {[
        ['schedule', '일정', null],
        ['todo', '준비물 & 할일', todoCount]].
        map(([k, label, n]) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '12px 16px 14px', position: 'relative',
              fontSize: 14, fontWeight: active ? 600 : 400,
              color: active ? A.ink : A.inkSub,
              display: 'flex', alignItems: 'center', gap: 6,
              letterSpacing: -0.3, fontFamily: "Pretendard"

            }}>
              {label}
              {n != null &&
              <span style={{
                fontWeight: 400,
                background: active ? primary : A.ink04,
                color: active ? '#fff' : A.inkSub,
                borderRadius: 99, minWidth: 18,
                fontFamily: '"Pretendard", sans-serif', fontSize: "10px", width: "1px", padding: "2px"
              }}>{n}</span>
              }
              {active && <div style={{
                position: 'absolute', left: 0, right: 0, bottom: -1, height: 3,
                background: primary, borderRadius: 2
              }} />}
            </button>);

        })}
      </div>

      {tab === 'schedule' ? <ScheduleB primary={primary} onEventClick={openEvent} /> : <TodoB primary={primary} />}
      <BottomDockB primary={primary} onAdd={() => setDrawer('new-event')} />

      {/* Drawers — calendar + search use the same components as Weekly View */}
      {typeof CalendarDrawer !== 'undefined' &&
      <CalendarDrawer
        open={drawer === 'calendar'}
        onClose={() => setDrawer(null)}
        selectedDate={selectedDate}
        onPickDate={setSelectedDate} />
      }
      {typeof SearchDrawer !== 'undefined' &&
      <SearchDrawer
        open={drawer === 'search'}
        onClose={() => setDrawer(null)} />
      }
      {typeof NewEventDrawer !== 'undefined' &&
      <NewEventDrawer
        open={drawer === 'new-event'}
        onClose={() => setDrawer(null)}
        initialKidId={newEventKidId}
        onSave={(data) => {console.log('saved', data);}} />
      }
      {typeof EventDetailDrawer !== 'undefined' &&
      <EventDetailDrawer
        open={drawer === 'event-detail'}
        onClose={() => setDrawer(null)}
        event={selectedEvent?.event}
        kid={selectedEvent?.kid}
        onEdit={() => setDrawer('new-event')}
        onCancelOnce={() => setDrawer(null)}
        onDelete={() => setDrawer(null)} />
      }

      <style>{`
        @keyframes amattaPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.4); opacity: 0.55; }
        }
      `}</style>
    </div>);

}

// Original cartoon car illustration — round body, two big wheels, friendly
// silhouette. Drawn from scratch to match the playful retro feel without
// copying any third-party clip art.
function CartoonCar({ body = '#fff', window: win = '#FFE2D0', wheel = '#1d1d1b', hub = '#fff', shine = 'rgba(255,255,255,0.7)', width = 108, height = 64, shape = 'sedan' }) {
  const isRound = shape === 'round';
  return (
    <svg
      width={width} height={height} viewBox="0 0 130 78"
      style={{ flex: '0 0 auto', position: 'relative', zIndex: 1, marginRight: -6, marginBottom: -6 }}
      aria-hidden="true">
      {isRound ?
      <React.Fragment>
          {/* car body: toy-car silhouette — front hood protrudes, cabin dome sits on top, smooth rear curve */}
          <path
          d="M14 50
               Q14 42 20 40
               Q24 38 28 40
               Q34 40 36 36
               C38 24 48 18 60 18
               L82 18
               C102 18 116 30 116 54
               L116 56 Q116 60 112 60
               L102 60 Q102 68 95 68 Q88 68 88 60
               L44 60 Q44 68 37 68 Q30 68 30 60
               L18 60 Q14 60 14 56
               L14 50 Z"











          fill={body} />
          {/* front windshield — sloped trapezoid sitting on the hood */}
          <path
          d="M40 38
               C40 28 44 22 54 22
               L66 22
               L66 38 Z"



          fill={win} />
          {/* rear window — smaller dome */}
          <path
          d="M70 22
               L82 22
               C94 22 96 30 96 38
               L70 38 Z"



          fill={win} />
          {/* door handle */}
          <path d="M52 48 L62 48" stroke={wheel} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
          {/* tiny headlight on the hood front */}
          <circle cx="18" cy="46" r="2.2" fill={shine} />
        </React.Fragment> :

      <React.Fragment>
          {/* car body: low slung sedan w/ rounded roof */}
          <path
          d="M14 54
               Q14 40 28 38
               L42 24
               Q47 19 55 19
               L82 19
               Q90 19 95 26
               L104 38
               Q118 40 118 54
               L118 56
               Q118 60 114 60
               L102 60
               Q102 68 95 68
               Q88 68 88 60
               L44 60
               Q44 68 37 68
               Q30 68 30 60
               L18 60
               Q14 60 14 56 Z"

















          fill={body} />
          {/* front window */}
          <path
          d="M50 28
               Q53 24 58 24
               L66 24
               L66 38
               L46 38
               Z"





          fill={win} />
          {/* rear window */}
          <path
          d="M70 24
               L82 24
               Q86 24 88 27
               L94 38
               L70 38
               Z"





          fill={win} />
          {/* door split */}
          <path d="M68 24 L68 38" stroke={wheel} strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          {/* tiny headlight */}
          <circle cx="113" cy="48" r="2.2" fill={shine} />
        </React.Fragment>
      }
      {/* wheels — shared */}
      <circle cx="37" cy="62" r="11" fill={wheel} />
      <circle cx="95" cy="62" r="11" fill={wheel} />
      <circle cx="37" cy="62" r="4.4" fill={hub} />
      <circle cx="95" cy="62" r="4.4" fill={hub} />
    </svg>);

}

function topBtnB(A) {
  return {
    width: 32, height: 32, borderRadius: 99, border: 'none',
    background: 'transparent', color: A.ink, cursor: 'pointer',
    display: 'grid', placeItems: 'center'
  };
}

// ── Pickup carousel ────────────────────────────────────────────────────────
// Horizontally swipable cards, one per pickup that's coming up. White dots
// at the bottom show position when there's more than one. Drag to switch —
// no arrows, no buttons; tap-and-drag horizontally.
const PICKUPS = [
{ time: '15:30', who: '지호', what: '태권도', eta: '1h 10m',
  bg: '#FF7144', titleColor: '#FFFFFF',
  car: { body: '#FFF4E5', win: '#FFD8C2', wheel: '#1d1d1b', hub: '#FFF4E5', shine: 'rgba(255,255,255,0.9)' } },
{ time: '15:30', who: '민준', what: '수영', eta: '1h 10m',
  bg: '#D4B4FA', titleColor: '#1d1d1b', titleSize: 14, eyebrowColor: '#1d1d1b',
  car: { body: '#FFFFFF', win: '#E8F2C9', wheel: '#1d1d1b', hub: '#FFFFFF', shine: 'rgba(255,255,255,0.95)', shape: 'round' } }];


function PickupCarousel({ primary }) {
  const A = AMATTA;
  const [idx, setIdx] = React.useState(0);
  const [dragDx, setDragDx] = React.useState(0);
  const dragRef = React.useRef({ active: false, startX: 0, pointerId: null });
  const viewportRef = React.useRef(null);
  // First card uses the live `primary` so theme tweaks still take effect;
  // additional cards keep their own bg.
  const cards = PICKUPS.map((p, i) => i === 0 ? { ...p, bg: primary } : p);

  const onDown = (e) => {
    dragRef.current.active = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.pointerId = e.pointerId;
    try {e.currentTarget.setPointerCapture(e.pointerId);} catch (err) {}
  };
  const onMove = (e) => {
    if (!dragRef.current.active) return;
    setDragDx(e.clientX - dragRef.current.startX);
  };
  const release = (e) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try {e.currentTarget.releasePointerCapture(dragRef.current.pointerId);} catch (err) {}
    const w = viewportRef.current?.clientWidth || 320;
    const threshold = Math.max(40, w * 0.15);
    let next = idx;
    if (dragDx < -threshold && idx < cards.length - 1) next = idx + 1;else
    if (dragDx > threshold && idx > 0) next = idx - 1;
    setIdx(next);
    setDragDx(0);
  };

  return (
    <div style={{ padding: '6px 14px 8px' }}>
      <div
        ref={viewportRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={release}
        onPointerCancel={release}
        style={{
          overflow: 'hidden', borderRadius: 18,
          touchAction: 'pan-y', userSelect: 'none', cursor: dragRef.current.active ? 'grabbing' : 'grab'
        }}>
        <div style={{
          display: 'flex',
          transform: `translateX(calc(${-idx * 100}% + ${dragDx}px))`,
          transition: dragRef.current.active ? 'none' : 'transform .28s cubic-bezier(.2,.8,.2,1)'
        }}>
          {cards.map((p, i) =>
          <div key={i} style={{ flex: '0 0 100%', minWidth: 0 }}>
              <PickupCard data={p} showDots={cards.length > 1} total={cards.length} activeIdx={idx} />
            </div>
          )}
        </div>
      </div>
    </div>);

}

function PickupCard({ data, showDots, total, activeIdx }) {
  // luminance → text color
  const _h = data.bg.replace('#', '');
  const _r = parseInt(_h.slice(0, 2), 16);
  const _g = parseInt(_h.slice(2, 4), 16);
  const _b = parseInt(_h.slice(4, 6), 16);
  const _lum = (0.299 * _r + 0.587 * _g + 0.114 * _b) / 255;
  const onBg = _lum > 0.65 ? '#1d1d1b' : '#fff';
  const onBgSub = onBg === '#fff' ? 'rgba(255,255,255,0.85)' : 'rgba(29,29,27,0.6)';
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: data.bg,
      borderRadius: 14, padding: '6px 14px 10px',
      color: onBg, display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: `0 6px 16px ${data.bg}40`, minHeight: 44, fontSize: "14px"
    }}>
      {/* Faint road line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 6, height: 2,
        background: onBg === '#fff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)'
      }} />

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: 0.8,
          textTransform: 'uppercase', color: data.eyebrowColor || onBgSub,
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: '"Geist", "Pretendard", sans-serif'
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 99, background: onBg,
            animation: 'amattaPulse 1.6s ease-in-out infinite'
          }} />
          NEXT PICKUP · {data.eta}
        </div>
        <div style={{
          marginTop: 2, letterSpacing: -0.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: '"Pretendard", sans-serif', lineHeight: 1.15, color: data.titleColor || onBg, fontSize: data.titleSize || 15, fontWeight: "600"
        }}>
          <span style={{ marginRight: 8, fontSize: "14px" }}>{data.time}</span>
          {data.who} · {data.what}
        </div>
      </div>

      {/* Illustrated car */}
      <CartoonCar
        body={data.car.body}
        window={data.car.win}
        wheel={data.car.wheel}
        hub={data.car.hub}
        shine={data.car.shine}
        shape={data.car.shape}
        width={68}
        height={40} />


      {/* Carousel dots — overlay at bottom-center, white */}
      {showDots &&
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 4,
        display: 'flex', justifyContent: 'center', gap: 3,
        pointerEvents: 'none', zIndex: 2
      }}>
          {Array.from({ length: total }).map((_, i) =>
        <div key={i} style={{
          width: i === activeIdx ? 10 : 3, height: 3, borderRadius: 99,
          background: '#fff',
          opacity: i === activeIdx ? 1 : 0.5,
          transition: 'all .25s cubic-bezier(.2,.8,.2,1)'
        }} />
        )}
        </div>
      }
    </div>);

}

// WEEK / DAY segmented toggle. Accepts active='day' (default) or 'week'.
function ViewToggleB({ A, active = 'day' }) {
  const base = {
    fontFamily: '"Geist", "Pretendard", sans-serif',
    fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
    padding: '5px 9px', borderRadius: 99, border: 'none',
    cursor: 'pointer', textDecoration: 'none', lineHeight: 1
  };
  const activeStyle = {
    background: '#fff', color: A.ink,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06), inset 0 0 0 1px ' + A.hair
  };
  const inactiveStyle = { background: 'transparent', color: A.inkSub };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: A.ink04, borderRadius: 99, padding: 2, gap: 2
    }}>
      {active === 'week' ?
      <span style={{ ...base, ...activeStyle }}>WEEK</span> :
      <a href="Multi-Kid Grid.html" style={{ ...base, ...inactiveStyle }}>WEEK</a>}
      {active === 'day' ?
      <span style={{ ...base, ...activeStyle }}>DAY</span> :
      <a href="Daily View B.html" style={{ ...base, ...inactiveStyle }}>DAY</a>}
    </div>);

}

function ScheduleB({ primary: primaryProp, onEventClick }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;
  const slotH = 32;
  const totalSlots = (TIME_END - TIME_START) / SLOT_MIN;
  const gridH = slotH * totalSlots;
  const nowTop = (toMin(NOW_HHMM) - TIME_START) / SLOT_MIN * slotH;
  const GUTTER = 40;

  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, nowTop - 110);
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Kid header — avatar + name (grade·age omitted; parent already knows) */}
      <div style={{
        display: 'grid', gridTemplateColumns: `${GUTTER}px repeat(${KIDS.length}, minmax(0, 1fr))`,
        gap: 4, padding: '10px 12px 8px'
      }}>
        <div />
        {KIDS.map((k) => {
          return (
            <a key={k.id} href={`Weekly View.html?kid=${k.id}`} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 6px', background: A.ink04,
              textDecoration: 'none', color: 'inherit', minWidth: 0,
              cursor: 'pointer', transition: 'background .12s', borderRadius: "99px"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = A.ink06}
            onMouseLeave={(e) => e.currentTarget.style.background = A.ink04}>
              <AvatarPH kid={k} size={30} />
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 1,
                color: A.ink,
                letterSpacing: -0.3, whiteSpace: 'nowrap', lineHeight: 1, minWidth: 0,
                fontSize: "13px", fontWeight: "500", fontFamily: "Pretendard"
              }}>
                {k.name}
                <Icon.chevD size={12} stroke={A.inkSub} />
              </div>
            </a>);

        })}
      </div>

      {/* Scroll grid */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: `${GUTTER}px repeat(${KIDS.length}, 1fr)`,
          padding: '0 12px', height: gridH, position: 'relative'
        }}>
          {/* gutter */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: 18 }).map((_, i) => {
              const hour = 6 + i;
              const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
              const ap = hour < 12 ? 'AM' : 'PM';
              return (
                <div key={hour} style={{
                  position: 'absolute', top: i * slotH * 2 - 6, right: 5,
                  textAlign: 'right'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 400, color: A.inkSub, fontFamily: '"Pretendard", sans-serif' }}>{h12}</div>
                  <div style={{ fontSize: 8, color: A.ink30, fontWeight: 400, marginTop: 0, fontFamily: '"Geist", "Pretendard", sans-serif', letterSpacing: 0.4 }}>{ap}</div>
                </div>);

            })}
          </div>

          {KIDS.map((k) => {
            const pal = KID_PALETTE[k.palette];
            const events = SCHEDULE[k.id] || [];
            return (
              <div key={k.id} style={{
                position: 'relative', background: 'transparent',
                borderLeft: `1px solid ${A.hair}`
              }}>
                {Array.from({ length: 18 }).map((_, i) =>
                <div key={i} style={{
                  position: 'absolute', left: 0, right: 0,
                  top: i * slotH * 2, height: 1,
                  background: A.hair, opacity: 0.7
                }} />
                )}
                {events.map((ev) => {
                  const top = slotIndex(ev.start) * slotH;
                  const h = slotSpan(ev.start, ev.end) * slotH;
                  return (
                    <div key={ev.id}
                    onClick={() => onEventClick && onEventClick(ev, k)}
                    style={{
                      position: 'absolute', left: 3, right: 3, top: top + 1,
                      height: h - 2, background: pal.block,

                      padding: '6px 7px 5px', overflow: 'hidden', color: A.ink,
                      display: 'flex', flexDirection: 'column', gap: 1,
                      boxShadow: 'none', borderRadius: "8px",
                      cursor: 'pointer'
                    }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, lineHeight: 1.15,
                        display: 'flex', alignItems: 'center', gap: 4, letterSpacing: -0.2,
                        color: A.ink
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto', opacity: 0.85 }}><KindIcon kind={ev.kind} size={13} fill={A.ink} /></span>
                        <span style={{
                          flex: 1, minWidth: 0, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: '"Pretendard", sans-serif', fontWeight: "500"
                        }}>{ev.title}</span>
                        {ev.pickup && <span style={{
                          width: 7, height: 7, borderRadius: 99,
                          background: primary, flex: '0 0 auto',
                          boxShadow: `0 0 0 2px ${pal.block}`
                        }} />}
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 400, color: A.inkSub, fontFamily: '"Pretendard", sans-serif'

                      }}>{fmt12hrShort(ev.start)}–{fmt12hrShort(ev.end)}</div>
                      {h > 64 && <div style={{
                        color: A.inkSub, marginTop: 'auto', fontWeight: 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: "10px", fontFamily: '"Pretendard", sans-serif'
                      }}>{ev.place}</div>}
                    </div>);

                })}
              </div>);

          })}

          {/* now badge + line — lime-yellow */}
          <div style={{
            position: 'absolute', left: 0, right: 12, top: nowTop,
            display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 4
          }}>
            <div style={{
              background: '#E0E345', color: '#1d1d1b', fontSize: 10.5, fontWeight: 600,
              padding: '2px 7px', borderRadius: 99,
              fontFamily: '"Pretendard", sans-serif',
              boxShadow: '0 2px 6px rgba(224,227,69,0.55)',
              marginLeft: 10, marginRight: -2
            }}>{(() => {
                const [h, m] = NOW_HHMM.split(':').map(Number);
                const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                return `${h12}:${String(m).padStart(2, '0')}`;
              })()}</div>
            <div style={{ flex: 1, height: 1.5, background: '#E0E345', borderRadius: 1 }} />
          </div>
        </div>
      </div>
    </div>);

}

function TodoB({ primary: primaryProp }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;
  const [supplies, setSupplies] = React.useState(TODOS);
  const [tasks, setTasks] = React.useState(TASKS);
  const [draft, setDraft] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {if (adding && inputRef.current) inputRef.current.focus();}, [adding]);

  const toggleSupply = (id) => setSupplies((s) => s.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleTask = (id) => setTasks((s) => s.map((x) => x.id === id ? { ...x, done: !x.done } : x));

  const suppliesByKid = KIDS.map((k) => ({ kid: k, items: supplies.filter((t) => t.kid === k.id) }));
  const supDone = supplies.filter((x) => x.done).length;
  const taskDone = tasks.filter((x) => x.done).length;

  const commitDraft = () => {
    const t = draft.trim();
    if (t) setTasks((prev) => [...prev, { id: 'nk-' + Date.now(), title: t, due: null, done: false }]);
    setDraft('');setAdding(false);
  };

  const SectionHeader = ({ label, done, total }) =>
  <div style={{
    display: 'flex', alignItems: 'baseline', gap: 8,
    padding: '14px 4px 8px', fontFamily: '"Pretendard", sans-serif'
  }}>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.4, whiteSpace: 'nowrap', fontFamily: '"Pretendard", sans-serif' }}>{label}</div>
      <div style={{
      fontSize: 11, fontWeight: 400, color: A.inkSub,
      fontFamily: '"Pretendard", sans-serif', whiteSpace: 'nowrap'
    }}>{done}/{total}</div>
    </div>;


  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px 100px', background: '#F7F6F5', fontFamily: '"Pretendard", sans-serif' }}>
      {/* ── 준비물 ──────────────────────────────────────────────── */}
      <SectionHeader label="준비물" done={supDone} total={supplies.length} />
      <div style={{
        background: '#fff', borderRadius: 18,
        padding: 6, marginBottom: 16
      }}>
        {suppliesByKid.map(({ kid, items: list }, idx) => {
          if (list.length === 0) return null;
          const pal = KID_PALETTE[kid.palette];
          const remaining = list.filter((i) => !i.done).length;
          return (
            <React.Fragment key={kid.id}>
              {idx > 0 &&
              <div style={{
                borderTop: `1px solid ${A.hair}`,
                margin: '4px 8px'
              }} />
              }
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 10px 4px', fontSize: "13px"
              }}>
                <AvatarPH kid={kid} size={30} />
                <div style={{ fontSize: 13, fontWeight: 700, color: A.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', fontFamily: '"Pretendard", sans-serif' }}>{kid.name}</div>
                <div style={{
                  marginLeft: 'auto', color: A.inkSub, fontWeight: 400,
                  fontFamily: '"Pretendard", sans-serif', whiteSpace: 'nowrap', fontSize: "10px"
                }}>{remaining}/{list.length} 남음</div>
              </div>
              {list.map((t) =>
              <div key={t.id} onClick={() => toggleSupply(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                borderRadius: 12,
                cursor: 'pointer', opacity: t.done ? 0.5 : 1,
                transition: 'opacity .15s', fontFamily: '"Pretendard", sans-serif', padding: "7px 10px"
              }}>
                  <div style={{
                  width: 22, height: 22, borderRadius: 99, boxSizing: 'border-box',
                  background: t.done ? pal.dot : '#fff',
                  border: t.done ? `1.5px solid ${pal.dot}` : `1.5px solid ${A.ink30}`,
                  display: 'grid', placeItems: 'center', color: '#fff',
                  flex: '0 0 auto', transition: 'all .15s'
                }}>{t.done && <Icon.check size={12} stroke="#fff" />}</div>
                  <div style={{
                  flex: 1, fontWeight: 400, letterSpacing: -0.2, color: A.ink,
                  textDecoration: t.done ? 'line-through' : 'none',
                  fontFamily: '"Pretendard", sans-serif', fontSize: "13px"
                }}>{t.title}</div>
                  {t.due &&
                <div style={{
                  fontSize: 10, color: A.inkSub, fontWeight: 400,
                  fontFamily: '"Pretendard", sans-serif',
                  background: A.ink04, padding: '2px 7px', borderRadius: 99
                }}>{t.due}</div>
                }
                </div>
              )}
            </React.Fragment>);

        })}
      </div>

      {/* ── 할일 ──────────────────────────────────────────────── */}
      <SectionHeader label="할일" done={taskDone} total={tasks.length} />
      <div style={{
        background: '#fff', borderRadius: 18,
        padding: 6, marginBottom: 16
      }}>
        {tasks.map((t) =>
        <div key={t.id} onClick={() => toggleTask(t.id)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 10px', borderRadius: 12,
          cursor: 'pointer', opacity: t.done ? 0.5 : 1,
          transition: 'opacity .15s', fontFamily: '"Pretendard", sans-serif'
        }}>
            <div style={{
            width: 22, height: 22, borderRadius: 99, boxSizing: 'border-box',
            background: t.done ? primary : '#fff',
            border: t.done ? `1.5px solid ${primary}` : `1.5px solid ${A.ink30}`,
            display: 'grid', placeItems: 'center', color: '#fff',
            flex: '0 0 auto', transition: 'all .15s'
          }}>{t.done && <Icon.check size={12} stroke="#fff" />}</div>
            <div style={{
            flex: 1, fontSize: 13, fontWeight: 400, letterSpacing: -0.2, color: A.ink,
            textDecoration: t.done ? 'line-through' : 'none',
            fontFamily: '"Pretendard", sans-serif'
          }}>{t.title}</div>
          </div>
        )}

        {/* Inline add row */}
        <div onClick={() => setAdding(true)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 10px', borderRadius: 12, cursor: 'text',
          borderTop: tasks.length > 0 ? `1px dashed ${A.hair}` : 'none',
          marginTop: tasks.length > 0 ? 2 : 0
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 99, boxSizing: 'border-box',
            border: `1.5px dashed ${A.ink30}`,
            display: 'grid', placeItems: 'center',
            flex: '0 0 auto', color: A.ink50
          }}><Icon.plus size={14} stroke={A.ink50} /></div>
          {adding ?
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft();
              if (e.key === 'Escape') {setDraft('');setAdding(false);}
            }}
            placeholder="할일 입력 후 Enter…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, fontWeight: 700, color: A.ink, letterSpacing: -0.2,
              fontFamily: '"Pretendard", sans-serif'
            }} /> :


          <div style={{ flex: 1, fontSize: 13, fontWeight: 400, color: A.inkSub, letterSpacing: -0.2, fontFamily: '"Pretendard", sans-serif' }}>
              할일 추가
            </div>
          }
        </div>
      </div>
    </div>);

}

// Floating bottom dock; FAB now lives INSIDE the bar as the centered action.
function BottomDockB({ primary: primaryProp, onAdd }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;
  return (
    <div style={{
      position: 'absolute', left: 14, right: 14, bottom: 22
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
        background: '#fff', borderRadius: 99, padding: '6px 16px',
        boxShadow: '0 10px 26px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)',
        gap: 10
      }}>
        <button style={dockBtnB(A, true)}>
          <Icon.home size={26} fill={primary} />
        </button>
        <button onClick={onAdd} style={{
          width: 44, height: 44, borderRadius: 99, border: 'none',
          background: A.ink, color: '#fff', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 10px rgba(29,29,27,0.25)',
          justifySelf: 'center'
        }}>
          <Icon.plus size={24} stroke="#fff" />
        </button>
        <a href="Settings.html" style={{ ...dockBtnB(A, false), textDecoration: 'none' }}>
          <Icon.gear size={26} fill={A.inkSub} />
        </a>
      </div>
    </div>);

}
function dockBtnB(A, active) {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    background: 'transparent', border: 'none', cursor: 'pointer', padding: 2
  };
}

Object.assign(window, { DailyB, ViewToggleB, topBtnB, CartoonCar, PickupCarousel, PickupCard });