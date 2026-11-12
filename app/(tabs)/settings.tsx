// 설정 탭 — same look as the home screen (ADR-007 §10 UI 통일): grouped
// background, large title, bold section headings over white RADIUS.box
// groups, iPhone-style rows from the form primitives.
//
//   자녀     자녀 관리 (avatars + count) →
//   알림     시스템 알림 (switch) · 기본 알림 시점 (only while 시스템 알림 is on)
//   캘린더   캘린더 연동 →
//   데이터   데이터 관리 → · 모든 데이터 초기화
//   정보     앱 버전 · 약관 및 개인정보 →

import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import { APP_VERSION } from '../../src/utils/app-version';
import type { Child } from '../../src/domain/types';
import { getDb } from '../../src/db/client';
import { rescheduleAll } from '../../src/notifications/scheduler';
import { useChildrenStore } from '../../src/state/children-store';
import { useGuardianStore } from '../../src/state/guardian-store';
import { useDisplayStore } from '../../src/state/display-store';
import { useNotifSettingsStore } from '../../src/state/notif-settings-store';
import { resetAllData } from '../../src/state/reset-all';
import { KidAvatar } from '../../src/ui/common/KidAvatar';
import { HomeSection } from '../../src/ui/home/HomeSection';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';
import { TYPE } from '../../src/ui/typography';
import { alertSummary, NOTIFY_OPTIONS } from '../../src/ui/sheets/edit-sheet-form';
import {
  FormActionRow,
  FormOptionList,
  FormToggleRow,
  FormValueRow,
} from '../../src/ui/sheets/form-rows';
import { makeStyles, useTheme } from '../../src/ui/appearance';

const MODE_LABEL = { system: '시스템', light: '라이트', dark: '다크' } as const;
/** Space under the content so the floating dock never covers the last row. */
const DOCK_CLEARANCE = 110;

// 기본 알림 시점 — 없음 first (the default), then the form's lead times.
const LEAD_OPTIONS: readonly { key: number | null; label: string }[] = [
  { key: null, label: alertSummary(null) },
  ...NOTIFY_OPTIONS.map((m) => ({ key: m, label: alertSummary(m) })),
];

