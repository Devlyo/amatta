// app-settings.jsx — 설정 (Settings) screen for 아마따
// Visual language matches the 준비물&할일 tab in Daily View B:
//   - Section labels above the card (16px / 600, with optional count chip)
//   - White rounded cards (borderRadius 18) on warm gray background (#F7F6F5)
//   - Rows use 7px 10px padding, dashed hair dividers between groups
// User requested:
//   - Remove 시간 표시
//   - Notifications collapsed onto main (toggle inline, no detail page)
//   - 모든 데이터 초기화 stays destructive

function Settings({ onBack, primary: primaryProp }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;

  const [systemNotif, setSystemNotif] = React.useState(true);
  const [leadTime, setLeadTime] = React.useState(30); // minutes before
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const LEAD_OPTIONS = [10, 30, 60];

  return (
    <div style={{
      width: '100%', height: '100%', background: '#F7F6F5',
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54
    }}>
      {/* ── Top bar ────────────────────────────────────────── */}
      <SettingsTopBar onBack={onBack} A={A} />

      {/* ── Scrollable body ────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 120px' }}>

        {/* 자녀 ─────────────────────────────────────────── */}
        <SectionHeader label="자녀" A={A} />
        <Card>
          <NavRow
            label="자녀 관리"
            value={<KidStack />}
            onClick={() => {window.location.href = 'Settings - Kids.html';}}
            A={A} />
          
        </Card>

        {/* 알림 ─────────────────────────────────────────── */}
        <SectionHeader label="알림" A={A} />
        <Card>
          <ToggleRow
            label="시스템 알림"
            sub="이벤트 시작 전에 푸시 받기"
            checked={systemNotif}
            onChange={setSystemNotif}
            primary={primary}
            A={A} />
          
          <Divider A={A} />
          <SegmentedRow
            label="기본 알림 시점"
            sub="새 일정에 자동으로 설정돼요"
            options={LEAD_OPTIONS}
            value={leadTime}
            onChange={setLeadTime}
            disabled={!systemNotif}
            primary={primary}
            renderOption={(v) => `${v}분 전`}
            A={A} />
          
        </Card>

        {/* 데이터 ───────────────────────────────────────── */}
        <SectionHeader label="데이터" A={A} />
        <Card>
          <NavRow
            label="JSON 내보내기"
            sub="모든 일정·할일을 파일로 저장"
            icon="export"
            onClick={() => {window.location.href = 'Settings - Export.html';}}
            A={A} />
          
          <Divider A={A} />
          <NavRow
            label="JSON 가져오기"
            sub="백업한 파일에서 복원"
            icon="import"
            onClick={() => {window.location.href = 'Settings - Import.html';}}
            A={A} />
          
        </Card>

        <div style={{ height: 8 }} />
        <Card>
          <DestructiveRow
            label="모든 데이터 초기화"
            sub="자녀·일정·할일·설정이 모두 삭제돼요"
            onClick={() => setShowResetConfirm(true)}
            A={A} />
          
        </Card>

        {/* 정보 ─────────────────────────────────────────── */}
        <SectionHeader label="정보" A={A} />
        <Card>
          <InfoRow
            label="앱 버전"
            value="1.0.0"
            valueSub="(build 1)"
            A={A} />
          
          <Divider A={A} />
          <NavRow label="개인정보처리방침" onClick={() => {window.location.href = 'Settings - Privacy.html';}} A={A} />
          <Divider A={A} />
          <NavRow label="이용약관" onClick={() => {window.location.href = 'Settings - Terms.html';}} A={A} />
        </Card>
      </div>

      <BottomDockSettings primary={primary} A={A} />

      {/* Reset confirmation */}
      {showResetConfirm && <ResetConfirmSheet onCancel={() => setShowResetConfirm(false)} onConfirm={() => setShowResetConfirm(false)} A={A} />}
    </div>);

}

// ── Top bar ─────────────────────────────────────────────────────────────
function SettingsTopBar({ onBack, A }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', padding: '4px 14px 8px',
      background: '#F7F6F5'
    }}>
      <button
        onClick={onBack}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          padding: '6px 4px', display: 'inline-flex', alignItems: 'center',
          gap: 2, color: A.ink, justifySelf: 'start',
          fontFamily: '"Pretendard", sans-serif'
        }}>
        
        <Icon.chevL size={22} stroke={A.ink} />
      </button>
      <div style={{
        fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
        color: A.ink, fontFamily: '"Pretendard", sans-serif'
      }}>설정</div>
      <div />
    </div>);

}

