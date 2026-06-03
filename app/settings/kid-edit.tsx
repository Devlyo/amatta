// Kid edit / create — full-screen route, 1:1 layout port of
// docs/design/amatta-v1/app-settings-kids.jsx KidEdit (screen #2).
//
// Routing: pushed from /settings/kids with optional `id` query param.
//   - present  → edit mode (loads child from store + notification setting
//                from repo)
//   - absent   → create mode
//
// Avatar-from-spec is DEFERRED — the Child schema has no `avatar` column
// yet. The hero + the '아바타' grid below show the kid's color (6-swatch
// palette) instead until the avatar field ships in its own ralplan.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { MAX_CHILDREN, PALETTE } from '../../src/domain/constants';
import type {
  Child,
  ColorIndex,
  NotificationSetting,
} from '../../src/domain/types';
import { notificationSettingsRepo } from '../../src/db/repositories';
import { useChildrenStore } from '../../src/state/children-store';
import { ColorDot } from '../../src/ui/common/ColorDot';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { IconCheck, IconChevronLeft } from '../../src/ui/icons';
import { getKidPalette, TOKENS } from '../../src/ui/palette';

const NAME_MAX = 20;
const NOTIFY_OPTIONS: readonly number[] = [5, 10, 15, 30, 60] as const;

