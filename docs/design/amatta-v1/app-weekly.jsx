// app-weekly.jsx — Weekly drill-down view for a single kid.
// Sticky header + week strip, fixed bottom dock, scrollable middle.
// Top bar mirrors daily view: back, title, search. Date is clickable to open calendar drawer.

const WEEKLY_HOUR_START = 7;
const WEEKLY_HOUR_END = 20;
const WEEKLY_HOUR_PX = 52;

// Sample weekly events per kid (one full week; day 0=Sun..6=Sat).
const WEEKLY_EVENTS = {
  minjun: [
  { day: 0, start: '10:00', end: '11:00', title: '수영', kind: 'activity', place: '수영장' },
  { day: 1, start: '08:30', end: '14:30', title: '학교', kind: 'school', place: '학교' },
  { day: 1, start: '16:00', end: '17:30', title: '영어', kind: 'academy', place: '학원' },
  { day: 2, start: '08:30', end: '14:30', title: '학교', kind: 'school', place: '학교' },
  { day: 3, start: '08:30', end: '14:30', title: '학교', kind: 'school', place: '학교' },
  { day: 3, start: '16:00', end: '17:30', title: '영어', kind: 'academy', place: '학원' },
  { day: 4, start: '08:30', end: '14:30', title: '학교', kind: 'school', place: '학교' },
  { day: 5, start: '08:30', end: '14:30', title: '학교', kind: 'school', place: '학교' },
  { day: 5, start: '14:00', end: '16:00', title: '생일', kind: 'etc', place: '키즈카페' },
  { day: 5, start: '16:00', end: '17:30', title: '영어', kind: 'academy', place: '학원', cancelled: true }],

  seoyun: [
  { day: 1, start: '08:30', end: '13:30', title: '학교', kind: 'school', place: '학교' },
  { day: 1, start: '15:00', end: '16:30', title: '미술', kind: 'activity', place: '미술학원' },
  { day: 2, start: '08:30', end: '13:30', title: '학교', kind: 'school', place: '학교' },
  { day: 2, start: '14:30', end: '15:30', title: '미술', kind: 'activity', place: '미술학원' },
  { day: 3, start: '08:30', end: '13:30', title: '학교', kind: 'school', place: '학교' },
  { day: 4, start: '08:30', end: '13:30', title: '학교', kind: 'school', place: '학교' },
  { day: 4, start: '15:00', end: '16:30', title: '미술', kind: 'activity', place: '미술학원' },
  { day: 5, start: '08:30', end: '13:30', title: '학교', kind: 'school', place: '학교' }],

  jiho: [
  { day: 1, start: '09:30', end: '13:00', title: '유치원', kind: 'school', place: '유치원' },
  { day: 2, start: '09:30', end: '13:00', title: '유치원', kind: 'school', place: '유치원' },
  { day: 2, start: '15:30', end: '16:30', title: '태권도', kind: 'activity', place: '체육관' },
  { day: 3, start: '09:30', end: '13:00', title: '유치원', kind: 'school', place: '유치원' },
  { day: 4, start: '09:30', end: '13:00', title: '유치원', kind: 'school', place: '유치원' },
  { day: 4, start: '15:30', end: '16:30', title: '태권도', kind: 'activity', place: '체육관' },
  { day: 5, start: '09:30', end: '13:00', title: '유치원', kind: 'school', place: '유치원' },
  { day: 6, start: '10:00', end: '11:30', title: '발레', kind: 'activity', place: '발레학원' }],

  seoa: [
  { day: 1, start: '09:00', end: '15:00', title: '어린이집', kind: 'school', place: '어린이집' },
  { day: 2, start: '09:00', end: '15:00', title: '어린이집', kind: 'school', place: '어린이집' },
  { day: 3, start: '09:00', end: '15:00', title: '어린이집', kind: 'school', place: '어린이집' },
  { day: 3, start: '15:30', end: '16:30', title: '체육', kind: 'activity', place: '체육교실' },
  { day: 4, start: '09:00', end: '15:00', title: '어린이집', kind: 'school', place: '어린이집' },
  { day: 5, start: '09:00', end: '15:00', title: '어린이집', kind: 'school', place: '어린이집' },
  { day: 6, start: '10:00', end: '11:00', title: '놀이', kind: 'etc', place: '키즈카페' }]

};

function _minSince(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h - WEEKLY_HOUR_START) * 60 + m;
}
function _yPx(hhmm) {
  return _minSince(hhmm) / 60 * WEEKLY_HOUR_PX;
}