// ── Section header — small caption style, matches Event form labels ────
function SectionHeader({ label, count, A }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 6,
      padding: '14px 14px 6px', fontFamily: '"Pretendard", sans-serif'
    }}>
      <div style={{
        fontSize: 13, fontWeight: 400, letterSpacing: -0.2,
        color: A.inkSub, fontFamily: '"Pretendard", sans-serif'
      }}>{label}</div>
      {count != null &&
      <div style={{
        fontSize: 11, fontWeight: 400, color: A.inkSub,
        fontFamily: '"Pretendard", sans-serif'
      }}>{count}</div>
      }
    </div>);

}

// ── Card — white rounded surface ───────────────────────────────────────
function Card({ children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      padding: 4, marginBottom: 8,
      overflow: 'hidden'
    }}>
      {children}
    </div>);

}

function Divider({ A }) {
  return (
    <div style={{
      borderTop: `1px solid ${A.ink04}`,
      margin: '0 10px'
    }} />);

}

// ── Generic row chrome ─────────────────────────────────────────────────
function RowFrame({ children, onClick, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 10px', borderRadius: 12,
        cursor: onClick && !disabled ? 'pointer' : 'default',
        opacity: disabled ? 0.45 : 1,
        transition: 'background .12s'
      }}
      onMouseEnter={(e) => {if (onClick && !disabled) e.currentTarget.style.background = AMATTA.ink04;}}
      onMouseLeave={(e) => {e.currentTarget.style.background = 'transparent';}}>
      
      {children}
    </div>);

}

function RowText({ label, sub, color, A }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 14, letterSpacing: -0.3,
        color: color || A.ink, lineHeight: 1.25,
        fontFamily: '"Pretendard", sans-serif', fontWeight: "400"
      }}>{label}</div>
      {sub &&
      <div style={{
        fontSize: 12, fontWeight: 400, color: A.inkSub,
        marginTop: 2, letterSpacing: -0.1, lineHeight: 1.3,
        fontFamily: '"Pretendard", sans-serif'
      }}>{sub}</div>
      }
    </div>);

}

// ── Navigation row: label + value + chevron ────────────────────────────
function NavRow({ label, sub, value, onClick, A }) {
  return (
    <RowFrame onClick={onClick}>
      <RowText label={label} sub={sub} A={A} />
      {value != null &&
      <div style={{
        fontSize: 13, fontWeight: 400, color: A.inkSub,
        letterSpacing: -0.2, whiteSpace: 'nowrap',
        fontFamily: '"Pretendard", sans-serif'
      }}>{value}</div>
      }
      <ChevR A={A} />
    </RowFrame>);

}

// ── Toggle row: label + iOS-style switch ───────────────────────────────
function ToggleRow({ label, sub, checked, onChange, primary, A }) {
  return (
    <RowFrame onClick={() => onChange(!checked)}>
      <RowText label={label} sub={sub} A={A} />
      <Switch checked={checked} primary={primary} A={A} />
    </RowFrame>);

}

function Switch({ checked, primary, A }) {
  const W = 44,H = 26,KNOB = 22,PAD = 2;
  return (
    <div style={{
      width: W, height: H, borderRadius: 99,
      background: checked ? primary : A.ink12,
      position: 'relative', flex: '0 0 auto',
      transition: 'background .18s ease',
      boxShadow: checked ? `inset 0 0 0 1px ${primary}` : `inset 0 0 0 1px ${A.ink06}`
    }}>
      <div style={{
        position: 'absolute', top: PAD,
        left: checked ? W - KNOB - PAD : PAD,
        width: KNOB, height: KNOB, borderRadius: 99,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18), 0 1px 1px rgba(0,0,0,0.08)',
        transition: 'left .2s cubic-bezier(.2,.8,.2,1)'
      }} />
    </div>);

}

// ── Segmented row: label/sub on left, segmented selector on right ──────
// For small option sets like 알림 시점 (10분/30분/1시간 전).
function SegmentedRow({ label, sub, options, value, onChange, renderOption, primary, disabled, A }) {
  return (
    <div style={{
      padding: '8px 10px 10px', borderRadius: 12,
      opacity: disabled ? 0.45 : 1, transition: 'opacity .15s'
    }}>
      <RowText label={label} sub={sub} A={A} />
      <div style={{
        marginTop: 10, display: 'inline-flex',
        background: A.ink04, borderRadius: 99, padding: 3, gap: 2,
        width: '100%'
      }}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              onClick={() => !disabled && onChange(opt)}
              disabled={disabled}
              style={{
                flex: 1, border: 'none', cursor: disabled ? 'default' : 'pointer',
                background: active ? '#fff' : 'transparent',
                color: active ? A.ink : A.inkSub,
                fontSize: 13, fontWeight: active ? 600 : 400,
                letterSpacing: -0.2, padding: '7px 10px',
                borderRadius: 99,
                boxShadow: active ? `0 1px 2px rgba(0,0,0,0.06), inset 0 0 0 1px ${A.hair}` : 'none',
                fontFamily: '"Pretendard", sans-serif',
                transition: 'all .15s ease'
              }}>
              {renderOption ? renderOption(opt) : opt}</button>);

        })}
      </div>
    </div>);

}

