// app-event-form.jsx — 새 일정 추가 / 수정 풀스크린 모달 (v3 다듬음).
// v3 변경점:
//  · 타이포 통일 — 캡션 12/500, 값 15/600, 입력 15/500, 알약 13/500.
//  · 행 간격 일정(12px vertical), 가로 padding 18px 통일.
//  · 하단 sticky CTA 제거 → 상단 "추가" 버튼.
//  · 날짜 / 시간 라벨 뒤에 숨김 native input(date/time) — 탭하면 OS 피커.

const KIND_OPTIONS = [
{ id: 'school', label: '학교' },
{ id: 'academy', label: '학원' },
{ id: 'activity', label: '운동' },
{ id: 'etc', label: '기타' }];


const ALARM_OPTIONS = [
{ id: 'none', label: '없음' },
{ id: '10m', label: '10분 전' },
{ id: '30m', label: '30분 전' },
{ id: '1h', label: '1시간 전' }];


const DAYS_KR_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

// ─── Type scale (통일) ─────────────────────────────────────────────────
const T = {
  caption: { fontSize: 13, fontWeight: 400, letterSpacing: -0.2 },
  body:    { fontSize: 14, fontWeight: 400, letterSpacing: -0.2 },
  value:   { fontSize: 14, fontWeight: 400, letterSpacing: -0.2 },
  pill:    { fontSize: 12.5, fontWeight: 500, letterSpacing: -0.2 },
  title:   { fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }
};
const F = '"Pretendard", sans-serif';
// Form-specific neutral grays (near-neutral, a hair warm).
const N = {
  pillBg:     '#EBEAE9',
  pillActive: '#2A2A29',
  divider:    '#E8E7E6'
};

// Helpers
function _addMinutes(hhmm, delta) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + delta;
  const nh = (Math.floor(total / 60) % 24 + 24) % 24;
  const nm = (total % 60 + 60) % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}
function _fmt12hr(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? '오전' : '오후';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${ap} ${h12}:${String(m).padStart(2, '0')}`;
}
function _fmtKoDate({ y, m, d }) {
  const dt = new Date(y, m - 1, d);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${dow})`;
}
function _dateInputValue({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function _parseDateInput(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

// ─── 풀스크린 모달 ─────────────────────────────────────────────────────────
function FullScreenSheet({ open, onClose, children }) {
  return (
    <React.Fragment>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(20,18,16,0.34)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity .22s ease', zIndex: 60
      }} />
      <div style={{
        position: 'absolute', top: 20, left: 0, right: 0, bottom: 0,
        background: '#F7F6F5', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .26s cubic-bezier(.22,.8,.36,1)',
        zIndex: 61, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Grabber */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 38, height: 4, borderRadius: 99, background: AMATTA.ink12 }} />
        </div>
        {children}
      </div>
    </React.Fragment>);

}

// ─── 폼 컨트롤들 ─────────────────────────────────────────────────────────
const ROW_PAD_X = 16;
const ROW_PAD_Y = 10;
const LABEL_W = 56;
const GROUP_MARGIN_X = 14;

// Group — Apple-style rounded card containing related Rows.
// Internal Rows get hairlines; the last one auto-omits its hairline.
function Group({ children }) {
  const A = AMATTA;
  const arr = React.Children.toArray(children).filter(Boolean);
  // Inject hairline=false into the last child Row
  const last = arr.length - 1;
  const rows = arr.map((c, i) =>
    i === last && React.isValidElement(c) ?
      React.cloneElement(c, { hairline: false }) : c
  );
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      margin: `0 ${GROUP_MARGIN_X}px 10px`,
      overflow: 'hidden'
    }}>{rows}</div>
  );
}

