// app-settings-data.jsx — JSON 내보내기 / 가져오기 디테일 화면
// Two screens:
//   - JsonExport : Settings - Export.html  (summary → 내보내기 → 공유 시트)
//   - JsonImport : Settings - Import.html  (파일 선택 → 미리보기 → 적용 방식)

// ═══════════════════════════════════════════════════════════════════════
// SCREEN — JSON 내보내기
// ═══════════════════════════════════════════════════════════════════════
function JsonExport({ onBack, primary: primaryProp }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;

  // Aggregated counts from the demo data
  const kidCount = KIDS.length;
  const eventCount = Object.values(SCHEDULE).reduce((s, list) => s + list.length, 0);
  const supplyCount = TODOS.length;
  const taskCount = TASKS.length;
  const totalCount = eventCount + supplyCount + taskCount;

  const [scope, setScope] = React.useState('all'); // 'all' | 'kid'
  const [includeDone, setIncludeDone] = React.useState(true);
  const [includeCancelled, setIncludeCancelled] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);

  // Mock filename
  const now = new Date(2026, 4, 20); // KST 5/20/2026
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `amatta-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
  const sizeKb = Math.round((totalCount * 0.4 + 1.2) * 10) / 10;

  return (
    <div style={{
      width: '100%', height: '100%', background: '#F7F6F5',
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54
    }}>
      <DetailTopBar
        title="JSON 내보내기"
        onBack={onBack}
        primary={primary}
        A={A}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 120px' }}>

        {/* Hero — file card */}
        <div style={{
          background: '#fff', borderRadius: 18,
          padding: '20px 18px', marginTop: 4, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 14
        }}>
          <FileIcon primary={primary} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 400, color: A.ink,
              letterSpacing: -0.2, lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: '"Geist", "Pretendard", sans-serif'
            }}>{filename}</div>
            <div style={{
              marginTop: 4, fontSize: 11, fontWeight: 400,
              color: A.inkSub, letterSpacing: -0.1,
              fontFamily: '"Pretendard", sans-serif'
            }}>약 {sizeKb} KB · JSON</div>
          </div>
        </div>

        {/* 내보낼 정보 */}
        <SectionHeader label="내보낼 정보" A={A} />
        <Card>
          <CountRow label="자녀" count={kidCount} unit="명" A={A} />
          <Divider A={A} />
          <CountRow label="일정" count={eventCount} unit="건" A={A} />
          <Divider A={A} />
          <CountRow label="준비물" count={supplyCount} unit="건" A={A} />
          <Divider A={A} />
          <CountRow label="할일" count={taskCount} unit="건" A={A} />
        </Card>

        {/* 옵션 */}
        <SectionHeader label="옵션" A={A} />
        <Card>
          <ToggleRow
            label="완료된 항목 포함"
            sub="체크된 준비물·할일도 함께 내보내요"
            checked={includeDone}
            onChange={setIncludeDone}
            primary={primary}
            A={A}
          />
          <Divider A={A} />
          <ToggleRow
            label="취소된 일정 포함"
            sub="취소·삭제된 일정도 백업"
            checked={includeCancelled}
            onChange={setIncludeCancelled}
            primary={primary}
            A={A}
          />
        </Card>

        <div style={{
          padding: '14px 6px 0', fontSize: 12, color: A.inkSub,
          lineHeight: 1.5, letterSpacing: -0.2
        }}>
          내보낸 JSON 파일은 다른 기기의 아마따에서 가져오기로 복원하거나, 백업용으로 보관할 수 있어요.
        </div>
      </div>

      {/* Bottom action — fixed CTA */}
      <FixedCTA
        label="내보내기"
        onClick={() => setShareOpen(true)}
        primary={primary}
      />

      {shareOpen && (
        <ShareSheet
          filename={filename}
          sizeKb={sizeKb}
          onClose={() => setShareOpen(false)}
          A={A}
        />
      )}
    </div>
  );
}

function CountRow({ label, count, unit, A }) {
  return (
    <RowFrame>
      <RowText label={label} A={A} />
      <div style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 3,
        fontFamily: '"Geist", "Pretendard", sans-serif'
      }}>
        <span style={{ fontSize: 16, fontWeight: 500, color: A.ink, letterSpacing: -0.2 }}>{count}</span>
        <span style={{ fontSize: 11, fontWeight: 400, color: A.inkSub, fontFamily: '"Pretendard", sans-serif' }}>{unit}</span>
      </div>
    </RowFrame>
  );
}

function FileIcon({ primary }) {
  return (
    <div style={{
      width: 48, height: 56, borderRadius: 6,
      background: '#FFF', border: `1.5px solid ${primary}`,
      position: 'relative', flex: '0 0 auto',
      display: 'flex', flexDirection: 'column',
      alignItems: 'stretch', overflow: 'hidden'
    }}>
      {/* folded corner */}
      <div style={{
        position: 'absolute', top: -1, right: -1,
        width: 14, height: 14,
        background: `linear-gradient(225deg, ${primary} 0 50%, transparent 50%)`,
        borderBottomLeftRadius: 4
      }} />
      <div style={{
        marginTop: 'auto', textAlign: 'center',
        background: primary, color: '#fff',
        fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
        padding: '3px 0',
        fontFamily: '"Geist", "Pretendard", sans-serif'
      }}>JSON</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Mock iOS share sheet
// ═══════════════════════════════════════════════════════════════════════
function ShareSheet({ filename, sizeKb, onClose, A }) {
  const apps = [
    { id: 'airdrop', label: 'AirDrop', color: '#0EA5E9' },
    { id: 'messages', label: '메시지', color: '#22C55E' },
    { id: 'mail', label: '메일', color: '#3B82F6' },
    { id: 'drive', label: '드라이브', color: '#FBBF24' },
    { id: 'notes', label: '메모', color: '#F59E0B' },
    { id: 'files', label: '파일에 저장', color: '#60A5FA' }
  ];
  const actions = [
    { id: 'copy', label: '복사' },
    { id: 'save', label: '파일에 저장' },
    { id: 'print', label: '프린트' }
  ];
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(29,29,27,0.45)', backdropFilter: 'blur(3px)'
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#F1EFEC', borderTopLeftRadius: 14, borderTopRightRadius: 14,
        padding: '14px 14px 28px',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.2)'
      }}>
        {/* File header */}
        <div style={{
          background: '#fff', borderRadius: 12,
          padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 12
        }}>
          <FileIcon primary={AMATTA.primary} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 400, color: A.ink,
              letterSpacing: -0.2, lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: '"Geist", "Pretendard", sans-serif'
            }}>{filename}</div>
            <div style={{
              marginTop: 3, fontSize: 11, color: A.inkSub
            }}>{sizeKb} KB · JSON</div>
          </div>
        </div>

        {/* App row */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '14px 4px',
          marginBottom: 12, overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex', overflowX: 'auto', gap: 6, padding: '0 10px',
            scrollbarWidth: 'none'
          }}>
            {apps.map((a) => (
              <div key={a.id} style={{
                flex: '0 0 auto', width: 64,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 6
              }}>
                <div style={{
                  width: 54, height: 54, borderRadius: 12,
                  background: a.color,
                  display: 'grid', placeItems: 'center',
                  color: '#fff', fontSize: 22, fontWeight: 700,
                  fontFamily: '"Geist", sans-serif'
                }}>{a.label[0]}</div>
                <div style={{
                  fontSize: 10, color: A.ink, textAlign: 'center',
                  letterSpacing: -0.1, lineHeight: 1.2
                }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Action rows */}
        <div style={{
          background: '#fff', borderRadius: 12, overflow: 'hidden',
          marginBottom: 16
        }}>
          {actions.map((act, i) => (
            <React.Fragment key={act.id}>
              {i > 0 && <div style={{ borderTop: `1px solid ${A.ink04}` }} />}
              <button onClick={onClose} style={{
                width: '100%', padding: '14px 16px',
                background: '#fff', border: 'none', cursor: 'pointer',
                fontSize: 15, color: A.ink, textAlign: 'left',
                letterSpacing: -0.2, fontFamily: '"Pretendard", sans-serif'
              }}>{act.label}</button>
            </React.Fragment>
          ))}
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '14px 16px', borderRadius: 12,
          background: '#fff', border: 'none', cursor: 'pointer',
          fontSize: 16, fontWeight: 600, color: '#0EA5E9',
          letterSpacing: -0.2, fontFamily: '"Pretendard", sans-serif'
        }}>취소</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SCREEN — JSON 가져오기
// ═══════════════════════════════════════════════════════════════════════
function JsonImport({ onBack, primary: primaryProp }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;

  // Two states: no file picked → dropzone; picked → preview + apply mode
  const [picked, setPicked] = React.useState(null);
  const [applyMode, setApplyMode] = React.useState('overwrite'); // 'overwrite' | 'merge'
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const pickMock = () => {
    setPicked({
      name: 'amatta-20260512.json',
      sizeKb: 12.3,
      kids: 4,
      events: 14,
      supplies: 8,
      tasks: 4,
      exportedAt: '2026-05-12 21:08'
    });
  };

  return (
    <div style={{
      width: '100%', height: '100%', background: '#F7F6F5',
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54
    }}>
      <DetailTopBar
        title="JSON 가져오기"
        onBack={onBack}
        primary={primary}
        A={A}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 120px' }}>

        {!picked ? (
          <React.Fragment>
            {/* Dropzone */}
            <div
              onClick={pickMock}
              style={{
                marginTop: 8, padding: '36px 18px',
                background: '#fff', borderRadius: 18,
                border: `1.5px dashed ${A.ink30}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 12, cursor: 'pointer',
                transition: 'all .15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFAF9'; e.currentTarget.style.borderColor = primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = A.ink30; }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 99,
                background: A.ink04, display: 'grid', placeItems: 'center'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke={A.ink50} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M12 4l-5 5M12 4l5 5"/>
                  <path d="M4 20h16"/>
                </svg>
              </div>
              <div style={{
                fontSize: 15, fontWeight: 500, color: A.ink,
                letterSpacing: -0.3
              }}>파일 선택하기</div>
              <div style={{
                fontSize: 12, fontWeight: 400, color: A.inkSub,
                letterSpacing: -0.1, textAlign: 'center', lineHeight: 1.5
              }}>아마따 JSON 백업 파일만 가져올 수 있어요.<br/>탭해서 파일 앱에서 선택하세요.</div>
            </div>

            <SectionHeader label="안내" A={A} />
            <Card>
              <InfoBullet text="다른 기기에서 내보낸 아마따 JSON 파일이 필요해요." A={A} />
              <Divider A={A} />
              <InfoBullet text="가져오기 전 미리보기로 자녀·일정 수를 확인할 수 있어요." A={A} />
              <Divider A={A} />
              <InfoBullet text="덮어쓰기를 선택하면 현재 데이터는 모두 사라져요." A={A} />
            </Card>
          </React.Fragment>
        ) : (
          <React.Fragment>
            {/* Preview card */}
            <div style={{
              background: '#fff', borderRadius: 18,
              padding: '18px 16px', marginTop: 4, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 14
            }}>
              <FileIcon primary={primary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 400, color: A.ink,
                  letterSpacing: -0.2, lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: '"Geist", "Pretendard", sans-serif'
                }}>{picked.name}</div>
                <div style={{
                  marginTop: 3, fontSize: 11, fontWeight: 400,
                  color: A.inkSub, letterSpacing: -0.1
                }}>{picked.sizeKb} KB · {picked.exportedAt} 백업</div>
              </div>
              <button
                onClick={() => setPicked(null)}
                style={{
                  border: 'none', background: A.ink04, cursor: 'pointer',
                  width: 28, height: 28, borderRadius: 99,
                  display: 'grid', placeItems: 'center', flex: '0 0 auto'
                }}
              >
                <Icon.xMark size={14} stroke={A.ink} />
              </button>
            </div>

            <SectionHeader label="복원될 정보" A={A} />
            <Card>
              <CountRow label="자녀" count={picked.kids} unit="명" A={A} />
              <Divider A={A} />
              <CountRow label="일정" count={picked.events} unit="건" A={A} />
              <Divider A={A} />
              <CountRow label="준비물" count={picked.supplies} unit="건" A={A} />
              <Divider A={A} />
              <CountRow label="할일" count={picked.tasks} unit="건" A={A} />
            </Card>

            <SectionHeader label="적용 방식" A={A} />
            <Card>
              <RadioRow
                label="덮어쓰기"
                sub="현재 데이터는 모두 사라지고 백업으로 대체돼요"
                selected={applyMode === 'overwrite'}
                onClick={() => setApplyMode('overwrite')}
                primary={primary}
                A={A}
              />
              <Divider A={A} />
              <RadioRow
                label="병합"
                sub="중복되지 않는 항목만 현재 데이터에 추가돼요"
                selected={applyMode === 'merge'}
                onClick={() => setApplyMode('merge')}
                primary={primary}
                A={A}
              />
            </Card>

            <div style={{
              padding: '14px 6px 0', fontSize: 12, color: A.inkSub,
              lineHeight: 1.5, letterSpacing: -0.2
            }}>
              {applyMode === 'overwrite'
                ? '⚠️ 덮어쓰기는 되돌릴 수 없어요. 현재 데이터를 먼저 내보내기로 백업해두세요.'
                : '병합 시 동일한 ID의 항목은 백업 데이터로 갱신돼요.'}
            </div>
          </React.Fragment>
        )}
      </div>

      {picked && (
        <FixedCTA
          label="가져오기"
          onClick={() => setConfirmOpen(true)}
          primary={primary}
        />
      )}

      {confirmOpen && (
        <ImportConfirmSheet
          mode={applyMode}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => { window.location.href = 'Settings.html'; }}
          A={A}
        />
      )}
    </div>
  );
}