export default function KidEditScreen(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = params.id;

  const children = useChildrenStore((s) => s.children);
  const addChild = useChildrenStore((s) => s.add);
  const updateChild = useChildrenStore((s) => s.updateOne);
  const removeChild = useChildrenStore((s) => s.removeOne);

  const editingId = useMemo<number | null>(() => {
    if (typeof idParam !== 'string') return null;
    const n = Number.parseInt(idParam, 10);
    return Number.isFinite(n) ? n : null;
  }, [idParam]);
  const isNew = editingId === null;

  const existing: Child | undefined = useMemo(() => {
    if (editingId === null) return undefined;
    return children.find((c) => c.id === editingId);
  }, [children, editingId]);

  // Hard cap guard — even if the URL is hit directly, redirect back when
  // creation would exceed the 4-kid limit.
  useEffect(() => {
    if (isNew && children.length >= MAX_CHILDREN) {
      router.back();
    }
  }, [isNew, children.length, router]);

  const [name, setName] = useState<string>(existing?.name ?? '');
  const [colorIndex, setColorIndex] = useState<ColorIndex>(
    existing?.colorIndex ?? 0,
  );
  const [notifyMinutesBefore, setNotifyMinutesBefore] = useState<number>(15);
  const [notifySound, setNotifySound] = useState<boolean>(true);
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(true);
  const [notifyLoaded, setNotifyLoaded] = useState<boolean>(isNew);

  // Sync local state once existing child becomes available (store may load
  // after the screen mounts).
  useEffect(() => {
    if (existing === undefined) return;
    setName(existing.name);
    setColorIndex(existing.colorIndex);
  }, [existing]);

  // Load notification settings for edit mode.
  useEffect(() => {
    if (existing === undefined) return;
    let cancelled = false;
    void (async () => {
      const db = await getDb();
      const setting: NotificationSetting | null =
        await notificationSettingsRepo.getByChildId(db, existing.id);
      if (cancelled) return;
      if (setting !== null) {
        setNotifyMinutesBefore(setting.defaultMinutesBefore);
        setNotifySound(setting.sound);
        setNotifyEnabled(setting.enabled);
      }
      setNotifyLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [existing]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && trimmedName.length <= NAME_MAX;

  const handleSave = useCallback(async (): Promise<void> => {
    if (!canSave) return;
    const db = await getDb();
    let savedId: number;
    if (existing === undefined) {
      const created = await addChild(db, {
        name: trimmedName,
        colorIndex,
      });
      savedId = created.id;
    } else {
      await updateChild(db, existing.id, {
        name: trimmedName,
        colorIndex,
      });
      savedId = existing.id;
    }
    // Persist notification settings — only write once they've finished
    // loading (avoids stomping defaults during the initial async fetch).
    if (notifyLoaded) {
      const existingSetting = await notificationSettingsRepo.getByChildId(
        db,
        savedId,
      );
      if (existingSetting === null) {
        await notificationSettingsRepo.create(db, {
          childId: savedId,
          defaultMinutesBefore: notifyMinutesBefore,
          sound: notifySound,
          enabled: notifyEnabled,
        });
      } else {
        await notificationSettingsRepo.update(db, savedId, {
          defaultMinutesBefore: notifyMinutesBefore,
          sound: notifySound,
          enabled: notifyEnabled,
        });
      }
    }
    router.back();
  }, [
    canSave,
    existing,
    addChild,
    updateChild,
    trimmedName,
    colorIndex,
    notifyLoaded,
    notifyMinutesBefore,
    notifySound,
    notifyEnabled,
    router,
  ]);

  const handleDelete = useCallback((): void => {
    if (existing === undefined) return;
    const kidName = existing.name;
    Alert.alert(
      `${kidName}을(를) 삭제할까요?`,
      `${kidName}의 일정·준비물·할일이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제하기',
          style: 'destructive',
          onPress: async () => {
            const db = await getDb();
            await removeChild(db, existing.id);
            router.back();
          },
        },
      ],
    );
  }, [existing, removeChild, router]);

  const palette = getKidPalette(colorIndex);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DetailTopBar
        title={isNew ? '자녀 추가' : '자녀 편집'}
        onBack={() => router.back()}
        rightLabel="저장"
        rightDisabled={!canSave}
        onRight={() => void handleSave()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero — large color preview circle ─────────────────── */}
          <View style={styles.heroWrap}>
            <View style={[styles.heroRing, { backgroundColor: palette.bg }]}>
              <View
                style={[
                  styles.heroDot,
                  { backgroundColor: palette.source },
                ]}
              />
            </View>
            <Text style={styles.heroEyebrow}>PREVIEW</Text>
          </View>

          {/* ── 이름 ────────────────────────────────────────────── */}
          <SectionHeader label="이름" />
          <View style={styles.card}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="자녀 이름"
              placeholderTextColor={TOKENS.inkSub}
              maxLength={NAME_MAX}
              style={styles.nameInput}
              testID="kid-edit-name-input"
              accessibilityLabel="자녀 이름 입력"
            />
          </View>

          {/* ── 색상 (시안의 '아바타' 자리; avatar 도입 전까지 색상 그리드) */}
          <SectionHeader label="색상" />
          <View style={styles.card}>
            <View style={styles.colorGrid}>
              {PALETTE.map((_hex, idx) => {
                const i = idx as ColorIndex;
                const active = i === colorIndex;
                const pal = getKidPalette(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setColorIndex(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`색상 ${i + 1}`}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.colorSwatch,
                      active
                        ? styles.colorSwatchActive
                        : styles.colorSwatchIdle,
                    ]}
                  >
                    <ColorDot colorIndex={i} size={36} />
                    {active ? (
                      <View style={styles.colorCheckChip}>
                        <IconCheck size={11} color={TOKENS.surface} />
                      </View>
                    ) : null}
                    {/* Light static label so palette names are visible without
                        depending on the avatar surface. */}
                    <Text style={styles.colorSwatchLabel}>
                      {COLOR_LABEL_KO[i]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── 알림 (시안엔 없지만 스키마 boundary 동일 화면 유지) */}
          <SectionHeader label="알림" />
          <View style={styles.card}>
            <View style={styles.notifyRow}>
              <Text style={styles.notifyLabel}>기본 알림 시점</Text>
              <View style={styles.chipRow}>
                {NOTIFY_OPTIONS.map((m) => {
                  const active = notifyMinutesBefore === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setNotifyMinutesBefore(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`${m}분 전`}
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, active ? styles.chipActive : null]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          active ? styles.chipLabelActive : null,
                        ]}
                      >
                        {m}분 전
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.notifyToggleRow}>
              <Text style={styles.notifyLabel}>알림 활성화</Text>
              <Switch value={notifyEnabled} onValueChange={setNotifyEnabled} />
            </View>
            <View style={styles.notifyToggleRow}>
              <Text style={styles.notifyLabel}>알림 소리</Text>
              <Switch value={notifySound} onValueChange={setNotifySound} />
            </View>
          </View>

          {/* ── 삭제 (편집 모드일 때만) ────────────────────────── */}
          {!isNew && existing !== undefined ? (
            <>
              <View style={styles.spacer16} />
              <View style={styles.card}>
                <Pressable
                  onPress={handleDelete}
                  accessibilityRole="button"
                  accessibilityLabel={`${existing.name} 삭제`}
                  style={styles.destructiveRow}
                >
                  <View style={styles.destructiveText}>
                    <Text style={styles.destructiveTitle}>
                      {existing.name} 삭제
                    </Text>
                    <Text style={styles.destructiveSub}>
                      이 자녀의 일정과 준비물도 모두 삭제돼요
                    </Text>
                  </View>
                </Pressable>
              </View>
            </>
          ) : null}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const COLOR_LABEL_KO: readonly string[] = [
  '핑크',
  '민트',
  '하늘',
  '피치',
  '시트러스',
  '라벤더',
] as const;

// ───────────────────────────────────────────────────────────────────
// Detail top bar — mirrors the one in /settings/kids. Kept local to
// the route file until a shared variant is needed by a third screen.
// ───────────────────────────────────────────────────────────────────
function DetailTopBar({
  title,
  onBack,
  rightLabel,
  rightDisabled,
  onRight,
}: {
  title: string;
  onBack: () => void;
  rightLabel?: string;
  rightDisabled?: boolean;
  onRight?: () => void;
}): React.ReactElement {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        hitSlop={8}
        style={styles.topBarBack}
      >
        <IconChevronLeft size={22} color={TOKENS.ink} />
      </Pressable>
      <Text style={styles.topBarTitle}>{title}</Text>
      <View style={styles.topBarRight}>
        {rightLabel !== undefined ? (
          <Pressable
            onPress={rightDisabled ? undefined : onRight}
            disabled={rightDisabled}
            accessibilityRole="button"
            accessibilityLabel={rightLabel}
            hitSlop={8}
          >
            <Text
              style={[
                styles.topBarRightLabel,
                rightDisabled ? styles.topBarRightLabelDisabled : null,
              ]}
            >
              {rightLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SectionHeader({ label }: { label: string }): React.ReactElement {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surfaceSoft },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: TOKENS.surfaceSoft,
  },
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
  topBarRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  topBarRightLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.primary,
    letterSpacing: -0.3,
  },
  topBarRightLabelDisabled: { color: TOKENS.ink30 },

  scroll: { paddingHorizontal: 14, paddingBottom: 32 },

  // --- Hero -----------------------------------------------------------
  heroWrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 10,
  },
  heroRing: {
    width: 140,
    height: 140,
    borderRadius: 9999,
    backgroundColor: TOKENS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDot: {
    width: 84,
    height: 84,
    borderRadius: 9999,
  },
  heroEyebrow: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.inkSub,
    letterSpacing: 0.4,
  },

  // --- Section / Card -------------------------------------------------
  sectionHeader: {
    paddingHorizontal: 4,
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

  // --- Name input -----------------------------------------------------
  nameInput: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.3,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  // --- Color grid -----------------------------------------------------
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 4,
  },
  colorSwatch: {
    flexBasis: '31%',
    flexGrow: 1,
    aspectRatio: 1.05,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  colorSwatchIdle: {
    backgroundColor: TOKENS.ink04,
  },
  colorSwatchActive: {
    backgroundColor: TOKENS.surface,
    borderWidth: 2,
    borderColor: TOKENS.ink,
  },
  colorCheckChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchLabel: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },

  // --- Notify ---------------------------------------------------------
  notifyRow: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },
  notifyLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink04,
  },
  chipActive: { backgroundColor: TOKENS.ink },
  chipLabel: {
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  chipLabelActive: { color: TOKENS.surface },
  notifyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  // --- Destructive row ------------------------------------------------
  spacer16: { height: 16 },
  destructiveRow: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  destructiveText: { flex: 1, gap: 2 },
  destructiveTitle: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.danger,
    letterSpacing: -0.3,
  },
  destructiveSub: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.1,
    lineHeight: 16,
  },

  bottomSpacer: { height: 32 },
});