// Unified Row — label is always on the LEFT (fixed width column).
// Content fills the rest; can wrap to multiple lines for pill groups.
// `align`: 'center' for inline-value rows (toggle/date/time) — content right-aligned.
//          'top' for wrapping pills / inputs — content left-aligned, wraps below if needed.
function Row({ label, children, hairline = true, align = 'center' }) {
  const A = AMATTA;
  return (
    <div style={{
      display: 'flex',
      alignItems: align === 'top' ? 'flex-start' : 'center',
      gap: 12,
      padding: `${ROW_PAD_Y}px ${ROW_PAD_X}px`,
      borderBottom: hairline ? `1px solid ${A.ink04}` : 'none',
      minHeight: 40, boxSizing: 'border-box'
    }}>
      <div style={{
        width: LABEL_W, flex: '0 0 auto',
        paddingTop: align === 'top' ? 5 : 0,
        ...T.caption, color: A.inkSub, fontFamily: F
      }}>{label}</div>
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
        justifyContent: align === 'top' ? 'flex-start' : 'flex-end'
      }}>
        {children}
      </div>
    </div>
  );
}

// For sections that need full-width content (메모, 준비물) — label sits on top.
function Section({ label, children, hairline = true }) {
  const A = AMATTA;
  return (
    <div style={{
      padding: `${ROW_PAD_Y}px ${ROW_PAD_X}px`,
      borderBottom: hairline ? `1px solid ${A.ink04}` : 'none'
    }}>
      {label &&
        <div style={{
          ...T.caption, color: A.inkSub, marginBottom: 8, fontFamily: F
        }}>{label}</div>
      }
      {children}
    </div>
  );
}

// Back-compat shims (called by Section/Row internally elsewhere; old callers).
function InlineRow({ label, sub, control, hairline = true }) {
  return (
    <Row label={label} hairline={hairline}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sub &&
          <span style={{
            fontSize: 11.5, color: AMATTA.inkSub,
            fontWeight: 400, letterSpacing: -0.1, fontFamily: F
          }}>{sub}</span>
        }
        {control}
      </div>
    </Row>
  );
}

function PillRow({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>;
}

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      border: 'none',
      background: active ? N.pillActive : N.pillBg,
      color: active ? '#fff' : AMATTA.inkSub,
      cursor: 'pointer', padding: '7px 13px', borderRadius: 99,
      ...T.pill, fontFamily: F,
      transition: 'all .12s', lineHeight: 1,
      whiteSpace: 'nowrap', flex: '0 0 auto'
    }}>{children}</button>
  );
}

function KidPillRow({ kids, currentKidId, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {kids.map((k) => {
        const active = k.id === currentKidId;
        return (
          <button key={k.id} onClick={() => onPick(k.id)} style={{
            border: 'none',
            background: active ? N.pillActive : N.pillBg,
            color: active ? '#fff' : AMATTA.inkSub,
            cursor: 'pointer', padding: '3px 11px 3px 3px', borderRadius: 99,
            ...T.pill, fontFamily: F,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all .12s', lineHeight: 1
          }}>
            <AvatarPH kid={k} size={22}/>
            {k.name}
          </button>
        );
      })}
    </div>
  );
}

function DayCircle({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 99,
      border: 'none',
      background: active ? N.pillActive : N.pillBg,
      color: active ? '#fff' : AMATTA.inkSub,
      cursor: 'pointer', ...T.pill, fontFamily: F,
      display: 'grid', placeItems: 'center', transition: 'all .12s',
      padding: 0
    }}>{label}</button>
  );
}

// Repeat (cycle) glyph — used by 준비물 "매번" 토글.
function RepeatGlyph({ size = 13, stroke = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4"/>
      <path d="M3 11V9a4 4 0 014-4h14"/>
      <path d="M7 22l-4-4 4-4"/>
      <path d="M21 13v2a4 4 0 01-4 4H3"/>
    </svg>
  );
}

