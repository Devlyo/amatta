// 약관 및 개인정보 — collapsible terms + privacy sections.
// Text content matches docs/design/amatta-v1/app-settings-legal.jsx.

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FONT_FAMILIES } from '../../src/ui/fonts';
import { IconChevronDown, IconChevronRight } from '../../src/ui/icons';
import { TOKENS } from '../../src/ui/palette';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';

import { DetailTopBar } from './kids';

const EFFECTIVE_DATE = '2026년 6월 30일';

interface Section {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

const PRIVACY_SECTIONS: Section[] = [
  {
    title: '수집하는 정보',
    paragraphs: [
      '운영자는 서비스 제공을 위해 사용자가 직접 입력한 최소한의 정보만 기기 내부에 저장합니다. 별도의 회원가입은 요구하지 않으며, 입력하신 정보는 외부 서버로 전송되지 않습니다.',
    ],
    bullets: [
      '자녀 정보: 이름, 선택한 테마 색상',
      '일정 정보: 제목, 시간, 장소, 카테고리, 픽업 여부',
      '준비물·할일 정보: 제목, 마감 시점, 완료 여부',
      '앱 설정: 알림 활성화 여부, 기본 알림 시점',
    ],
  },
  {
    title: '정보의 저장 위치',
    paragraphs: [
      '입력하신 모든 정보는 사용자의 기기 내부 저장소에만 보관됩니다. 운영자는 사용자의 데이터를 별도 서버에 저장하거나, 제3자에게 전송하지 않습니다.',
      'JSON 백업(내보내기) 기능을 사용하실 경우 백업 파일이 생성되며, 해당 파일을 어디에 보관할지는 사용자가 직접 결정하실 수 있습니다.',
    ],
  },
  {
    title: '정보의 이용 목적',
    paragraphs: [
      '수집된 정보는 아래의 목적으로만 사용되며, 명시한 범위를 벗어나는 용도로는 이용되지 않습니다.',
    ],
    bullets: [
      '일간뷰·주간뷰 화면 구성 및 자녀별 색상 표시',
      '예정된 일정 및 픽업에 대한 사전 알림 발송(기기 내 로컬 알림)',
      '준비물·할일의 완료 상태 추적',
      '사용자 본인이 요청하신 데이터 백업(JSON 내보내기)',
    ],
  },
  {
    title: '정보의 보관 기간',
    paragraphs: [
      '사용자가 직접 항목을 삭제하시거나 “모든 데이터 초기화” 기능을 사용하시기 전까지 정보는 기기 내부에 보관됩니다. 앱을 삭제하실 경우 모든 데이터는 즉시 함께 제거되며, 운영자는 별도의 사본을 보유하지 않습니다.',
    ],
  },
  {
    title: '제3자 제공',
    paragraphs: [
      '운영자는 사용자의 정보를 어떠한 경우에도 제3자에게 제공하거나 위탁하지 않습니다. 다만 법령에 따라 수사기관의 적법한 요청이 있는 경우에는 협조할 수 있으며, 이때에도 그 사유와 범위를 가능한 한 사용자에게 안내합니다.',
    ],
  },
  {
    title: '사용자의 권리',
    paragraphs: [
      '사용자는 언제든지 다음의 권리를 행사하실 수 있습니다. 모든 작업은 별도의 신청 없이 앱 내에서 직접 수행 가능합니다.',
    ],
    bullets: [
      '저장된 정보의 열람 및 수정',
      '특정 항목의 삭제 또는 전체 초기화',
      'JSON 백업(내보내기)을 통한 정보의 보관',
      '알림 동의의 철회(설정 또는 기기 알림 권한)',
    ],
  },
  {
    title: '아동의 개인정보',
    paragraphs: [
      '아마따는 자녀의 일정을 관리하는 보호자를 위한 도구로서, 자녀 본인이 직접 사용하는 것을 전제로 설계되지 않았습니다. 보호자가 입력하신 자녀 정보는 보호자의 책임 하에 관리되며, 운영자는 해당 정보를 외부와 공유하지 않습니다.',
    ],
  },
  {
    title: '문의처',
    paragraphs: [
      '본 방침에 관한 문의 사항이 있으시면 아래로 연락해 주세요. 운영자는 합리적인 시간 내에 성실히 답변드리겠습니다.',
    ],
    bullets: [
      '이메일: amatta.help@gmail.com',
      '응답 시간: 영업일 기준 3일 이내',
    ],
  },
  {
    title: '방침의 변경',
    paragraphs: [
      '본 방침은 법령·서비스 변경에 따라 수정될 수 있으며, 중요한 변경이 있는 경우 앱 내 공지 또는 알림을 통해 사전에 안내합니다. 사용자가 변경된 방침에 동의하지 않으실 경우 서비스 이용을 중단하실 수 있습니다.',
    ],
  },
];

const TERMS_SECTIONS: Section[] = [
  {
    title: '서비스의 목적',
    paragraphs: [
      '본 약관은 사용자가 아마따(이하 “서비스”)를 이용함에 있어 운영자와 사용자 사이의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다. 본 서비스는 무료로 제공되며 앱 내 결제나 유료 기능이 없습니다. 서비스를 설치·이용함으로써 사용자는 본 약관에 동의하신 것으로 봅니다.',
    ],
  },
  {
    title: '용어의 정의',
    paragraphs: ['본 약관에서 사용하는 용어의 정의는 다음과 같습니다.'],
    bullets: [
      '“운영자”란 본 서비스를 개발·제공하는 개인 개발자를 의미하며, 본 서비스는 법인이 아닌 개인이 운영합니다.',
      '“서비스”란 아마따라는 이름으로 제공되는 모든 기능과 콘텐츠를 의미합니다.',
      '“사용자”란 서비스를 설치하고 이용하는 자를 말합니다.',
      '“자녀”란 사용자가 서비스 내에 등록한 보호 대상을 의미합니다.',
      '“콘텐츠”란 사용자가 입력한 일정·준비물·할일·메모 등 모든 데이터를 포함합니다.',
    ],
  },
  {
    title: '서비스의 제공',
    paragraphs: [
      '운영자는 서비스를 안정적으로 제공하기 위해 노력합니다. 본 서비스는 사용자의 기기 내에서 단독으로 동작하므로 별도의 서버 점검이나 통신망 장애로 인한 중단은 발생하지 않습니다. 다만 운영체제 업데이트, 기기 환경 변화, 앱의 중대한 결함 등으로 일부 기능이 정상 동작하지 않을 수 있으며, 이 경우 운영자는 앱 업데이트 등을 통해 개선하기 위해 노력합니다.',
    ],
  },
  {
    title: '이용 자격 및 사용자의 의무',
    paragraphs: [
      '본 서비스는 자녀의 일정을 관리하는 보호자(성인)의 이용을 전제로 합니다. 사용자는 자녀 정보를 입력·관리할 정당한 권한이 있음을 보증하며, 해당 정보의 관리 책임은 사용자에게 있습니다.',
      '사용자는 서비스를 선량한 관리자로서 이용해야 하며, 다음 행위를 하여서는 안 됩니다.',
    ],
    bullets: [
      '본인 또는 타인의 정보를 허위로 입력하는 행위',
      '서비스의 운영을 방해하거나 안정성을 해치는 행위',
      '관련 법령 또는 미풍양속에 반하는 콘텐츠를 저장하는 행위',
      '서비스를 상업적으로 이용하거나 무단으로 복제·배포하는 행위',
    ],
  },
  {
    title: '운영자의 의무',
    paragraphs: [
      '운영자는 본 약관 및 관련 법령을 준수하며, 사용자의 정보를 안전하게 보호하기 위해 합리적인 조치를 취합니다. 운영자는 서비스의 개선을 위해 노력하나, 무료로 제공되는 서비스의 특성상 특정 수준의 기능이나 가용성을 보장하지는 않습니다.',
    ],
  },
  {
    title: '지적재산권',
    paragraphs: [
      '서비스의 디자인, 로고, 코드 및 운영자가 제작한 모든 자료에 대한 저작권 및 지적재산권은 운영자에 귀속됩니다. 사용자는 운영자의 사전 동의 없이 이를 복제·배포·변형하실 수 없습니다.',
      '사용자가 입력하신 콘텐츠에 대한 권리는 사용자 본인에게 있으며, 운영자는 이를 사용자의 명시적 요청 외에는 이용하지 않습니다.',
    ],
  },
  {
    title: '서비스의 변경 및 종료',
    paragraphs: [
      '운영자는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 종료할 수 있으며, 이 경우 사전에 합리적인 방법으로 안내합니다. 종료 시 사용자는 JSON 백업(내보내기) 기능을 통해 콘텐츠를 보존하실 수 있습니다. 앱이 스토어에서 내려가더라도 이미 설치된 기기 내 데이터는 삭제되지 않습니다.',
    ],
  },
  {
    title: '책임의 제한',
    paragraphs: [
      '본 서비스는 무료로 “현재 상태 그대로(as-is)” 제공됩니다. 운영자는 서비스가 사용자의 특정 목적에 부합하거나 오류·중단 없이 동작할 것을 보증하지 않으며, 일정 및 알림 정보의 최종 확인 책임은 사용자에게 있습니다.',
      '운영자는 천재지변 등 운영자의 합리적인 통제를 벗어난 사유로 인한 손해에 대해서는 책임을 지지 않습니다. 또한 사용자가 본 약관을 위반하여 발생한 손해에 대해서는 사용자가 책임을 부담합니다.',
    ],
  },
  {
    title: '준거법 및 분쟁 해결',
    paragraphs: [
      '본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생할 경우 민사소송법에 따른 관할 법원에 제기할 수 있습니다.',
    ],
  },
  {
    title: '기타',
    paragraphs: [
      '본 약관은 사용자와 운영자 간의 계약이며, 앱 스토어 운영사(Apple 등)는 본 약관의 당사자가 아닙니다. 본 약관의 일부 조항이 무효가 되더라도 나머지 조항의 효력에는 영향을 미치지 않습니다.',
      '문의: amatta.help@gmail.com',
    ],
  },
];

type Group = 'privacy' | 'terms';

export default function LegalScreen(): React.ReactElement {
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState<Group | null>('privacy');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DetailTopBar
        title="약관 및 개인정보"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>EFFECTIVE</Text>
          <Text style={styles.heroDate}>{EFFECTIVE_DATE}</Text>
          <Text style={styles.heroNote}>
            아마따는 사용자가 안심하고 서비스를 이용하실 수 있도록 본 약관 및 개인정보처리방침을 마련하고 있습니다.
          </Text>
        </View>

        <GroupSection
          title="개인정보 처리방침"
          open={openGroup === 'privacy'}
          onToggle={() => setOpenGroup(openGroup === 'privacy' ? null : 'privacy')}
          sections={PRIVACY_SECTIONS}
          testID="legal-group-privacy"
        />

        <GroupSection
          title="이용약관"
          open={openGroup === 'terms'}
          onToggle={() => setOpenGroup(openGroup === 'terms' ? null : 'terms')}
          sections={TERMS_SECTIONS}
          testID="legal-group-terms"
        />

        <Text style={styles.footer}>아마따 v1.0.0 · {EFFECTIVE_DATE} 기준</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function GroupSection({
  title,
  open,
  onToggle,
  sections,
  testID,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  sections: Section[];
  testID: string;
}): React.ReactElement {
  return (
    <View style={styles.group} testID={testID}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${open ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.groupHeader,
          pressed ? styles.groupHeaderPressed : null,
        ]}
      >
        <Text style={styles.groupTitle}>{title}</Text>
        {open ? (
          <IconChevronDown size={18} color={TOKENS.inkSub} />
        ) : (
          <IconChevronRight size={18} color={TOKENS.inkSub} />
        )}
      </Pressable>
      {open ? (
        <View style={styles.groupBody}>
          {sections.map((s, i) => (
            <View key={s.title} style={i > 0 ? styles.sectionSpacer : null}>
              <Text style={styles.sectionTitle}>{`${i + 1}. ${s.title}`}</Text>
              {s.paragraphs.map((p, j) => (
                <Text key={j} style={styles.paragraph}>
                  {p}
                </Text>
              ))}
              {s.bullets !== undefined ? (
                <View style={styles.bulletList}>
                  {s.bullets.map((b) => (
                    <View key={b} style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surfaceSoft },

  scrollContent: { paddingHorizontal: 14, paddingBottom: SPACING.xxxl },

  hero: {
    backgroundColor: TOKENS.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: SPACING.xl,
    marginTop: SPACING.xs,
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.inkSub,
    letterSpacing: 0.4,
  },
  heroDate: {
    marginTop: SPACING.xs,
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  heroNote: {
    marginTop: SPACING.md,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 21,
    letterSpacing: -0.2,
  },

  group: {
    backgroundColor: TOKENS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  groupHeaderPressed: { backgroundColor: TOKENS.ink04 },
  groupTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  groupBody: {
    paddingHorizontal: 14,
    paddingBottom: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.ink04,
    paddingTop: SPACING.md,
  },

  sectionSpacer: { marginTop: SPACING.lg },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    lineHeight: 21,
    letterSpacing: -0.2,
    marginTop: 6,
  },

  bulletList: { marginTop: SPACING.sm },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.xxs,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 9,
    backgroundColor: TOKENS.ink30,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    lineHeight: 20,
    letterSpacing: -0.2,
  },

  footer: {
    textAlign: 'center',
    paddingVertical: SPACING.xl,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink30,
    letterSpacing: 0.3,
  },
});
