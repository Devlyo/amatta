// 약관 및 개인정보 — collapsible terms + privacy sections.
// Text lives in src/legal/legal-text.ts (shared with the public pages).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { IconChevronDown, IconChevronRight } from '../../src/ui/icons';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';
import { TYPE } from '../../src/ui/typography';
import { SettingsDetailScreen } from '../../src/ui/settings/SettingsChrome';
import { makeStyles, useTheme } from '../../src/ui/appearance';
import { APP_VERSION } from '../../src/utils/app-version';
import { EFFECTIVE_DATE, LEGAL_INTRO, PRIVACY_SECTIONS, TERMS_SECTIONS, type Section } from '../../src/legal/legal-text';

type Group = 'privacy' | 'terms';

export default function LegalScreen(): React.ReactElement {
  const styles = useStyles();
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState<Group | null>('privacy');

  return (
    <SettingsDetailScreen title="약관 및 개인정보" onBack={() => router.back()}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>시행일</Text>
          <Text style={styles.heroDate}>{EFFECTIVE_DATE}</Text>
          <Text style={styles.heroNote}>{LEGAL_INTRO}</Text>
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

        <Text style={styles.footer}>WeMoa v{APP_VERSION} · {EFFECTIVE_DATE} 기준</Text>
    </SettingsDetailScreen>
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
  const theme = useTheme();
  const styles = useStyles();
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
          <IconChevronDown size={18} color={theme.t.inkSub} />
        ) : (
          <IconChevronRight size={18} color={theme.t.inkSub} />
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

const useStyles = makeStyles((th) => ({
  // Shared settings style: white RADIUS.box groups, type tokens.
  hero: {
    backgroundColor: th.t.surface,
    borderRadius: RADIUS.box,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  heroLabel: { ...TYPE.footnote, color: th.t.inkSub },
  heroDate: { ...TYPE.headline, color: th.t.ink },
  heroNote: { ...TYPE.subhead, color: th.t.inkSub, marginTop: SPACING.xs },

  group: {
    backgroundColor: th.t.surface,
    borderRadius: RADIUS.box,
    overflow: 'hidden',
  },
  groupHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: SPACING.md,
  },
  groupHeaderPressed: { backgroundColor: th.t.ink04 },
  groupTitle: { ...TYPE.row, flex: 1, color: th.t.ink },
  groupBody: {
    paddingHorizontal: 16,
    paddingBottom: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: th.t.separator,
    paddingTop: SPACING.md,
  },

  sectionSpacer: { marginTop: SPACING.lg },
  sectionTitle: { ...TYPE.headline, color: th.t.ink, marginBottom: SPACING.xs },
  paragraph: { ...TYPE.subhead, color: th.t.ink, marginTop: 6 },

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
    borderRadius: RADIUS.full,
    marginTop: 8,
    backgroundColor: th.t.ink30,
  },
  bulletText: { ...TYPE.subhead, flex: 1, color: th.t.ink },

  footer: { ...TYPE.footnote, textAlign: 'center', color: th.t.ink30, paddingVertical: SPACING.md },
}));