function ToggleSwitch({ value, onChange, size = 36 }) {
  const h = Math.round(size * 0.6);
  return (
    <button onClick={() => onChange(!value)} style={{
      width: size, height: h, borderRadius: 99,
      border: 'none', background: value ? N.pillActive : '#D6D8DD',
      position: 'relative', cursor: 'pointer', transition: 'background .15s',
      padding: 0, flex: '0 0 auto'
    }}>
      <div style={{
        position: 'absolute', top: 2, left: value ? size - h + 2 : 2,
        width: h - 4, height: h - 4, borderRadius: 99,
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left .15s'
      }} />
    </button>);

}

// Big input — matches T.body sizing so placeholder/value/labels all align.
function _bigInputStyle(A) {
  return {
    width: '100%', boxSizing: 'border-box',
    border: 'none', background: 'transparent',
    padding: 0, margin: 0,
    ...T.body, color: A.ink, outline: 'none', fontFamily: F,
    lineHeight: 1.3
  };
}

// Date / time field — styled label with hidden native input behind it,
// so tap opens the OS-native picker (iOS wheel / Android dialog).
function NativeField({ type, value, displayText, onChange, ariaLabel }) {
  const A = AMATTA;
  return (
    <label style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4,
      cursor: 'pointer'
    }} aria-label={ariaLabel}>
      <span style={{ ...T.value, color: A.ink, fontFamily: F }}>{displayText}</span>
      <Icon.chevD size={14} stroke={A.inkSub}/>
      <input
        type={type} value={value} onChange={onChange}
        style={{
          position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
          fontSize: 16, // prevents iOS zoom
          border: 'none', background: 'transparent'
        }}/>
    </label>
  );
}

