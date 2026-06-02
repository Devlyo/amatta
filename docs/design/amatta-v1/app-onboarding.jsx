// app-onboarding.jsx — 온보딩
//   Scene 1 : Welcome     (Onboarding - Welcome.html)
//   Scene 2+: Add Kid     (Onboarding - Add Kid.html) — 자녀 1명 이상 등록
//
// 자녀 등록 폼 = 설정·자녀편집 폼의 라이트 버전. 이름 / 아바타 / 팔레트만.
// 나이·학년 정보는 받지 않음.

const ONB_BG = '#FEF4F2';
const ONB_MAX_KIDS = 4;
const ONB_AVATARS = ['face-wink', 'face-dizzy', 'face-cool', 'face-sleep', 'face-surprise', 'face-calm']; // 6개 — face-happy(주황)는 brand primary 전용이라 제외 (DS §10 Q7)
const ONB_PALETTES = ['peach', 'mint', 'sky', 'butter'];
const ONB_PAL_LABEL = { peach: '피치', mint: '민트', sky: '스카이', butter: '버터' };

// ═══════════════════════════════════════════════════════════════════════
// SCENE 1 — Welcome  (배경 #FEF4F2, 마스코트 + 설명 + 시작하기)
// ═══════════════════════════════════════════════════════════════════════
function OnbWelcome() {
  const A = AMATTA;

  return (
    <div style={{ ...{
        width: '100%', height: '100%',
        background: ONB_BG,
        color: A.ink, fontFamily: '"Pretendard", sans-serif',
        position: 'relative', overflow: 'hidden'
      }, background: "rgb(255, 255, 255)" }}>
      {/* ── Mascot + Copy — 세로 2/3 지점에 그룹 중심 정렬 ─── */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '66.67%',
        transform: 'translateY(calc(-50% - 100px))'
      }}>
        {/* Mascot row — 핑크 + 연두 나란히 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 0, position: 'relative'
        }}>
          {/* ── 발치에 깔리는 비정형 쟁반(블롭) — 오른쪽으로 기울어 주황이 발치에 닿게 ── */}
          <svg
            viewBox="0 0 280 120"
            width="270"
            height="116"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              transform: 'translate(calc(-50% + 6px), calc(-50% + 30px))',
              zIndex: 0,
              pointerEvents: 'none'
            }}>
            <path
              fill="#e0e446"
              d="M14,82 C24,76 70,72 130,66 C190,60 230,46 236,32 C256,22 288,42 282,68 C276,96 240,108 196,104 C146,100 92,98 50,98 C22,98 4,90 14,82 Z" />
          </svg>
          <img src="assets/mascot-pink.png" alt="" style={{
            objectFit: 'contain', width: "120px", height: "120px",
            position: 'relative', zIndex: 1
          }} />
          <img src="assets/mascot-orange.png" alt="주황이" style={{
            objectFit: 'contain', width: "130px", height: "130px",
            transform: 'translateY(-20px)',
            marginLeft: -20,
            position: 'relative', zIndex: 1
          }} />
        </div>

        {/* Copy block — 캐릭터 바로 아래 */}
        <div style={{
          textAlign: 'center', padding: "20px 28px 0px"
        }}>
          <div style={{
            fontWeight: 700,
            letterSpacing: -1, lineHeight: 1.1,
            color: A.ink,
            fontFamily: '"Pretendard", sans-serif', fontSize: "24px"
          }}>
            Welcome
          </div>
          <div style={{
            marginTop: 12,
            fontWeight: 400,
            lineHeight: 1.55, letterSpacing: -0.3, color: A.inkSub,
            fontFamily: '"Pretendard", sans-serif', fontSize: "14px"
          }}>
            아마따와 함께 여러 자녀의<br />
            일정과 준비물을 관리해보세요.
          </div>
        </div>

        {/* CTA — 본문에서 40px gap */}
        <div style={{
          marginTop: 40, padding: '0 16px', boxSizing: 'border-box'
        }}>
          <PrimaryCTA bg="#1d1d1b" onClick={() => {window.location.href = 'Onboarding - Add Kid.html';}}>
            시작하기
          </PrimaryCTA>
        </div>
      </div>
    </div>);

}