export default function SettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);
  const sortedChildren = useMemo(() => [...children].sort((a, b) => a.id - b.id), [children]);

  // Notification settings are persisted (write-through) and feed the new-event
  // form's 시작 전 알림 default.
  const systemNotif = useNotifSettingsStore((s) => s.systemEnabled);
  const setSystemEnabled = useNotifSettingsStore((s) => s.setSystemEnabled);
  const leadTime = useNotifSettingsStore((s) => s.defaultMinutesBefore);
  const setDefaultMinutesBefore = useNotifSettingsStore((s) => s.setDefaultMinutesBefore);
  const lastScheduleTruncated = useNotifSettingsStore((s) => s.lastScheduleTruncated);
  const guardianEnabled = useGuardianStore((s) => s.enabled);
  const appearanceMode = useDisplayStore((s) => s.appearance);
  const [leadOpen, setLeadOpen] = useState(false);

  // Toggling 시스템 알림: persist then reconcile so turning OFF cancels every
  // pending push immediately and turning ON re-arms.
  const handleSystemNotifChange = useCallback(
    (v: boolean): void => {
      if (!v) setLeadOpen(false);
      void (async () => {
        const db = await getDb();
        await setSystemEnabled(db, v);
        await rescheduleAll(db);
      })();
    },
    [setSystemEnabled],
  );

  // 기본 알림 시점: only the default for NEW events' 시작 전 알림; existing
  // events keep theirs, so no reconcile.
  const handleLeadTimeChange = useCallback(
    (n: number | null): void => {
      setLeadOpen(false);
      void (async () => {
        const db = await getDb();
        await setDefaultMinutesBefore(db, n);
      })();
    },
    [setDefaultMinutesBefore],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          설정
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HomeSection title="자녀">
          <FormValueRow
            label="자녀 관리"
            value={`${sortedChildren.length}명`}
            leading={<KidStack shown={sortedChildren.slice(0, MAX_CHILDREN)} />}
            onPress={() => router.push('/settings/kids')}
            last
            testID="settings-row-kids"
          />
        </HomeSection>

        <View style={styles.block}>
          <HomeSection title="알림">
            <FormToggleRow
              label="시스템 알림"
              value={systemNotif}
              onChange={handleSystemNotifChange}
              onColor={theme.t.primary}
              last={!systemNotif}
            />
            {/* 기본 알림 시점 only matters while 시스템 알림 is on. */}
            {systemNotif ? (
              <FormValueRow
                label="기본 알림 시점"
                value={alertSummary(leadTime)}
                onPress={() => setLeadOpen((o) => !o)}
                expanded={leadOpen}
                last
                testID="settings-row-notif-lead"
              >
                <FormOptionList<number | null>
                  options={LEAD_OPTIONS}
                  selected={leadTime}
                  labelPrefix="기본 알림 시점: "
                  onSelect={handleLeadTimeChange}
                />
              </FormValueRow>
            ) : null}
          </HomeSection>
          {systemNotif ? null : (
            <Text style={styles.footnote}>일정 시작 전 알림을 받으려면 켜 주세요.</Text>
          )}
          {systemNotif && lastScheduleTruncated ? (
            <Text style={styles.footnote} testID="settings-notif-truncated">
              임박한 60개 알림만 예약됐어요
            </Text>
          ) : null}
        </View>

        <HomeSection title="화면">
          <FormValueRow
            label="화면 설정"
            value={MODE_LABEL[appearanceMode]}
            onPress={() => router.push('/settings/display')}
            last
            testID="settings-row-display"
          />
        </HomeSection>

        <HomeSection title="캘린더">
          <FormValueRow
            label="캘린더 연동"
            value={guardianEnabled ? '켜짐' : '꺼짐'}
            onPress={() => router.push('/settings/calendars')}
            last
            testID="settings-row-calendars"
          />
        </HomeSection>

        <HomeSection title="데이터">
          <FormValueRow
            label="데이터 관리"
            value="내보내기"
            onPress={() => router.push('/settings/data')}
            testID="settings-row-data"
          />
          <FormActionRow
            label="모든 데이터 초기화"
            tone="danger"
            onPress={() =>
              // Native alert — same as the other destructive confirms.
              Alert.alert(
                '모든 데이터를 초기화할까요?',
                '자녀, 일정, 할일, 알림 설정이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.',
                [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '초기화하기',
                    style: 'destructive',
                    onPress: () =>
                      void resetAllData()
                        .then(() => router.replace('/'))
                        .catch(() => Alert.alert('초기화하지 못했어요', '잠시 후 다시 시도해 주세요.')),
                  },
                ],
              )
            }
            last
          />
        </HomeSection>

        <HomeSection title="정보">
          <FormValueRow label="앱 버전" value={APP_VERSION} />
          <FormValueRow
            label="약관 및 개인정보"
            value=""
            onPress={() => router.push('/settings/legal')}
            last
            testID="settings-row-legal"
          />
        </HomeSection>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Overlapping kid avatars before the count on the 자녀 관리 row. */
function KidStack({ shown }: { shown: readonly Child[] }): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.kidStack}>
      {shown.map((k, i) => (
        <View key={k.id} style={[styles.kidStackDot, i === 0 ? null : styles.kidStackOverlap, { zIndex: shown.length - i }]}>
          <KidAvatar child={k} size={20} />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((th) => ({
  // Same chrome as the home screen.
  safe: { flex: 1, backgroundColor: th.t.groupedBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.xs,
    paddingLeft: 18,
    paddingRight: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
  title: { ...TYPE.largeTitle, color: th.t.ink },
  content: {
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: DOCK_CLEARANCE,
    gap: 18,
  },
  block: { gap: 6 },
  footnote: { ...TYPE.footnote, color: th.t.inkSub, paddingHorizontal: SPACING.xs },
  kidStack: { flexDirection: 'row', alignItems: 'center' },
  kidStackDot: { borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: th.t.surface },
  kidStackOverlap: { marginLeft: -6 },
}));
