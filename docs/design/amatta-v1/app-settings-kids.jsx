// app-settings-kids.jsx — 자녀 관리 (리스트 + 추가/편집)
// Two screens, each pushed as a separate HTML file:
//   - KidsList  : Settings - Kids.html
//   - KidEdit   : Settings - Kid Edit.html?id=<kidId>  (or no id = 추가)
//
// Fields stored per kid (per user spec): name, palette, avatar.
// Grade/age are kept on the data object but NOT edited in this UI — they
// stay constant on the existing demo dataset.

const MAX_KIDS = 4;

const AVATARS_AVAILABLE = ['face-wink', 'face-dizzy', 'face-cool', 'face-sleep', 'face-surprise', 'face-calm']; // 6개 — face-happy(주황) 제외 (DS §10 Q7)
const PALETTE_KEYS = ['peach', 'mint', 'sky', 'butter'];
const PALETTE_LABEL = { peach: '피치', mint: '민트', sky: '스카이', butter: '버터' };

// ── Avatar preview that respects palette (for non-PNG silhouettes too) ──
function KidPreview({ kid, size = 28 }) {
  return <AvatarPH kid={kid} size={size} />;
}

// ═══════════════════════════════════════════════════════════════════════
// SCREEN 1 — Kids List
// ═══════════════════════════════════════════════════════════════════════
function KidsList({ onBack, primary: primaryProp }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;

  // For the demo we read from the static KIDS array. In production this
  // would be local-storage backed and editable in place.
  const kids = KIDS;
  const atLimit = kids.length >= MAX_KIDS;

  return (
    <div style={{
      width: '100%', height: '100%', background: '#F7F6F5',
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54
    }}>
      <DetailTopBar
        title="자녀 관리"
        onBack={onBack}
        rightLabel={atLimit ? null : "추가"}
        onRight={() => { window.location.href = 'Settings - Kid Edit.html'; }}
        primary={primary}
        A={A}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 120px' }}>
        <SectionHeader label={`총 ${kids.length}명 / ${MAX_KIDS}명`} A={A} />
        <Card>
          {kids.map((k, i) => (
            <React.Fragment key={k.id}>
              {i > 0 && <Divider A={A} />}
              <KidRow
                kid={k}
                onClick={() => { window.location.href = `Settings - Kid Edit.html?id=${k.id}`; }}
                A={A}
              />
            </React.Fragment>
          ))}
        </Card>

        {/* Standalone '추가' card — hidden when at the 4-kid cap */}
        {!atLimit && (
          <AddKidCard
            onClick={() => { window.location.href = 'Settings - Kid Edit.html'; }}
            A={A}
          />
        )}
      </div>

      <BottomDockSettings primary={primary} A={A} />
    </div>
  );
}

function KidRow({ kid, onClick, A }) {
  const pal = KID_PALETTE[kid.palette];
  return (
    <RowFrame onClick={onClick}>
      {/* Avatar with palette ring */}
      <div style={{
        width: 36, height: 36, borderRadius: 99,
        background: pal.bg, display: 'grid', placeItems: 'center',
        flex: '0 0 auto'
      }}>
        <AvatarPH kid={kid} size={26} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          fontSize: 14, fontWeight: 400, color: A.ink,
          letterSpacing: -0.3, lineHeight: 1.25,
          fontFamily: '"Pretendard", sans-serif'
        }}>
          {kid.name}
        </div>
      </div>

      <ChevR A={A} />
    </RowFrame>
  );
}

