// Settings hub — 1:1 port of docs/design/amatta-v1/app-settings.jsx.
// Rows link to detail sub-screens; notifications row is a placeholder until
// batch E lands. Children CRUD now lives on /settings/kids.

import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { wipeAllData } from '../../src/db/wipe';
import { MAX_CHILDREN } from '../../src/domain/constants';
import { useChildrenStore } from '../../src/state/children-store';
import { useChecklistStore } from '../../src/state/checklist-store';
import { usePickupLogStore } from '../../src/state/pickup-log-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useTodosStore } from '../../src/state/todos-store';
import { KidAvatar } from '../../src/ui/common/KidAvatar';
import type { Child } from '../../src/domain/types';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { IconChevronLeft, IconChevronRight } from '../../src/ui/icons';
import { TOKENS } from '../../src/ui/palette';
import { ResetConfirmSheet } from '../../src/ui/settings/ResetConfirmSheet';

const APP_VERSION = '1.0.0';
const APP_BUILD = '(build 1)';

// Spec § 알림 — three "기본 알림 시점" options.
const NOTIFY_LEAD_OPTIONS = [10, 30, 60] as const;

export default function SettingsScreen(): React.ReactElement {
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);

  const sortedChildren = useMemo(
    () => [...children].sort((a, b) => a.id - b.id),
    [children],
  );

  // TODO(notif-persist): these toggles still live in component state.
  // Once a global app_settings table or AsyncStorage slice lands they'll
  // hydrate on boot + persist on change. Until then the UI works but the
  // values reset on app relaunch.
  const [systemNotif, setSystemNotif] = useState<boolean>(true);
  const [leadTime, setLeadTime] = useState<number>(30);

  const [resetVisible, setResetVisible] = useState<boolean>(false);

  const handleConfirmReset = useCallback(async (): Promise<void> => {
    const db = await getDb();
    await wipeAllData(db);
    // Reload every zustand slice so the empty state is reflected
    // immediately. children-store re-emitting [] triggers the redirect
    // to /onboarding/welcome from (tabs)/index.
    await Promise.all([
      useChildrenStore.getState().load(db),
      useSchedulesStore.getState().load(db),
      useChecklistStore.getState().load(db),
      useTodosStore.getState().load(db),
      usePickupLogStore.getState().load(db),
    ]);
    setResetVisible(false);
    // Bounce out to the daily tab; the empty-state redirect picks up
    // the wipe and routes to /onboarding/welcome.
    router.replace('/');
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
          style={styles.topBarBack}
        >
          <IconChevronLeft size={22} color={TOKENS.ink} />
        </Pressable>
        <Text style={styles.topBarTitle}>설정</Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 자녀 */}
        <SectionHeader label="자녀" />
        <Card>
          <NavRow
            label="자녀 관리"
            value={
              <KidStack
                shown={sortedChildren.slice(0, MAX_CHILDREN)}
                total={sortedChildren.length}
              />
            }
            onPress={() => router.push('/settings/kids')}
            accessibilityLabel="자녀 관리"
            testID="settings-row-kids"
          />
        </Card>

        {/* 알림 — spec § '알림' inline (no detail page). */}
        <SectionHeader label="알림" />
        <Card>
          <ToggleRow
            label="시스템 알림"
            sub="이벤트 시작 전에 푸시 받기"
            value={systemNotif}
            onChange={setSystemNotif}
            accessibilityLabel="시스템 알림"
            testID="settings-row-notif-system"
          />
          <Divider />
          <SegmentedRow
            label="기본 알림 시점"
            sub="새 일정에 자동으로 설정돼요"
            options={NOTIFY_LEAD_OPTIONS}
            value={leadTime}
            onChange={setLeadTime}
            disabled={!systemNotif}
            renderOption={(v) => `${v}분 전`}
            accessibilityLabel="기본 알림 시점"
            testID="settings-row-notif-lead"
          />
        </Card>

        {/* 데이터 */}
        <SectionHeader label="데이터" />
        <Card>
          <NavRow
            label="데이터 관리"
            sub="JSON 내보내기 / 가져오기"
            onPress={() => router.push('/settings/data')}
            accessibilityLabel="데이터 관리"
            testID="settings-row-data"
          />
        </Card>

        {/* 모든 데이터 초기화 — spec § '데이터' destructive card.
            Lives in its own Card right before the 정보 section. */}
        <View style={styles.destructiveSpacer} />
        <Card>
          <DestructiveRow
            label="모든 데이터 초기화"
            sub="자녀·일정·할일·설정이 모두 삭제돼요"
            onPress={() => setResetVisible(true)}
            accessibilityLabel="모든 데이터 초기화"
            testID="settings-row-reset"
          />
        </Card>

        {/* 정보 */}
        <SectionHeader label="정보" />
        <Card>
          <InfoRow
            label="앱 버전"
            value={APP_VERSION}
            valueSub={APP_BUILD}
          />
          <Divider />
          <NavRow
            label="약관 및 개인정보"
            onPress={() => router.push('/settings/legal')}
            accessibilityLabel="약관 및 개인정보"
            testID="settings-row-legal"
          />
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ResetConfirmSheet
        visible={resetVisible}
        onCancel={() => setResetVisible(false)}
        onConfirm={() => void handleConfirmReset()}
      />
    </SafeAreaView>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }): React.ReactElement {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }): React.ReactElement {
  return <View style={styles.card}>{children}</View>;
}