// ─── NewEventForm (모달 안 컨텐츠) ──────────────────────────────────────
function NewEventForm({ initialKidId = 'minjun', onCancel, onSave, primary }) {
  const A = AMATTA;
  const p = primary || A.primary;
  const [kidId, setKidId] = React.useState(initialKidId);
  const [kind, setKind] = React.useState('academy');
  const [title, setTitle] = React.useState('');
  const [start, setStart] = React.useState('16:00');
  const [end, setEnd] = React.useState('17:30');
  const [allDay, setAllDay] = React.useState(false);
  const [days, setDays] = React.useState([1, 3, 5]); // 월수금
  const [place, setPlace] = React.useState('');
  const [memo, setMemo] = React.useState('');
  const [alarm, setAlarm] = React.useState('30m');
  const [pickUp, setPickUp] = React.useState(false);
  const [supplies, setSupplies] = React.useState([]);
  const [dateObj, setDateObj] = React.useState({ y: 2026, m: 5, d: 5 });

  const toggleDay = (d) => setDays((s) => s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort());
  // 준비물에 반복 개념이 있는 건 일정이 반복(요일 선택)일 때만.
  const suppliesRepeatable = days.length > 0;
  // 반복 일정이면 새 준비물은 기본 "매번"으로 — 대부분 매 수업마다 챙기는 물건이라.
  const addSupply = () => setSupplies((s) => [...s, { id: 's' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), title: '', done: false, repeat: suppliesRepeatable }]);
  const editSupply = (id, t) => setSupplies((s) => s.map((x) => x.id === id ? { ...x, title: t } : x));
  const rmSupply = (id) => setSupplies((s) => s.filter((x) => x.id !== id));
  const toggleSupplyRepeat = (id) => setSupplies((s) => s.map((x) => x.id === id ? { ...x, repeat: !x.repeat } : x));

  const canSave = title.trim().length > 0;

  return (
    <React.Fragment>
      {/* Top bar — 취소 · Title · 추가  (matches Settings DetailTopBar) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', padding: '4px 14px 8px'
      }}>
        <button onClick={onCancel} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          padding: '6px 4px', justifySelf: 'start',
          color: A.ink,
          fontSize: 15, fontWeight: 500, letterSpacing: -0.3,
          fontFamily: F
        }}>취소</button>
        <div style={{
          fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
          color: A.ink, fontFamily: A.fontDisplay
        }}>새 일정</div>
        <button
          onClick={() => canSave && onSave({ kidId, kind, title, start, end, allDay, days, dateObj, place, memo, alarm, pickUp, supplies })}
          disabled={!canSave}
          style={{
            border: 'none', background: 'transparent',
            cursor: canSave ? 'pointer' : 'default',
            padding: '6px 4px', justifySelf: 'end',
            color: canSave ? p : A.ink30,
            fontSize: 15, fontWeight: 600, letterSpacing: -0.3,
            fontFamily: F
          }}>
          추가
        </button>
      </div>

      {/* Scrollable form body */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>

        <Group>
          {/* 자녀 */}
          <Row label="자녀" align="top">
            <KidPillRow kids={KIDS} currentKidId={kidId} onPick={setKidId}/>
          </Row>
          {/* 종류 */}
          <Row label="종류" align="top">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', width: '100%' }}>
              {KIND_OPTIONS.map((k) =>
                <Pill key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <KindIcon kind={k.id} size={14} fill="currentColor" />
                    {k.label}
                  </span>
                </Pill>
              )}
            </div>
          </Row>
        </Group>

        <Group>
          {/* 제목 */}
          <Row label="제목" align="top">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 영어학원" style={_bigInputStyle(A)}/>
          </Row>
          {/* 위치 */}
          <Row label="위치" align="top">
            <input value={place} onChange={(e) => setPlace(e.target.value)}
              placeholder="예) JLS어학원" style={_bigInputStyle(A)}/>
          </Row>
        </Group>

        <Group>
          {/* 종일 */}
          <Row label="종일">
            <ToggleSwitch value={allDay} onChange={setAllDay}/>
          </Row>
          {/* 날짜 */}
          <Row label="날짜">
            <NativeField
              type="date"
              value={_dateInputValue(dateObj)}
              displayText={_fmtKoDate(dateObj)}
              onChange={(e) => e.target.value && setDateObj(_parseDateInput(e.target.value))}
              ariaLabel="날짜 선택"
            />
          </Row>
          {/* 시간 */}
          {!allDay &&
            <Row label="시간">
              <NativeField
                type="time"
                value={start}
                displayText={_fmt12hr(start)}
                onChange={(e) => e.target.value && setStart(e.target.value)}
                ariaLabel="시작 시간"
              />
              <span style={{ ...T.body, color: A.ink30, fontFamily: F }}>–</span>
              <NativeField
                type="time"
                value={end}
                displayText={_fmt12hr(end)}
                onChange={(e) => e.target.value && setEnd(e.target.value)}
                ariaLabel="끝 시간"
              />
            </Row>
          }
          {/* 반복 */}
          <Row label="반복" align="top">
            {DAYS_KR_SHORT.map((d, i) =>
              <DayCircle key={d} active={days.includes(i)} onClick={() => toggleDay(i)} label={d}/>
            )}
          </Row>
        </Group>

        <Group>
          {/* 알림 */}
          <Row label="알림" align="top">
            {ALARM_OPTIONS.map((a) =>
              <Pill key={a.id} active={alarm === a.id} onClick={() => setAlarm(a.id)}>{a.label}</Pill>
            )}
          </Row>
          {/* 픽업 — 켜져 있으면 일정 카드에 보이는 점 + 데리러 시간 표시 */}
          <Row label="픽업">
            {pickUp &&
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                ...T.value, color: A.ink, fontFamily: F, marginRight: 2
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 99,
                  background: p, flex: '0 0 auto',
                  boxShadow: '0 0 0 1.5px #fff'
                }} />
                {_fmt12hr(end)} 픽업
              </span>
            }
            <ToggleSwitch value={pickUp} onChange={setPickUp}/>
          </Row>
        </Group>

        <Group>
          {/* 메모 */}
          <Row label="메모" align="top">
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder="추가 정보"
              rows={1}
              style={{ ..._bigInputStyle(A), resize: 'none' }}/>
          </Row>
        </Group>

        <Group>
          {/* 준비물 — 일정이 반복(요일 선택)이면 항목마다 ↻ "매번" 토글 노출 */}
          <Row label="준비물" align="top">
            <div style={{ width: '100%' }}>
              {supplies.map((s, i) =>
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0',
                  borderTop: i > 0 ? `1px solid ${A.ink04}` : 'none',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 99,
                    border: `1.5px solid ${A.ink30}`, flex: '0 0 auto',
                  }}/>
                  <input
                    value={s.title} onChange={(e) => editSupply(s.id, e.target.value)}
                    placeholder="준비물 이름"
                    style={{
                      flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none',
                      ...T.body, color: A.ink, fontFamily: F
                    }}/>
                  {suppliesRepeatable &&
                    <button
                      onClick={() => toggleSupplyRepeat(s.id)}
                      aria-label={s.repeat ? '매번 챙김 (탭하면 이번만)' : '이번만 (탭하면 매번)'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        border: 'none', cursor: 'pointer',
                        background: s.repeat ? A.primaryTint : 'transparent',
                        color: s.repeat ? A.primaryDeep : A.ink30,
                        borderRadius: 99,
                        padding: s.repeat ? '4px 9px 4px 7px' : '4px 5px',
                        flex: '0 0 auto', transition: 'all .14s',
                      }}>
                      <RepeatGlyph size={13}/>
                      {s.repeat &&
                        <span style={{ ...T.pill, fontFamily: F, lineHeight: 1 }}>매번</span>
                      }
                    </button>
                  }
                  <button onClick={() => rmSupply(s.id)} style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: A.inkSub, padding: 4, display: 'grid', placeItems: 'center',
                    flex: '0 0 auto',
                  }}>
                    <Icon.xMark size={14}/>
                  </button>
                </div>
              )}
              <button onClick={addSupply} style={{
                width: '100%', border: 'none', cursor: 'pointer',
                background: 'transparent',
                padding: supplies.length > 0 ? '6px 0 0' : '2px 0',
                display: 'flex', alignItems: 'center', gap: 8,
                color: A.inkSub, ...T.pill, fontFamily: F
              }}>
                <Icon.plus size={12} stroke={A.inkSub}/>
                추가
              </button>
            </div>
          </Row>
        </Group>

        {/* bottom safe-area */}
        <div style={{ height: 24 }}/>
      </div>
    </React.Fragment>);

}

