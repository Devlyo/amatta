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
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { MAX_CHILDREN, PALETTE } from '../../src/domain/constants';
import { avatarKeyForColorIndex } from '../../src/domain/avatar';
import type { Child, ColorIndex } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { ColorDot } from '../../src/ui/common/ColorDot';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
} from '../../src/ui/icons';
import { getKidPalette, TOKENS } from '../../src/ui/palette';

const NAME_MAX = 10; // app-settings-kids.jsx:231 maxLength={10}

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

  // Sync local state once existing child becomes available (store may load
  // after the screen mounts).
  useEffect(() => {
    if (existing === undefined) return;
    setName(existing.name);
    setColorIndex(existing.colorIndex);
  }, [existing]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && trimmedName.length <= NAME_MAX;

  const handleSave = useCallback(async (): Promise<void> => {
    if (!canSave) return;
    const db = await getDb();
    if (existing === undefined) {
      // avatar paired 1:1 with colorIndex per AVATAR_KEYS — once the
      // avatar picker lands the colorIndex will be derived from the
      // chosen avatar instead. Right now they're locked together.
      const avatar = avatarKeyForColorIndex(colorIndex);
      await addChild(db, { name: trimmedName, colorIndex, avatar });
    } else {
      const avatar = avatarKeyForColorIndex(colorIndex);
      await updateChild(db, existing.id, { name: trimmedName, colorIndex, avatar });
    }
    router.back();
  }, [canSave, existing, addChild, updateChild, trimmedName, colorIndex, router]);

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
          {/* ── Hero — large color preview circle.
              Spec: 140 white ring + AvatarPH size 108. We use a 108
              palette-source disc until the avatar field ships. */}
          <View style={styles.heroWrap}>
            <View style={styles.heroRing}>
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

          {/* ── 아바타 (avatar 도입 전까지 6-color 시각 picker 유지) ── */}
          <SectionHeader label="아바타" />
          <View style={styles.cardTight}>
            <View style={styles.colorGrid}>
              {PALETTE.map((_hex, idx) => {
                const i = idx as ColorIndex;
                const active = i === colorIndex;
                // Sibling kids occupying this color (excluding the one
                // being edited) — those swatches are disabled.
                const takenByOther = children.some(
                  (c) =>
                    c.colorIndex === i &&
                    (existing === undefined || c.id !== existing.id),
                );
                const disabled = takenByOther && !active;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      if (disabled) return;
                      setColorIndex(i);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`아바타 ${i + 1}`}
                    accessibilityState={{ selected: active, disabled }}
                    style={[
                      styles.colorSwatch,
                      active
                        ? styles.colorSwatchActive
                        : styles.colorSwatchIdle,
                      disabled ? styles.colorSwatchDisabled : null,
                    ]}
                  >
                    <ColorDot colorIndex={i} size={56} />
                    {active ? (
                      <View style={styles.colorCheckChip}>
                        <IconCheck size={11} color={TOKENS.surface} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── 삭제 (편집 모드일 때만).
              Spec: DestructiveRow uses RowFrame padding 7/10 + RowText
              (label + sub) + ChevR colored to A.danger. */}
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
                  <IconChevronRight size={16} color={TOKENS.danger} />
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
  // Spec: AvatarPH size=108 inside 140 ring.
  heroDot: {
    width: 108,
    height: 108,
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
  // Spec: '14px 14px 6px'.
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
  // Tight variant — no bottom margin. Used by the 아바타 section so the
  // grid stops flush with the trailing 삭제 card spacer above.
  cardTight: {
    backgroundColor: TOKENS.surface,
    borderRadius: 16,
    padding: 4,
    marginBottom: 0,
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

  // --- Avatar grid (spec: 4-col, gap 6, padding 4) ------------------
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 4,
  },
  // 3-per-row (user override of the spec's 4-col grid — fits the 6
  // palette slots exactly in 2 rows of 3 without trailing empty cells).
  // Cell padding '14px 0', borderRadius 14 retained from spec.
  colorSwatch: {
    flexBasis: '31%',
    flexGrow: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  colorSwatchIdle: {
    backgroundColor: TOKENS.ink04,
  },
  colorSwatchActive: {
    backgroundColor: TOKENS.surface,
    borderWidth: 2,
    borderColor: TOKENS.ink,
  },
  colorSwatchDisabled: {
    opacity: 0.35,
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

  // --- Destructive row ------------------------------------------------
  // Spec: RowFrame padding '7px 10px' borderRadius 12 + ChevR colored danger.
  spacer16: { height: 16 },
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  destructiveText: { flex: 1, minWidth: 0 },
  destructiveTitle: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.danger,
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  destructiveSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.1,
    lineHeight: 16,
  },

  bottomSpacer: { height: 32 },
});