function Divider(): React.ReactElement {
  return <View style={styles.divider} />;
}

interface NavRowProps {
  label: string;
  sub?: string;
  value?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
}

function NavRow({
  label,
  sub,
  value,
  onPress,
  disabled,
  accessibilityLabel,
  testID,
}: NavRowProps): React.ReactElement {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled ? styles.rowPressed : null,
        disabled ? styles.rowDisabled : null,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub !== undefined ? (
          <Text style={styles.rowSub}>{sub}</Text>
        ) : null}
      </View>
      {value !== undefined ? value : null}
      <IconChevronRight size={16} color={TOKENS.ink30} />
    </Pressable>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  accessibilityLabel: string;
  testID?: string;
}): React.ReactElement {
  return (
    <View
      style={styles.row}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      testID={testID}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub !== undefined ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function SegmentedRow<T>({
  label,
  sub,
  options,
  value,
  onChange,
  disabled,
  renderOption,
  accessibilityLabel,
  testID,
}: {
  label: string;
  sub?: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  renderOption: (v: T) => string;
  accessibilityLabel: string;
  testID?: string;
}): React.ReactElement {
  return (
    <View
      style={[styles.row, styles.segmentedRow, disabled ? styles.rowDisabled : null]}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub !== undefined ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <View style={styles.segmentedTrack}>
        {options.map((opt, i) => {
          const active = opt === value && !disabled;
          return (
            <Pressable
              key={i}
              onPress={() => {
                if (disabled) return;
                onChange(opt);
              }}
              accessibilityRole="button"
              accessibilityLabel={renderOption(opt)}
              accessibilityState={{ selected: active, disabled }}
              style={[styles.segment, active ? styles.segmentActive : null]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  active ? styles.segmentLabelActive : null,
                ]}
              >
                {renderOption(opt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DestructiveRow({
  label,
  sub,
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={styles.destructiveLabel}>{label}</Text>
        {sub !== undefined ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <IconChevronRight size={16} color={TOKENS.danger} />
    </Pressable>
  );
}

function InfoRow({
  label,
  value,
  valueSub,
}: {
  label: string;
  value: string;
  valueSub?: string;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.infoValueWrap}>
        <Text style={styles.infoValue}>{value}</Text>
        {valueSub !== undefined ? (
          <Text style={styles.infoValueSub}>{valueSub}</Text>
        ) : null}
      </View>
    </View>
  );
}

function KidStack({
  shown,
  total,
}: {
  shown: readonly Child[];
  total: number;
}): React.ReactElement {
  return (
    <View style={styles.kidStackWrap}>
      <View style={styles.kidStackRow}>
        {shown.map((k, i) => (
          <View
            key={k.id}
            style={[
              styles.kidStackDot,
              i === 0 ? null : styles.kidStackDotOverlap,
              { zIndex: shown.length - i },
            ]}
          >
            <KidAvatar child={k} size={20} />
          </View>
        ))}
      </View>
      <Text style={styles.kidStackCount}>{total}명</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surfaceSoft },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: TOKENS.surfaceSoft,
  },
  topBarSide: { flex: 1 },
  topBarBack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  topBarTitle: {
    fontSize: 17,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.4,
  },

  scrollContent: { paddingHorizontal: 14, paddingBottom: 32 },

  sectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },

  card: {
    backgroundColor: TOKENS.surface,
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },

  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.ink04,
    marginHorizontal: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: TOKENS.ink04 },
  rowDisabled: { opacity: 0.6 },

  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.1,
    lineHeight: 16,
  },

  // --- Segmented row ---------------------------------------------------
  segmentedRow: { alignItems: 'flex-start', gap: 8 },
  segmentedTrack: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink04,
  },
  segmentActive: { backgroundColor: TOKENS.ink },
  segmentLabel: {
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  segmentLabelActive: { color: TOKENS.surface },

  // --- Destructive row -------------------------------------------------
  destructiveSpacer: { height: 8 },
  destructiveLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.danger,
    letterSpacing: -0.3,
    lineHeight: 18,
  },

  infoValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink,
    letterSpacing: -0.1,
  },
  infoValueSub: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.inkSub,
    letterSpacing: 0.2,
  },

  kidStackWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kidStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kidStackDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TOKENS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: TOKENS.surface,
  },
  kidStackDotOverlap: { marginLeft: -7 },
  kidStackCount: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },

  bottomSpacer: { height: 60 },
});
