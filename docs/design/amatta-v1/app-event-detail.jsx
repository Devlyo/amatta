// app-event-detail.jsx — 일정 상세 보기. 새 일정 drawer와 동일한 룩앤필.
// 새 일정 폼의 Group/FullScreenSheet/Type-scale 토큰을 재사용.
// 라벨 13px · 값 weight 400. 액션은 풀 와이드 센터 정렬.

function EventDetail({ event, kid, onClose, onEdit, onCancelOnce, onDelete }) {
  const A = AMATTA;
  const T = AMATTA_FORM_T;
  const F = AMATTA_FORM_F;
  const N = AMATTA_FORM_N;
  if (!event || !kid) return null;
  const pal = KID_PALETTE[kid.palette];
  const kindLabel = (KIND_OPTIONS.find((k) => k.id === event.kind) || {}).label || event.kind;
  const alarmLabel = (ALARM_OPTIONS.find((a) => a.id === (event.alarm || '30m')) || {}).label || '30분 전';
  const days = event.days || [];
  const pickUp = !!(event.pickUp || event.pickup);
  const supplies = event.supplies || [];

  // ─── Local row for read-only detail (label 13px · value weight 400) ──
  const DETAIL_LABEL_W = 56;
  const DRow = ({ label, children, hairline = true, align = 'center' }) =>
    <div style={{
      display: 'flex',
      alignItems: align === 'top' ? 'flex-start' : 'center',
      gap: 12,
      padding: '10px 16px',
      borderBottom: hairline ? `1px solid ${A.ink04}` : 'none',
      minHeight: 40, boxSizing: 'border-box'
    }}>
      <div style={{
        width: DETAIL_LABEL_W, flex: '0 0 auto',
        paddingTop: align === 'top' ? 4 : 0,
        fontSize: 13, fontWeight: 400, letterSpacing: -0.2,
        color: A.inkSub, fontFamily: F
      }}>{label}</div>
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
        justifyContent: align === 'top' ? 'flex-start' : 'flex-end'
      }}>
        {children}
      </div>
    </div>;

  const valueStyle = { fontSize: 14, fontWeight: 400, letterSpacing: -0.2, fontFamily: F, color: A.ink };

  return (
    <React.Fragment>
      {/* Top bar — 취소 · Title · 수정  (matches Settings DetailTopBar) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', padding: '4px 14px 8px'
      }}>
        <button onClick={onClose} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          padding: '6px 4px', justifySelf: 'start',
          color: A.ink,
          fontSize: 15, fontWeight: 500, letterSpacing: -0.3,
          fontFamily: F
        }}>취소</button>
        <div style={{
          fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
          color: A.ink, fontFamily: F
        }}>일정</div>
        <button onClick={onEdit} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          padding: '6px 4px', justifySelf: 'end',
          color: A.primary,
          fontSize: 15, fontWeight: 600, letterSpacing: -0.3,
          fontFamily: F
        }}>수정</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>

        <Group>
          {/* 자녀 */}
          <DRow label="자녀">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: N.pillBg, padding: '3px 11px 3px 3px',
              borderRadius: 99, ...T.pill, color: A.inkSub, fontFamily: F
            }}>
              <AvatarPH kid={kid} size={22} />
              {kid.name}
            </div>
          </DRow>
          {/* 종류 */}
          <DRow label="종류">
            <span style={{ ...valueStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <KindIcon kind={event.kind} size={14} fill={A.ink} />
              {kindLabel}
            </span>
          </DRow>
        </Group>

        <Group>
          {/* 제목 */}
          <DRow label="제목">
            <span style={valueStyle}>{event.title}</span>
          </DRow>
          {/* 위치 */}
          <DRow label="위치">
            <span style={{
              ...valueStyle,
              color: event.place ? A.ink : A.ink30
            }}>{event.place || '위치 없음'}</span>
          </DRow>
        </Group>

        <Group>
          {/* 날짜 */}
          <DRow label="날짜">
            <span style={valueStyle}>
              {_fmtKoDate({ y: 2026, m: 5, d: 5 })}
            </span>
          </DRow>
          {/* 시간 */}
          <DRow label="시간">
            <span style={valueStyle}>{_fmt12hr(event.start)}</span>
            <span style={{ ...valueStyle, color: A.ink30 }}>–</span>
            <span style={valueStyle}>{_fmt12hr(event.end)}</span>
          </DRow>
          {/* 반복 */}
          {days.length > 0 &&
          <DRow label="반복" align="top">
              {DAYS_KR_SHORT.map((d, i) => {
              const active = days.includes(i);
              return (
                <div key={d} style={{
                  width: 28, height: 28, borderRadius: 99,
                  background: active ? N.pillActive : N.pillBg,
                  color: active ? '#fff' : A.ink30,
                  ...T.pill, fontFamily: F,
                  display: 'grid', placeItems: 'center'
                }}>{d}</div>);

            })}
            </DRow>
          }
        </Group>

        <Group>
          {/* 알림 */}
          <DRow label="알림">
            <span style={valueStyle}>{alarmLabel}</span>
          </DRow>
          {/* 픽업 — 켜져 있으면 일정 카드의 픽업 인디케이터와 동일한 점 + 시간 */}
          <DRow label="픽업">
            {pickUp ?
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 99,
                  background: A.primary, flex: '0 0 auto',
                  boxShadow: '0 0 0 1.5px #fff'
                }} />
                <span style={valueStyle}>{_fmt12hr(event.end)} 픽업</span>
              </span> :
              <span style={{ ...valueStyle, color: A.inkSub }}>필요 없음</span>
            }
          </DRow>
        </Group>

        {event.memo &&
        <Group>
            <DRow label="메모" align="top">
              <span style={{
              ...valueStyle,
              whiteSpace: 'pre-wrap', textAlign: 'left', width: '100%'
            }}>{event.memo}</span>
            </DRow>
          </Group>
        }

        {supplies.length > 0 &&
        <Group>
            <DRow label="준비물" align="top">
              <div style={{ width: '100%' }}>
                {supplies.map((s, i) =>
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0',
                borderTop: i > 0 ? `1px solid ${N.divider}` : 'none'
              }}>
                    <div style={{
                  width: 18, height: 18, borderRadius: 99, boxSizing: 'border-box',
                  background: s.done ? N.pillActive : '#fff',
                  border: s.done ? 'none' : `1.5px solid ${A.ink30}`,
                  display: 'grid', placeItems: 'center', color: '#fff',
                  flex: '0 0 auto'
                }}>{s.done && <Icon.check size={10} stroke="#fff" />}</div>
                    <span style={{
                  ...valueStyle,
                  textDecoration: s.done ? 'line-through' : 'none',
                  opacity: s.done ? 0.55 : 1
                }}>{s.title}</span>
                  </div>
              )}
              </div>
            </DRow>
          </Group>
        }

        {/* Destructive actions — full-width centered buttons in their own group. */}
        <div style={{
          background: '#fff', borderRadius: 14,
          margin: '0 14px 10px', overflow: 'hidden'
        }}>
          <button onClick={onCancelOnce} style={{
            width: '100%', display: 'block',
            border: 'none', background: 'transparent',
            padding: '13px 16px', cursor: 'pointer',
            textAlign: 'center',
            borderBottom: `1px solid ${A.ink04}`,
            fontSize: 14, fontWeight: 400, letterSpacing: -0.2,
            color: A.ink, fontFamily: F
          }}>이 회차만 취소</button>
          <button onClick={onDelete} style={{
            width: '100%', display: 'block',
            border: 'none', background: 'transparent',
            padding: '13px 16px', cursor: 'pointer',
            textAlign: 'center',
            fontSize: 14, fontWeight: 400, letterSpacing: -0.2,
            color: A.danger, fontFamily: F
          }}>일정 삭제</button>
        </div>

        <div style={{ height: 24 }} />
      </div>
    </React.Fragment>);

}

function EventDetailDrawer({ open, onClose, event, kid, onEdit, onCancelOnce, onDelete }) {
  return (
    <FullScreenSheet open={open} onClose={onClose}>
      {open &&
      <EventDetail
        event={event} kid={kid}
        onClose={onClose} onEdit={onEdit}
        onCancelOnce={onCancelOnce} onDelete={onDelete} />

      }
    </FullScreenSheet>);

}

Object.assign(window, { EventDetail, EventDetailDrawer });