function InfoBullet({ text, A }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 10px', borderRadius: 12
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: 99,
        background: A.ink30, marginTop: 7, flex: '0 0 auto'
      }}/>
      <div style={{
        flex: 1, fontSize: 13, fontWeight: 400, color: A.ink,
        letterSpacing: -0.2, lineHeight: 1.5,
        fontFamily: '"Pretendard", sans-serif'
      }}>{text}</div>
    </div>
  );
}

function RadioRow({ label, sub, selected, onClick, primary, A }) {
  return (
    <RowFrame onClick={onClick}>
      <div style={{
        width: 22, height: 22, borderRadius: 99, boxSizing: 'border-box',
        background: selected ? primary : '#fff',
        border: selected ? `1.5px solid ${primary}` : `1.5px solid ${A.ink30}`,
        display: 'grid', placeItems: 'center', flex: '0 0 auto',
        transition: 'all .15s'
      }}>
        {selected && (
          <div style={{
            width: 8, height: 8, borderRadius: 99, background: '#fff'
          }} />
        )}
      </div>
      <RowText label={label} sub={sub} A={A} />
    </RowFrame>
  );
}

function ImportConfirmSheet({ mode, onCancel, onConfirm, A }) {
  const isOverwrite = mode === 'overwrite';
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
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
          color: A.ink, marginBottom: 6
        }}>{isOverwrite ? '데이터를 덮어쓸까요?' : '데이터를 병합할까요?'}</div>
        <div style={{
          fontSize: 13, fontWeight: 400, color: A.inkSub,
          letterSpacing: -0.2, lineHeight: 1.5, marginBottom: 18
        }}>
          {isOverwrite
            ? '현재 자녀·일정·할일이 모두 백업 파일의 내용으로 대체돼요. 이 작업은 되돌릴 수 없어요.'
            : '중복되지 않는 항목만 현재 데이터에 추가돼요. 기존 데이터는 유지돼요.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onConfirm} style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: isOverwrite ? A.danger : AMATTA.primary, color: '#fff',
            fontSize: 15, fontWeight: 600, letterSpacing: -0.3
          }}>{isOverwrite ? '덮어쓰기' : '병합하기'}</button>
          <button onClick={onCancel} style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: A.ink04, color: A.ink,
            fontSize: 15, fontWeight: 500, letterSpacing: -0.3
          }}>취소</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Shared fixed CTA — sits above the bottom dock area
// ═══════════════════════════════════════════════════════════════════════
function FixedCTA({ label, onClick, primary, disabled }) {
  const A = AMATTA;
  return (
    <div style={{
      position: 'absolute', left: 14, right: 14, bottom: 22, zIndex: 5,
      pointerEvents: 'none'
    }}>
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={{
          width: '100%', padding: '15px 16px', borderRadius: 99,
          border: 'none', cursor: disabled ? 'default' : 'pointer',
          background: disabled ? A.ink12 : (primary || A.primary),
          color: '#fff', fontSize: 15, fontWeight: 600,
          letterSpacing: -0.3,
          boxShadow: disabled ? 'none' : `0 10px 26px ${primary || A.primary}40, 0 2px 4px rgba(0,0,0,0.04)`,
          fontFamily: '"Pretendard", sans-serif',
          pointerEvents: 'auto',
          transition: 'all .15s'
        }}
      >{label}</button>
    </div>
  );
}

Object.assign(window, { JsonExport, JsonImport, FixedCTA });