// ── Info row: read-only label + value (no chevron) ─────────────────────
function InfoRow({ label, value, valueSub, A }) {
  return (
    <RowFrame>
      <RowText label={label} A={A} />
      <div style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 5,
        fontFamily: '"Geist", "Pretendard", sans-serif'
      }}>
        <span style={{
          fontSize: 13, fontWeight: 400, color: A.ink,
          letterSpacing: -0.1
        }}>{value}</span>
        {valueSub &&
        <span style={{
          fontSize: 11, fontWeight: 400, color: A.inkSub,
          letterSpacing: 0.2
        }}>{valueSub}</span>
        }
      </div>
    </RowFrame>);

}

// ── Destructive row — single solo card ─────────────────────────────────
function DestructiveRow({ label, sub, onClick, A }) {
  const DESTRUCTIVE = A.danger;
  return (
    <RowFrame onClick={onClick}>
      <RowText label={label} sub={sub} color={DESTRUCTIVE} A={A} />
      <ChevR A={A} color={DESTRUCTIVE} />
    </RowFrame>);

}

// ── Right chevron — small, secondary ───────────────────────────────────
function ChevR({ A, color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={color || A.ink30} strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ flex: '0 0 auto', marginLeft: 2 }}>
      
      <path d="M9 6l6 6-6 6" />
    </svg>);

}

// ── Avatar stack for 자녀 관리 (4명) ────────────────────────────────────
function KidStack() {
  const A = AMATTA;
  const max = 4;
  const shown = KIDS.slice(0, max);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((k, i) =>
        <div key={k.id} style={{
          width: 22, height: 22, borderRadius: 99,
          marginLeft: i === 0 ? 0 : -7,
          boxShadow: `0 0 0 1.5px #fff`,
          background: '#fff',
          display: 'grid', placeItems: 'center',
          overflow: 'hidden', zIndex: max - i
        }}>
            <AvatarPH kid={k} size={22} />
          </div>
        )}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 400, color: A.ink,
        letterSpacing: -0.2, fontFamily: '"Pretendard", sans-serif'
      }}>{KIDS.length}명</div>
    </div>);

}

// ── Bottom dock — settings is the active tab ───────────────────────────
function BottomDockSettings({ primary, A }) {
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
        <a href="Daily View B.html" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 2,
          textDecoration: 'none'
        }}>
          <Icon.home size={26} fill={A.inkSub} />
        </a>
        <a href="Daily View B.html" style={{
          width: 44, height: 44, borderRadius: 99, border: 'none',
          background: A.ink, color: '#fff', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 10px rgba(29,29,27,0.25)',
          justifySelf: 'center', textDecoration: 'none'
        }}>
          <Icon.plus size={24} stroke="#fff" />
        </a>
        <button style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 2
        }}>
          <Icon.gear size={26} fill={primary} />
        </button>
      </div>
    </div>);

}

// ── Reset confirmation sheet ───────────────────────────────────────────
function ResetConfirmSheet({ onCancel, onConfirm, A }) {
  const DESTRUCTIVE = A.danger;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(29,29,27,0.4)', backdropFilter: 'blur(2px)'
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '20px 18px 28px',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.18)'
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: A.ink12,
          margin: '0 auto 16px'
        }} />
        <div style={{
          fontSize: 17, fontWeight: 700, letterSpacing: -0.4,
          color: A.ink, fontFamily: '"Pretendard", sans-serif',
          marginBottom: 6
        }}>모든 데이터를 초기화할까요?</div>
        <div style={{
          fontSize: 13, fontWeight: 400, color: A.inkSub,
          letterSpacing: -0.2, lineHeight: 1.5,
          fontFamily: '"Pretendard", sans-serif',
          marginBottom: 18
        }}>자녀, 일정, 할일, 알림 설정이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onConfirm} style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: DESTRUCTIVE, color: '#fff',
            fontSize: 15, fontWeight: 600, letterSpacing: -0.3,
            fontFamily: '"Pretendard", sans-serif'
          }}>초기화하기</button>
          <button onClick={onCancel} style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: A.ink04, color: A.ink,
            fontSize: 15, fontWeight: 500, letterSpacing: -0.3,
            fontFamily: '"Pretendard", sans-serif'
          }}>취소</button>
        </div>
      </div>
    </div>);

}

Object.assign(window, {
  Settings,
  // Shared chrome — reused across all settings detail screens
  SettingsTopBar, SectionHeader, Card, Divider,
  RowFrame, RowText, NavRow, ToggleRow, Switch,
  SegmentedRow, InfoRow, DestructiveRow, ChevR,
  BottomDockSettings, ResetConfirmSheet
});