function WeeklyB({ kidId: kidIdProp = 'minjun', onBack }) {
  const A = AMATTA;
  const [kidId, setKidId] = React.useState(kidIdProp);
  const kid = KIDS.find((k) => k.id === kidId) || KIDS[0];
  const pal = KID_PALETTE[kid.palette];

  // Drawer state: 'kid' | 'calendar' | 'search' | 'new-event' | 'event-detail' | null
  const [drawer, setDrawer] = React.useState(null);
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [selectedDate, setSelectedDate] = React.useState({ y: 2026, m: 5, d: 5 });

  const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
  const WEEK = [3, 4, 5, 6, 7, 8, 9];
  const TODAY_IDX = 2; // Tue May 5
  const NOW_HHMM = '09:42';
  const nowY = _yPx(NOW_HHMM);

  const events = WEEKLY_EVENTS[kidId] || [];
  const activeCount = events.filter((e) => !e.cancelled).length;

  const HOURS = [];
  for (let h = WEEKLY_HOUR_START; h <= WEEKLY_HOUR_END; h++) HOURS.push(h);

  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) {
      const target = Math.max(0, nowY - 120);
      scrollRef.current.scrollTop = target;
    }
  }, []);

  // 12hr formatter for now badge
  const nowLabel = (() => {
    const [h, m] = NOW_HHMM.split(':').map(Number);
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${String(m).padStart(2, '0')}`;
  })();

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: A.cream, display: 'flex', flexDirection: 'column',
      fontFamily: '"Pretendard", sans-serif',
      color: A.ink, overflow: 'hidden',
      paddingTop: 54
    }}>
      {/* ── Fixed header ──────────────────────────────────────── */}
      <div style={{ flex: '0 0 auto', background: A.cream, zIndex: 3 }}>
        {/* Top bar (mirrors Daily View B) */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '8px 14px 4px', gap: 10
        }}>
          <button onClick={onBack} style={{ ...topBtnB(A), width: 28, height: 28, marginLeft: -4 }}>
            <Icon.chevL size={20} />
          </button>
          <button onClick={() => setDrawer('calendar')} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '4px 4px', display: 'flex', alignItems: 'baseline', gap: 8,
            whiteSpace: 'nowrap', flex: 1, minWidth: 0,
            fontFamily: 'inherit', color: A.ink
          }}>
            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, color: A.ink, fontFamily: '"Pretendard", sans-serif' }}>이번 주</span>
            <span style={{
              fontSize: 13, fontWeight: 400, color: A.inkSub, letterSpacing: -0.2,
              display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: '"Pretendard", sans-serif'
            }}>
              5월 3일 – 9일
              <Icon.chevD size={16} stroke={A.inkSub} />
            </span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
            <button onClick={() => setDrawer('search')} style={{ ...topBtnB(A), fontSize: "13px", height: "32px", width: "32px" }}><Icon.search size={20} /></button>
          </div>
        </div>

        {/* Kid selector pill — entire pill is the dropdown trigger */}
        <div style={{ padding: '8px 14px 8px' }}>
          <button
            onClick={() => setDrawer('kid')}
            style={{
              width: '100%', border: 'none', cursor: 'pointer',
              background: A.ink04,
              display: 'flex', alignItems: 'center', gap: 9,
              textAlign: 'left', padding: "4px 10px", borderRadius: "99px"
            }}>
            <AvatarPH kid={kid} size={28} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3, color: A.ink }}>{kid.name}</span>
              <span style={{ fontSize: 11, color: A.inkSub, fontWeight: 400 }}>이번 주 일정</span>
              <span style={{ fontSize: 11, color: A.ink, fontWeight: 600, fontFamily: '"Pretendard", sans-serif' }}>
                {activeCount}건
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2, color: A.inkSub,
              padding: '4px 6px', fontSize: 11.5, fontWeight: 500, letterSpacing: -0.2
            }}>
              바꾸기
              <Icon.chevR size={11} stroke={A.inkSub} />
            </div>
          </button>
        </div>

        {/* Week strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)',
          borderBottom: `1px solid ${A.hair}`, paddingBottom: 8, paddingTop: 4
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
      </div>

      {/* ── Scrollable grid ───────────────────────────────────────── */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', position: 'relative',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 88 // room for fixed bottom dock
      }}>
        <div style={{
          position: 'relative',
          height: (WEEKLY_HOUR_END - WEEKLY_HOUR_START + 1) * WEEKLY_HOUR_PX,
          display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)'
        }}>
          {/* Time gutter — hide labels too close to the now badge */}
          <div style={{ position: 'relative' }}>
            {HOURS.map((h) => {
              const top = (h - WEEKLY_HOUR_START) * WEEKLY_HOUR_PX;
              const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
              const ap = h < 12 ? 'AM' : 'PM';
              // suppress the label if it overlaps the now badge area
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

          {/* 7 day columns */}
          {DAYS_KR.map((_, dayIdx) => {
            const isToday = dayIdx === TODAY_IDX;
            const dayEvents = events.filter((e) => e.day === dayIdx);
            return (
              <div key={dayIdx} style={{
                position: 'relative',
                borderRight: dayIdx < 6 ? `1px solid ${A.hair}` : 'none',
                background: isToday ? `${pal.dot}10` : 'transparent'
              }}>
                {HOURS.map((h) => {
                  const top = (h - WEEKLY_HOUR_START) * WEEKLY_HOUR_PX;
                  return (
                    <div key={h} style={{
                      position: 'absolute', top, left: 0, right: 0, height: 1,
                      background: A.hair, opacity: 0.7
                    }} />);

                })}

                {dayEvents.map((ev, i) => {
                  const top = _yPx(ev.start);
                  const h = _yPx(ev.end) - _yPx(ev.start);
                  const isCancelled = ev.cancelled;
                  return (
                    <button key={i}
                    onClick={() => {setSelectedEvent({ ...ev, kidId });setDrawer('event-detail');}}
                    style={{
                      position: 'absolute', left: 2, right: 2, top: top + 1,
                      height: h - 2, background: pal.block,
                      borderRadius: 6,
                      padding: '4px 5px', overflow: 'hidden', color: A.ink,
                      display: 'flex', flexDirection: 'column', gap: 1,
                      boxShadow: `inset 0 0 0 1px ${pal.dot}`,
                      opacity: isCancelled ? 0.45 : 1,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'inherit'
                    }}>
                      <div style={{
                        fontSize: 10, fontWeight: 600, lineHeight: 1.1,
                        letterSpacing: -0.2, color: A.ink,
                        textDecoration: isCancelled ? 'line-through' : 'none',
                        display: 'flex', alignItems: 'center', gap: 2, minWidth: 0
                      }}>
                        <span style={{ display: 'inline-flex', flex: '0 0 auto', opacity: 0.85 }}>
                          <KindIcon kind={ev.kind} size={11} fill={A.ink} />
                        </span>
                        <span style={{
                          flex: 1, minWidth: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: "11px", fontWeight: "400"
                        }}>{ev.title}</span>
                      </div>
                      {h > 26 &&
                      <div style={{
                        fontWeight: 400, color: A.inkSub,
                        fontFamily: '"Pretendard", sans-serif', lineHeight: 1.15,
                        textDecoration: isCancelled ? 'line-through' : 'none', fontSize: "9px"
                      }}>{fmt12hrShort(ev.start)}–{fmt12hrShort(ev.end)}</div>
                      }
                    </button>);

                })}
              </div>);

          })}

          {/* Now line — continuous: badge in gutter, line continues right.
                                      Single z-layer, badge sits flush against line start. */}
          <div style={{
            position: 'absolute', top: nowY - 9,
            left: 0, right: 0, height: 18,
            display: 'flex', alignItems: 'center',
            pointerEvents: 'none', zIndex: 5
          }}>
            <div style={{
              width: 40, display: 'flex', justifyContent: 'flex-end',
              paddingRight: 0
            }}>
              <div style={{
                background: '#E0E345', color: '#1d1d1b',
                fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                fontFamily: '"Pretendard", sans-serif',
                boxShadow: '0 2px 6px rgba(224,227,69,0.55)'
              }}>{nowLabel}</div>
            </div>
            <div style={{
              flex: 1, height: 1.5, background: '#E0E345', borderRadius: 1,
              marginLeft: -1
            }} />
          </div>
        </div>
      </div>

      {/* ── Fixed bottom dock ────────────────────────────────── */}
      <BottomDockB onAdd={() => setDrawer('new-event')} />

      {/* ── Drawers ──────────────────────────────────────────── */}
      <KidDrawer
        open={drawer === 'kid'}
        onClose={() => setDrawer(null)}
        currentKidId={kidId}
        onPick={setKidId} />
      
      <CalendarDrawer
        open={drawer === 'calendar'}
        onClose={() => setDrawer(null)}
        selectedDate={selectedDate}
        onPickDate={setSelectedDate} />
      
      <SearchDrawer
        open={drawer === 'search'}
        onClose={() => setDrawer(null)} />

      <NewEventDrawer
        open={drawer === 'new-event'}
        onClose={() => setDrawer(null)}
        initialKidId={kidId}
        onSave={(data) => {console.log('saved', data);}} />
      

      <EventDetailDrawer
        open={drawer === 'event-detail'}
        onClose={() => setDrawer(null)}
        event={selectedEvent}
        kid={selectedEvent ? KIDS.find((k) => k.id === selectedEvent.kidId) || kid : kid}
        onEdit={() => {/* TODO: open new-event prefilled */}}
        onCancelOnce={() => setDrawer(null)}
        onDelete={() => setDrawer(null)} />
      
      
    </div>);

}

Object.assign(window, { WeeklyB, WEEKLY_EVENTS });