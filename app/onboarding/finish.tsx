// Onboarding 3 — Finish (design canvas "O4 마무리 — 알림·캘린더").
//
// The kids are already saved (add-kid commits on 완료), so there is no back
// button here. Two opt-ins with context, asked only when the parent taps
// 시작하기 — this replaces the cold notification prompt at first boot:
//   - 일정 알림 (default on)   → notification permission + reschedule
//   - 보호자 일정 함께 보기 (off) → calendar permission (guardian store)

import { useState } from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getDb } from '../../src/db/client';
import { ensurePermission } from '../../src/notifications/permissions';
import { rescheduleAll } from '../../src/notifications/scheduler';
import { useChildrenStore } from '../../src/state/children-store';
import { useGuardianStore } from '../../src/state/guardian-store';
import { useNotifSettingsStore } from '../../src/state/notif-settings-store';
import { AVATAR_IMAGE_BY_KEY } from '../../src/ui/assets';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { withAlpha } from '../../src/ui/palette';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';
import { makeStyles, useTheme } from '../../src/ui/appearance';

function OptionRow({
  icon,
  title,
  sub,
  value,
  onChange,
  last = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={theme.t.primaryDeep} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.t.primary, false: theme.t.switchOff }}
        ios_backgroundColor={theme.t.switchOff}
        accessibilityLabel={title}
      />
      {last ? null : <View style={styles.rowSeparator} />}
    </View>
  );
}

export default function OnbFinishScreen(): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const kids = useChildrenStore((s) => s.children);
  // Start from what is stored — a restored backup brings its own 알림 choice.
  const [notify, setNotify] = useState(() => useNotifSettingsStore.getState().systemEnabled);
  const [guardian, setGuardian] = useState(() => useGuardianStore.getState().enabled);
  const [busy, setBusy] = useState(false);

  const start = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const db = await getDb();
      await useNotifSettingsStore.getState().setSystemEnabled(db, notify);
      if (notify) await ensurePermission();
      await rescheduleAll(db);
      // Denied = stays off; the parent can turn it on later in 설정.
      if (guardian) await useGuardianStore.getState().setEnabled(db, true);
    } catch (e) {
      console.warn('[onboarding] finish failed:', e);
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">
          거의 다 됐어요
        </Text>
        <Text style={styles.sub}>필요한 것만 켜 주세요. 설정에서 언제든 바꿀 수 있어요.</Text>

        <View style={styles.kids}>
          {kids.map((k) => (
            <View key={k.id} style={styles.kid}>
              <View
                style={[
                  styles.kidRing,
                  { backgroundColor: withAlpha(theme.kid(k.colorIndex).source, 0.38) },
                ]}
              >
                <Image source={AVATAR_IMAGE_BY_KEY[k.avatar]} style={styles.kidImage} resizeMode="contain" />
              </View>
              <Text style={styles.kidName} numberOfLines={1}>
                {k.name}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.box}>
          <OptionRow
            icon="notifications-outline"
            title="일정 알림"
            sub="학원 가기 전에 준비물과 함께 알려 줘요"
            value={notify}
            onChange={setNotify}
          />
          <OptionRow
            icon="calendar-outline"
            title="보호자 일정 함께 보기"
            sub="아이폰 캘린더 일정을 아이 일정 옆에 보여 줘요"
            value={guardian}
            onChange={setGuardian}
            last
          />
        </View>
      </ScrollView>

      <View style={styles.ctaWrap}>
        <Pressable
          onPress={() => void start()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="시작하기"
          accessibilityState={{ busy }}
          style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
        >
          <Text style={styles.ctaLabel}>시작하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((th) => ({
  safe: { flex: 1, backgroundColor: th.t.groupedBg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: 50, paddingBottom: SPACING.xl },
  title: {
    fontFamily: FONT_FAMILIES.pretendardBold,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: th.t.ink,
  },
  sub: {
    marginTop: 6,
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: th.t.inkSub,
  },
  kids: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 22,
    paddingTop: 30,
    paddingBottom: 28,
  },
  kid: { alignItems: 'center', gap: 6, maxWidth: 84 },
  kidRing: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kidImage: { width: 74, height: 74 },
  kidName: { fontFamily: FONT_FAMILIES.pretendardSemiBold, fontSize: 14, color: th.t.ink },
  box: { borderRadius: RADIUS.box, backgroundColor: th.t.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: th.t.ink,
  },
  rowSub: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.2,
    color: th.t.inkSub,
  },
  rowSeparator: {
    position: 'absolute',
    left: 62,
    right: 0,
    bottom: 0,
    height: 0.5,
    backgroundColor: th.t.separator,
  },
  ctaWrap: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.lg },
  cta: {
    height: 54,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { backgroundColor: th.t.primaryDeep },
  ctaLabel: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: th.t.onDark,
  },
}));