function AddKidCard({ onClick, A }) {
  return (
    <div
      onClick={onClick}
      style={{
        marginTop: 8,
        background: '#fff', borderRadius: 18,
        padding: 6, cursor: 'pointer',
        transition: 'background .12s'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFAF9'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
    >
      <RowFrame onClick={() => {}}>
        <div style={{
          width: 36, height: 36, borderRadius: 99,
          border: `1.5px dashed ${A.ink30}`, boxSizing: 'border-box',
          display: 'grid', placeItems: 'center', flex: '0 0 auto'
        }}>
          <Icon.plus size={18} stroke={A.ink50} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 400, color: A.ink,
            letterSpacing: -0.3, lineHeight: 1.25,
            fontFamily: '"Pretendard", sans-serif'
          }}>자녀 추가</div>
          <div style={{
            marginTop: 2, fontSize: 12, fontWeight: 400,
            color: A.inkSub, letterSpacing: -0.1, lineHeight: 1.3,
            fontFamily: '"Pretendard", sans-serif'
          }}>새 자녀를 등록하고 색상을 지정하세요</div>
        </div>
        <ChevR A={A} />
      </RowFrame>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SCREEN 2 — Kid Edit (add or edit)
// ═══════════════════════════════════════════════════════════════════════
function KidEdit({ kidId, onBack, primary: primaryProp }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;
  const isNew = !kidId;
  const existing = kidId ? KIDS.find((k) => k.id === kidId) : null;

  // Hard guard: even if URL is hit directly, redirect back when at the cap
  React.useEffect(() => {
    if (isNew && KIDS.length >= MAX_KIDS) {
      window.location.href = 'Settings - Kids.html';
    }
  }, [isNew]);

  const [name, setName] = React.useState(existing ? existing.name : '');
  const [avatar, setAvatar] = React.useState(existing ? existing.avatar : 'face-wink');
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Preview kid — PNG avatars carry their own color, so only avatar key
  // matters here. Palette is inherited from existing data (not editable).
  const previewKid = {
    id: existing?.id || 'new',
    name: name || '자녀',
    grade: existing?.grade || '',
    age: existing?.age || 0,
    palette: existing?.palette || 'peach',
    avatar: avatar
  };

  const handleSave = () => {
    // Demo only — would persist to local storage in production
    window.location.href = 'Settings - Kids.html';
  };
  const handleDelete = () => {
    window.location.href = 'Settings - Kids.html';
  };

  return (
    <div style={{
      width: '100%', height: '100%', background: '#F7F6F5',
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54
    }}>
      <DetailTopBar
        title={isNew ? '자녀 추가' : '자녀 편집'}
        onBack={onBack}
        rightLabel="저장"
        onRight={handleSave}
        rightActive={name.trim().length > 0}
        primary={primary}
        A={A}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 120px' }}>
        {/* ── Hero — large avatar preview ───────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '4px 0 10px'
        }}>
          <div style={{
            width: 140, height: 140, borderRadius: 99,
            background: '#fff', display: 'grid', placeItems: 'center'
          }}>
            <AvatarPH kid={previewKid} size={108} />
          </div>
          <div style={{
            marginTop: 8, fontSize: 11, fontWeight: 400,
            color: A.inkSub, letterSpacing: 0.4,
            fontFamily: '"Geist", "Pretendard", sans-serif',
            textTransform: 'uppercase'
          }}>PREVIEW</div>
        </div>

        {/* ── 이름 ──────────────────────────────────────────────── */}
        <SectionHeader label="이름" A={A} />
        <Card>
          <div style={{ padding: '2px 10px' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="자녀 이름"
              maxLength={10}
              style={{
                width: '100%', border: 'none', outline: 'none',
                background: 'transparent',
                fontSize: 15, fontWeight: 400, color: A.ink,
                letterSpacing: -0.3, padding: '8px 0',
                fontFamily: '"Pretendard", sans-serif'
              }}
            />
          </div>
        </Card>

        {/* ── 아바타 ────────────────────────────────────────────── */}
        <SectionHeader label="아바타" A={A} />
        <Card>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6, padding: 4
          }}>
            {AVATARS_AVAILABLE.map((a) => {
              const active = a === avatar;
              const swatchKid = { ...previewKid, avatar: a };
              return (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  style={{
                    border: 'none', background: active ? '#fff' : A.ink04,
                    borderRadius: 14, cursor: 'pointer',
                    padding: '14px 0', display: 'grid', placeItems: 'center',
                    position: 'relative',
                    boxShadow: active ? `inset 0 0 0 2px ${A.ink}` : 'none',
                    transition: 'all .15s ease'
                  }}
                >
                  <AvatarPH kid={swatchKid} size={56} />
                  {active && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 18, height: 18, borderRadius: 99,
                      background: A.ink, color: '#fff',
                      display: 'grid', placeItems: 'center'
                    }}>
                      <Icon.check size={11} stroke="#fff" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

{/* ── 삭제 (편집 모드일 때만) ────────────────────────────── */}
        {!isNew && (
          <React.Fragment>
            <div style={{ height: 16 }} />
            <Card>
              <DestructiveRow
                label={`${existing?.name || '자녀'} 삭제`}
                sub="이 자녀의 일정과 준비물도 모두 삭제돼요"
                onClick={() => setShowDeleteConfirm(true)}
                A={A}
              />
            </Card>
          </React.Fragment>
        )}
      </div>

      {showDeleteConfirm && (
        <KidDeleteConfirmSheet
          name={existing?.name || '자녀'}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          A={A}
        />
      )}
    </div>
  );
}

// ── Delete confirm — same shape as ResetConfirmSheet but kid-specific ──
function KidDeleteConfirmSheet({ name, onCancel, onConfirm, A }) {
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
        }}>{name}을(를) 삭제할까요?</div>
        <div style={{
          fontSize: 13, fontWeight: 400, color: A.inkSub,
          letterSpacing: -0.2, lineHeight: 1.5,
          fontFamily: '"Pretendard", sans-serif',
          marginBottom: 18
        }}>{name}의 일정·준비물·할일이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onConfirm} style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: A.danger, color: '#fff',
            fontSize: 15, fontWeight: 600, letterSpacing: -0.3,
            fontFamily: '"Pretendard", sans-serif'
          }}>삭제하기</button>
          <button onClick={onCancel} style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: A.ink04, color: A.ink,
            fontSize: 15, fontWeight: 500, letterSpacing: -0.3,
            fontFamily: '"Pretendard", sans-serif'
          }}>취소</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Shared detail top bar — back + title + optional right action
// Used by all settings detail screens (kids/export/import/legal).
// ═══════════════════════════════════════════════════════════════════════
function DetailTopBar({ title, onBack, rightLabel, onRight, rightActive = true, primary, A }) {
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
        }}
      >
        <Icon.chevL size={22} stroke={A.ink} />
      </button>
      <div style={{
        fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
        color: A.ink, fontFamily: '"Pretendard", sans-serif'
      }}>{title}</div>
      <div style={{ justifySelf: 'end' }}>
        {rightLabel && (
          <button
            onClick={rightActive ? onRight : undefined}
            disabled={!rightActive}
            style={{
              border: 'none', background: 'transparent',
              cursor: rightActive ? 'pointer' : 'default',
              padding: '6px 4px',
              color: rightActive ? (primary || A.primary) : A.ink30,
              fontSize: 15, fontWeight: 600, letterSpacing: -0.3,
              fontFamily: '"Pretendard", sans-serif'
            }}
          >{rightLabel}</button>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { KidsList, KidEdit, DetailTopBar });
