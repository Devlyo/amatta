// app-settings-legal.jsx — 개인정보처리방침 / 이용약관 (정적 스크롤 페이지)
// Long-form Korean legal text. The content is original boilerplate written
// for the demo (NOT copied from any real service's policy). It mirrors the
// shape of a typical Korean consumer-app policy so screenshots feel plausible.

function LegalPage({ title, sections, effectiveDate, onBack, primary: primaryProp }) {
  const A = AMATTA;
  const primary = primaryProp || A.primary;
  const [active, setActive] = React.useState(null); // index of section in viewport

  return (
    <div style={{
      width: '100%', height: '100%', background: '#F7F6F5',
      display: 'flex', flexDirection: 'column', color: A.ink,
      fontFamily: '"Pretendard", sans-serif',
      paddingTop: 54
    }}>
      <DetailTopBar title={title} onBack={onBack} primary={primary} A={A}/>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 60px' }}>
        {/* Hero */}
        <div style={{
          background: '#fff', borderRadius: 18,
          padding: '20px 18px', marginTop: 4, marginBottom: 14
        }}>
          <div style={{
            fontSize: 11, fontWeight: 400, color: A.inkSub,
            letterSpacing: 0.4, textTransform: 'uppercase',
            fontFamily: '"Geist", "Pretendard", sans-serif'
          }}>EFFECTIVE</div>
          <div style={{
            marginTop: 4, fontSize: 15, fontWeight: 500, color: A.ink,
            letterSpacing: -0.2, fontFamily: '"Pretendard", sans-serif'
          }}>{effectiveDate}</div>
          <div style={{
            marginTop: 12, fontSize: 13, fontWeight: 400, color: A.inkSub,
            lineHeight: 1.6, letterSpacing: -0.2,
            fontFamily: '"Pretendard", sans-serif'
          }}>
            아마따(이하 “회사”)는 사용자가 안심하고 서비스를 이용하실 수 있도록 본 {title}을(를) 마련하고 있습니다. 본 문서는 회사가 사용자의 정보를 어떻게 다루는지, 그리고 사용자와 회사가 서로 약속하는 내용에 대해 설명합니다.
          </div>
        </div>

        {/* 목차 */}
        <SectionHeader label="목차" A={A}/>
        <Card>
          {sections.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Divider A={A}/>}
              <button
                onClick={() => {
                  const el = document.getElementById(`legal-sec-${i}`);
                  if (el) {
                    const container = el.closest('[data-legal-scroll]');
                    if (container) {
                      container.scrollTo({ top: el.offsetTop - 60, behavior: 'smooth' });
                    }
                  }
                }}
                style={{
                  width: '100%', border: 'none', background: 'transparent',
                  cursor: 'pointer', padding: '10px 10px', borderRadius: 12,
                  display: 'flex', alignItems: 'center', gap: 10,
                  textAlign: 'left',
                  fontFamily: '"Pretendard", sans-serif',
                  transition: 'background .12s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = A.ink04; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 99,
                  background: A.ink04, color: A.inkSub,
                  display: 'grid', placeItems: 'center',
                  fontSize: 11, fontWeight: 500, flex: '0 0 auto',
                  fontFamily: '"Geist", sans-serif'
                }}>{i + 1}</div>
                <div style={{
                  flex: 1, fontSize: 13, fontWeight: 400, color: A.ink,
                  letterSpacing: -0.2
                }}>{s.title}</div>
                <ChevR A={A}/>
              </button>
            </React.Fragment>
          ))}
        </Card>

        {/* Body — sections rendered as cards */}
        <div data-legal-scroll style={{ contain: 'paint' }}>
          {sections.map((s, i) => (
            <React.Fragment key={i}>
              <div id={`legal-sec-${i}`}>
                <SectionHeader label={`${i + 1}. ${s.title}`} A={A}/>
              </div>
              <Card>
                <div style={{ padding: '12px 14px' }}>
                  {s.paragraphs.map((p, j) => (
                    <p key={j} style={{
                      margin: j === 0 ? 0 : '12px 0 0',
                      fontSize: 13, fontWeight: 400, color: A.ink,
                      lineHeight: 1.65, letterSpacing: -0.2,
                      fontFamily: '"Pretendard", sans-serif'
                    }}>{p}</p>
                  ))}
                  {s.bullets && (
                    <ul style={{
                      margin: '10px 0 0', padding: 0, listStyle: 'none'
                    }}>
                      {s.bullets.map((b, j) => (
                        <li key={j} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '4px 0',
                          fontSize: 13, fontWeight: 400, color: A.ink,
                          lineHeight: 1.55, letterSpacing: -0.2,
                          fontFamily: '"Pretendard", sans-serif'
                        }}>
                          <span style={{
                            width: 4, height: 4, borderRadius: 99,
                            background: A.ink30, marginTop: 9, flex: '0 0 auto'
                          }}/>
                          <span style={{ flex: 1 }}>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </React.Fragment>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 6px 8px', fontSize: 11, color: A.ink30,
          textAlign: 'center', letterSpacing: 0.3,
          fontFamily: '"Geist", "Pretendard", sans-serif'
        }}>
          아마따 v1.0.0 · {effectiveDate} 기준
        </div>
      </div>
    </div>
  );
}

// ─── 개인정보처리방침 본문 ─────────────────────────────────────────────
const PRIVACY_SECTIONS = [
  {
    title: '수집하는 정보',
    paragraphs: [
      '회사는 서비스 제공을 위해 사용자가 직접 입력한 최소한의 정보만 기기 내부에 저장합니다. 별도의 회원가입은 요구하지 않으며, 입력하신 정보는 외부 서버로 전송되지 않습니다.'
    ],
    bullets: [
      '자녀 정보: 이름, 학년, 나이, 선택한 아바타 및 테마 색상',
      '일정 정보: 제목, 시간, 장소, 카테고리, 픽업 여부',
      '준비물·할일 정보: 제목, 마감 시점, 완료 여부',
      '앱 설정: 알림 활성화 여부, 기본 알림 시점, 표시 옵션'
    ]
  },
  {
    title: '정보의 저장 위치',
    paragraphs: [
      '입력하신 모든 정보는 사용자의 기기 내부 저장소에만 보관됩니다. 회사는 사용자의 데이터를 별도 서버에 저장하거나, 제3자에게 전송하지 않습니다.',
      'JSON 내보내기 기능을 사용하실 경우 백업 파일이 생성되며, 해당 파일을 어디에 보관할지는 사용자가 직접 결정하실 수 있습니다.'
    ]
  },
  {
    title: '정보의 이용 목적',
    paragraphs: [
      '수집된 정보는 아래의 목적으로만 사용되며, 명시한 범위를 벗어나는 용도로는 이용되지 않습니다.'
    ],
    bullets: [
      '일간뷰·주간뷰 화면 구성 및 자녀별 색상 표시',
      '예정된 일정 및 픽업에 대한 사전 알림 발송',
      '준비물·할일의 완료 상태 추적',
      '사용자 본인이 요청하신 백업 및 복원'
    ]
  },
  {
    title: '정보의 보관 기간',
    paragraphs: [
      '사용자가 직접 항목을 삭제하시거나 “모든 데이터 초기화” 기능을 사용하시기 전까지 정보는 기기 내부에 보관됩니다. 앱을 삭제하실 경우 모든 데이터는 즉시 함께 제거되며, 회사는 별도의 사본을 보유하지 않습니다.'
    ]
  },
  {
    title: '제3자 제공',
    paragraphs: [
      '회사는 사용자의 정보를 어떠한 경우에도 제3자에게 제공하거나 위탁하지 않습니다. 다만 법령에 따라 수사기관의 적법한 요청이 있는 경우에는 협조할 수 있으며, 이때에도 그 사유와 범위를 가능한 한 사용자에게 안내합니다.'
    ]
  },
  {
    title: '사용자의 권리',
    paragraphs: [
      '사용자는 언제든지 다음의 권리를 행사하실 수 있습니다. 모든 작업은 별도의 신청 없이 앱 내에서 직접 수행 가능합니다.'
    ],
    bullets: [
      '저장된 정보의 열람 및 수정',
      '특정 항목의 삭제 또는 전체 초기화',
      '백업 파일을 통한 정보의 이동',
      '알림 동의의 철회'
    ]
  },
  {
    title: '아동의 개인정보',
    paragraphs: [
      '아마따는 자녀의 일정을 관리하는 보호자를 위한 도구로서, 자녀 본인이 직접 사용하는 것을 전제로 설계되지 않았습니다. 보호자가 입력하신 자녀 정보는 보호자의 책임 하에 관리되며, 회사는 해당 정보를 외부와 공유하지 않습니다.'
    ]
  },
  {
    title: '문의처',
    paragraphs: [
      '본 방침에 관한 문의 사항이 있으시면 아래로 연락해 주세요. 회사는 합리적인 시간 내에 성실히 답변드리겠습니다.'
    ],
    bullets: [
      '이메일: privacy@amatta.app',
      '응답 시간: 영업일 기준 3일 이내'
    ]
  },
  {
    title: '방침의 변경',
    paragraphs: [
      '본 방침은 법령·서비스 변경에 따라 수정될 수 있으며, 중요한 변경이 있는 경우 앱 내 공지 또는 알림을 통해 사전에 안내합니다. 사용자가 변경된 방침에 동의하지 않으실 경우 서비스 이용을 중단하실 수 있습니다.'
    ]
  }
];

const TERMS_SECTIONS = [
  {
    title: '서비스의 목적',
    paragraphs: [
      '본 약관은 사용자가 아마따(이하 “서비스”)를 이용함에 있어 회사와 사용자 사이의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다. 서비스를 이용하심으로써 사용자는 본 약관에 동의한 것으로 간주됩니다.'
    ]
  },
  {
    title: '용어의 정의',
    paragraphs: [
      '본 약관에서 사용하는 용어의 정의는 다음과 같습니다.'
    ],
    bullets: [
      '“서비스”란 아마따라는 이름으로 제공되는 모든 기능과 콘텐츠를 의미합니다.',
      '“사용자”란 서비스를 설치하고 이용하는 자를 말합니다.',
      '“자녀”란 사용자가 서비스 내에 등록한 보호 대상을 의미합니다.',
      '“콘텐츠”란 사용자가 입력한 일정·준비물·할일·메모 등 모든 데이터를 포함합니다.'
    ]
  },
  {
    title: '서비스의 제공',
    paragraphs: [
      '회사는 서비스를 안정적으로 제공하기 위해 노력합니다. 다만 다음의 경우 서비스 제공이 일시적으로 중단될 수 있으며, 회사는 이를 사전 또는 사후에 안내합니다.'
    ],
    bullets: [
      '시스템 점검, 보수, 교체 등 운영상 필요한 경우',
      '천재지변, 정전, 통신망 장애 등 불가항력적 사유',
      '서비스의 중대한 결함이 발견되어 긴급 조치가 필요한 경우'
    ]
  },
  {
    title: '사용자의 의무',
    paragraphs: [
      '사용자는 서비스를 선량한 관리자로서 이용해야 하며, 다음 행위를 하여서는 안 됩니다.'
    ],
    bullets: [
      '본인 또는 타인의 정보를 허위로 입력하는 행위',
      '서비스의 운영을 방해하거나 안정성을 해치는 행위',
      '관련 법령 또는 미풍양속에 반하는 콘텐츠를 저장하는 행위',
      '서비스를 상업적으로 이용하거나 무단으로 복제·배포하는 행위'
    ]
  },
  {
    title: '회사의 의무',
    paragraphs: [
      '회사는 본 약관 및 관련 법령을 준수하며, 사용자의 정보를 안전하게 보호하기 위해 합리적인 조치를 취합니다. 또한 사용자가 안정적으로 서비스를 이용할 수 있도록 지속적으로 개선합니다.'
    ]
  },
  {
    title: '지적재산권',
    paragraphs: [
      '서비스의 디자인, 로고, 코드 및 회사가 제작한 모든 자료에 대한 저작권 및 지적재산권은 회사에 귀속됩니다. 사용자는 회사의 사전 동의 없이 이를 복제·배포·변형하실 수 없습니다.',
      '사용자가 입력하신 콘텐츠에 대한 권리는 사용자 본인에게 있으며, 회사는 이를 사용자의 명시적 요청 외에는 이용하지 않습니다.'
    ]
  },
  {
    title: '서비스의 변경 및 종료',
    paragraphs: [
      '회사는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 종료할 수 있으며, 이 경우 사전에 합리적인 방법으로 안내합니다. 종료 시 사용자는 백업 기능을 통해 콘텐츠를 보존하실 수 있습니다.'
    ]
  },
  {
    title: '책임의 제한',
    paragraphs: [
      '회사는 천재지변, 통신망 장애 등 회사의 합리적인 통제를 벗어난 사유로 인한 손해에 대해서는 책임을 지지 않습니다. 또한 사용자가 본 약관을 위반하여 발생한 손해에 대해서는 사용자가 책임을 부담합니다.'
    ]
  },
  {
    title: '준거법 및 분쟁 해결',
    paragraphs: [
      '본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 발생한 분쟁은 회사의 본점 소재지 관할 법원을 제1심 관할 법원으로 합니다. 다만 사용자는 거주지 관할 법원에 소를 제기하실 수 있습니다.'
    ]
  }
];

function Privacy({ onBack, primary }) {
  return (
    <LegalPage
      title="개인정보처리방침"
      effectiveDate="2026년 5월 20일"
      sections={PRIVACY_SECTIONS}
      onBack={onBack}
      primary={primary}
    />
  );
}

function Terms({ onBack, primary }) {
  return (
    <LegalPage
      title="이용약관"
      effectiveDate="2026년 5월 20일"
      sections={TERMS_SECTIONS}
      onBack={onBack}
      primary={primary}
    />
  );
}

Object.assign(window, { LegalPage, Privacy, Terms });
