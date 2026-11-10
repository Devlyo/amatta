// 설정 > 캘린더 연동 — ADR-007 §9 / ADR-008 (design board "5 보호자 캘린더 연동").
//
//   보호자 일정 보기   on/off (turning on asks for calendar permission)
//   표시할 캘린더      one check row per device event calendar
//   새 일정 저장 위치   writable calendar for guardian events added in the app
// Permission refused → explanation + a button to the system Settings.

import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { IconCheck } from '../../src/ui/icons';
import { useGuardianStore, visibleCalendarIds } from '../../src/state/guardian-store';
import { RADIUS } from '../../src/ui/radius';
import { TOKENS } from '../../src/ui/palette';
import { SPACING } from '../../src/ui/spacing';
import { TYPE } from '../../src/ui/typography';
import {
  FormActionRow,
  FormGroup,
  FormOptionList,
  FormToggleRow,
  FormValueRow,
} from '../../src/ui/sheets/form-rows';

import { HomeSection } from '../../src/ui/home/HomeSection';
import { DetailTopBar, settingsStyles } from '../../src/ui/settings/SettingsChrome';

export default function CalendarSettingsScreen(): React.ReactElement {
  const router = useRouter();
  const enabled = useGuardianStore((s) => s.enabled);
  const permission = useGuardianStore((s) => s.permission);
  const calendars = useGuardianStore((s) => s.calendars);
  const calendarIds = useGuardianStore((s) => s.calendarIds);
  const writeCalendarId = useGuardianStore((s) => s.writeCalendarId);
  const [writeOpen, setWriteOpen] = useState(false);

  useEffect(() => {
    if (enabled) void useGuardianStore.getState().refreshCalendars();
  }, [enabled]);

  const shown = visibleCalendarIds(calendars, calendarIds);
  const writable = calendars.filter((c) => c.writable);
  const writeTarget = writable.find((c) => c.id === writeCalendarId) ?? null;

  const onToggle = async (on: boolean): Promise<void> => {
    const db = await getDb();
    await useGuardianStore.getState().setEnabled(db, on);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DetailTopBar title="캘린더 연동" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={settingsStyles.content}>
        <View style={settingsStyles.block}>
        <FormGroup>
          <FormToggleRow label="보호자 일정 보기" value={enabled} onChange={(v) => void onToggle(v)} last />
        </FormGroup>
        <Text style={styles.footnote}>
          아이폰 캘린더의 일정을 보호자 일정으로 함께 보여 줘요. 새 일정 화면에서 보호자를 고르면 아이폰
          캘린더에 저장돼요. 일정은 이 기기 밖으로 나가지 않아요.
        </Text>
        </View>

        {permission === 'unavailable' ? (
          <View style={styles.block}>
            <FormGroup>
              <View style={styles.notice}>
                <Text style={styles.noticeText}>지금 설치된 앱에는 캘린더 연동 기능이 없어요. 앱을 최신 버전으로 업데이트해 주세요.</Text>
              </View>
            </FormGroup>
          </View>
        ) : null}

        {permission === 'denied' ? (
          <View style={styles.block}>
            <FormGroup>
              <View style={styles.notice}>
                <Text style={styles.noticeText}>캘린더 접근이 꺼져 있어요. 설정 앱에서 아마따의 캘린더 접근을 켜 주세요.</Text>
              </View>
              <FormActionRow label="설정 열기" onPress={() => void Linking.openSettings()} last />
            </FormGroup>
          </View>
        ) : null}

        {enabled && permission === 'granted' ? (
          <>
            <View style={styles.block}>
              <HomeSection title="표시할 캘린더">
                {calendars.length === 0 ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeText}>이 기기에 캘린더가 없어요.</Text>
                  </View>
                ) : (
                  calendars.map((c, i) => {
                    const on = shown.includes(c.id);
                    return (
                      <View key={c.id}>
                        <Pressable
                          onPress={async () => useGuardianStore.getState().toggleCalendar(await getDb(), c.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={`${c.title}${c.source.length > 0 ? `, ${c.source}` : ''}`}
                          testID={`calendar-row-${c.id}`}
                          style={styles.calRow}
                        >
                          <View style={[styles.calDot, { backgroundColor: c.color }]} />
                          <View style={styles.calText}>
                            <Text style={styles.calTitle} numberOfLines={1}>
                              {c.title}
                            </Text>
                            {c.source.length > 0 ? (
                              <Text style={styles.calSource} numberOfLines={1}>
                                {c.source}
                              </Text>
                            ) : null}
                          </View>
                          {on ? <IconCheck size={18} color={TOKENS.danger} /> : null}
                        </Pressable>
                        {i < calendars.length - 1 ? <View style={styles.separator} /> : null}
                      </View>
                    );
                  })
                )}
              </HomeSection>
            </View>

            {writable.length > 0 ? (
              <View style={styles.block}>
                <HomeSection title="보호자 일정 저장">
                  <FormValueRow
                    label="저장할 캘린더"
                    value={writeTarget?.title ?? '기본 캘린더'}
                    onPress={() => setWriteOpen((o) => !o)}
                    expanded={writeOpen}
                    last
                    testID="row-write-calendar"
                  >
                    <FormOptionList<string | null>
                      options={writable.map((c) => ({ key: c.id, label: c.title }))}
                      selected={writeTarget?.id ?? null}
                      onSelect={async (id) => {
                        if (id === null) return;
                        await useGuardianStore.getState().setWriteCalendar(await getDb(), id);
                        setWriteOpen(false);
                      }}
                      render={(id) => {
                        const c = writable.find((w) => w.id === id);
                        return c !== undefined ? <View style={[styles.calDot, { backgroundColor: c.color }]} /> : null;
                      }}
                    />
                  </FormValueRow>
                </HomeSection>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.groupedBg },
  block: {},
  footnote: { ...TYPE.footnote, color: TOKENS.inkSub, paddingHorizontal: SPACING.xs },
  notice: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  noticeText: { ...TYPE.subhead, color: TOKENS.inkSub },
  calRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  calDot: { width: 12, height: 12, borderRadius: RADIUS.full },
  calText: { flex: 1, minWidth: 0 },
  calTitle: { ...TYPE.row, color: TOKENS.ink },
  calSource: { ...TYPE.footnote, color: TOKENS.inkSub },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: TOKENS.hair, marginLeft: SPACING.lg },
});