// ─── NewEventDrawer (모달 wrapper) ──────────────────────────────────────
function NewEventDrawer({ open, onClose, initialKidId, onSave, primary }) {
  return (
    <FullScreenSheet open={open} onClose={onClose}>
      {open &&
      <NewEventForm
        initialKidId={initialKidId}
        primary={primary}
        onCancel={onClose}
        onSave={(data) => {onSave && onSave(data);onClose();}} />

      }
    </FullScreenSheet>);

}

// Compatibility for any other callers.
function FormRow({ label, children }) { return <Section label={label}>{children}</Section>; }
function FormCard({ children }) { return <div>{children}</div>; }
function TimePill({ value }) {
  return <span style={{ ...T.value, color: AMATTA.ink, fontFamily: F }}>{_fmt12hr(value)}</span>;
}

Object.assign(window, {
  NewEventDrawer, NewEventForm, FullScreenSheet,
  Section, InlineRow, FormRow, FormCard, Row, Group, PillRow, Pill, KidPillRow, TimePill, DayCircle, ToggleSwitch,
  NativeField,
  KIND_OPTIONS, ALARM_OPTIONS, DAYS_KR_SHORT,
  AMATTA_FORM_T: T, AMATTA_FORM_F: F, AMATTA_FORM_N: N,
  _addMinutes, _fmt12hr, _fmtKoDate
});