// ── Shared CTA primitives — match settings · reset-sheet button spec ────
// (padding 14×16, radius 14, ink fill, 15/600)
function PrimaryCTA({ children, onClick, disabled, bg }) {
  const A = AMATTA;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '14px 16px', borderRadius: 99,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'rgba(29,29,27,0.18)' : bg || 'rgb(255, 113, 68)',
        color: '#fff',
        fontSize: 15, fontWeight: 600, letterSpacing: -0.3,
        fontFamily: '"Pretendard", sans-serif',
        transition: 'background .15s'
      }}>
      {children}</button>);

}

function GhostCTA({ children, onClick, disabled }) {
  const A = AMATTA;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '14px 16px', borderRadius: 99,
        border: 'none',
        background: A.ink04,
        color: disabled ? A.ink30 : A.ink,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 15, fontWeight: 500, letterSpacing: -0.3,
        fontFamily: '"Pretendard", sans-serif',
        transition: 'background .15s'
      }}>
      {children}</button>);

}

// ═══════════════════════════════════════════════════════════════════════
// SCENE 2+ — Add Kid (multi-step, in-memory)
// ═══════════════════════════════════════════════════════════════════════
const STEP_LABELS = ['첫째', '둘째', '셋째', '넷째'];

function OnbAddKid() {
  const A = AMATTA;

  // Registered kids accumulated in-memory across steps
  const [registered, setRegistered] = React.useState([]);

  // Current form values (palette is auto-assigned in canonical order)
  const [name, setName] = React.useState('');
  const [avatar, setAvatar] = React.useState('face-wink');

  const stepIdx = registered.length;
  const stepNum = stepIdx + 1;
  const isFirst = stepIdx === 0;
  const atLast = stepNum >= ONB_MAX_KIDS;

  const usedPalettes = registered.map((r) => r.palette);
  const palette = ONB_PALETTES.find((p) => !usedPalettes.includes(p)) || ONB_PALETTES[0];

  const canSubmit = name.trim().length > 0;
  const previewKid = {
    id: `new-${stepIdx}`,
    name: name || '이름',
    grade: '', age: 0,
    palette, avatar
  };

  const commitCurrent = () => {
    const newKid = {
      id: `onb-${stepIdx}`,
      name: name.trim(),
      grade: '', age: 0,
      palette, avatar
    };
    return [...registered, newKid];
  };

  const handleDone = () => {
    if (!canSubmit) return;
    commitCurrent();
    // Demo: jump into the daily (day) view as the home screen
    window.location.href = 'Daily View B.html';
  };

  const handleAddAnother = () => {
    if (!canSubmit) return;
    setRegistered(commitCurrent());
    setName('');
    setAvatar('face-wink');
  };

  const handleBack = () => {
    if (isFirst) {
      window.location.href = 'Onboarding - Welcome.html';
    } else {
      const last = registered[registered.length - 1];
      setRegistered(registered.slice(0, -1));
      setName(last.name);
      setAvatar(last.avatar);
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%', background: '#fff',
      display: 'flex', flexDirection: 'column',
      color: A.ink, fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54
    }}>
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', padding: '4px 14px 6px'
      }}>
        <button
          onClick={handleBack}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '6px 4px', display: 'inline-flex', alignItems: 'center',
            color: A.ink, justifySelf: 'start'
          }}>
          
          <Icon.chevL size={22} stroke={A.ink} />
        </button>
        <div style={{
          fontSize: 13, fontWeight: 500, letterSpacing: 0,
          color: A.inkSub, fontFamily: '"Geist", "Pretendard", sans-serif',
          whiteSpace: 'nowrap'
        }}>
          {stepNum} <span style={{ color: A.ink30 }}>/</span> {ONB_MAX_KIDS}
        </div>
        <div />
      </div>

      {/* ── Scrollable body ───────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 22px 24px' }}>
        {/* Title — iOS Large Title scale (22/700), matches existing system */}
        <div style={{
          fontSize: 22, fontWeight: 700, letterSpacing: -0.5,
          lineHeight: 1.3, color: A.ink, marginTop: 6
        }}>
          {isFirst ? '자녀를 알려주세요' : `${STEP_LABELS[stepIdx]}도 알려주세요`}
        </div>
        <div style={{
          marginTop: 6, fontSize: 13, fontWeight: 400, color: A.inkSub,
          letterSpacing: -0.2, lineHeight: 1.5
        }}>
          {isFirst ?
          '언제든 설정에서 추가할 수 있어요 (최대 4명).' :
          '건너뛰고 나중에 추가할 수 있어요.'}
        </div>

        {/* Registered chips — appear from 둘째 onward */}
        {registered.length > 0 &&
        <div style={{
          marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6,
          alignItems: 'center'
        }}>
            <div style={{
            fontSize: 11, fontWeight: 500, color: A.inkSub,
            letterSpacing: 0.2, marginRight: 2
          }}>등록 완료</div>
            {registered.map((k) =>
          <RegisteredChip key={k.id} kid={k} A={A} />
          )}
          </div>
        }

        {/* ── Hero preview ───────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: '24px 0 8px'
        }}>
          <div style={{
            width: 132, height: 132, borderRadius: 99,
            background: A.ink04,
            display: 'grid', placeItems: 'center'
          }}>
            <AvatarPH kid={previewKid} size={102} />
          </div>
        </div>

        {/* ── 이름 ───────────────────────────────────────── */}
        <FieldLabel A={A}>이름</FieldLabel>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="자녀 이름"
          maxLength={10}
          autoFocus={isFirst}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: 'none', outline: 'none',
            background: A.ink04, borderRadius: 14,
            padding: '14px 16px',
            fontSize: 15, fontWeight: 500, color: A.ink,
            letterSpacing: -0.3,
            fontFamily: '"Pretendard", sans-serif'
          }} />
        

        {/* ── 아바타 ─────────────────────────────────────── */}
        <FieldLabel A={A}>아바타</FieldLabel>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6
        }}>
          {ONB_AVATARS.map((a) => {
            const active = a === avatar;
            const swatchKid = { ...previewKid, avatar: a };
            return (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                style={{
                  border: 'none',
                  background: active ? A.ink12 : A.ink04,
                  borderRadius: 14, cursor: 'pointer',
                  padding: '12px 0', display: 'grid', placeItems: 'center',
                  position: 'relative',
                  boxShadow: active ? `inset 0 0 0 2px ${A.ink}` : 'none',
                  transition: 'all .15s ease'
                }}>
                
                <AvatarPH kid={swatchKid} size={48} />
                {active &&
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 16, height: 16, borderRadius: 99,
                  background: A.ink, color: '#fff',
                  display: 'grid', placeItems: 'center'
                }}>
                    <Icon.check size={10} stroke="#fff" />
                  </div>
                }
              </button>);

          })}
        </div>
      </div>

      {/* ── Bottom CTAs — 2줄 스택 (완료 위, 자녀 추가 아래) ── */}
      <div style={{
        padding: '12px 16px 22px',
        display: 'flex', flexDirection: 'column', gap: 8
      }}>
        <PrimaryCTA bg="#1d1d1b" onClick={handleDone} disabled={!canSubmit}>완료</PrimaryCTA>
        {!atLast &&
        <GhostCTA onClick={handleAddAnother} disabled={!canSubmit}>
          + 자녀 추가
        </GhostCTA>
        }
      </div>
    </div>);

}

// ── Small bits ────────────────────────────────────────────────────────
function FieldLabel({ children, A }) {
  return (
    <div style={{
      padding: '20px 2px 8px',
      fontSize: 13, fontWeight: 400, letterSpacing: -0.2,
      color: A.inkSub,
      fontFamily: '"Pretendard", sans-serif'
    }}>{children}</div>);

}

function RegisteredChip({ kid, A }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px 4px 4px', borderRadius: 99,
      background: A.ink04, color: A.ink,
      fontSize: 12, fontWeight: 600, letterSpacing: -0.2,
      fontFamily: '"Pretendard", sans-serif'
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 99,
        background: '#fff', display: 'grid', placeItems: 'center',
        overflow: 'hidden'
      }}>
        <AvatarPH kid={kid} size={20} />
      </span>
      <span>{kid.name}</span>
    </div>);

}

Object.assign(window, { OnbWelcome, OnbAddKid });