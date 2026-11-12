// Kid edit / create — full-screen route, 1:1 layout port of
// docs/design/amatta-v1/app-settings-kids.jsx KidEdit (screen #2).
//
// Routing: pushed from /settings/kids with optional `id` query param.
//   - present  → edit mode (loads existing child)
//   - absent   → create mode
//
// Per user direction (2026-06-03), avatar and palette are LOCKED 1:1
// via AVATAR_KEYS — selecting an avatar implicitly chooses the palette
// slot too. The picker dispatches both fields together.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { MAX_CHILDREN } from '../../src/domain/constants';
import { AVATAR_KEYS, colorIndexForAvatarKey, nextAvailableAvatar, type AvatarKey } from '../../src/domain/avatar';
import type { Child } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { HomeSection } from '../../src/ui/home/HomeSection';
import { IconCheck } from '../../src/ui/icons';
import { FormActionRow, FormGroup, FormInputRow } from '../../src/ui/sheets/form-rows';
import { SettingsDetailScreen, useSettingsStyles } from '../../src/ui/settings/SettingsChrome';
import { AVATAR_IMAGE_BY_KEY } from '../../src/ui/assets';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';
import { makeStyles, useTheme } from '../../src/ui/appearance';

const NAME_MAX = 10; // app-settings-kids.jsx:231 maxLength={10}

export default function KidEditScreen(): React.ReactElement {
  const ss = useSettingsStyles();
  const theme = useTheme();
  const styles = useStyles();
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
  // Avatar is the source of truth; colorIndex is derived via the 1:1
  // AVATAR_KEYS map at save-time (and for the palette ring rendering).
  // A new kid starts on the first avatar nobody uses (owner 2026-11-12: it was
  // always the pink one, already taken → the duplicate could be saved).
  const [avatar, setAvatar] = useState<AvatarKey>(
    () => existing?.avatar ?? nextAvailableAvatar(children.map((c) => c.avatar)),
  );

  // Sync local state once existing child becomes available (store may load
  // after the screen mounts).
  useEffect(() => {
    if (existing === undefined) return;
    setName(existing.name);
    setAvatar(existing.avatar);
  }, [existing]);

  const trimmedName = name.trim();
  const avatarTaken = children.some((c) => c.avatar === avatar && (existing === undefined || c.id !== existing.id));
  const canSave = trimmedName.length > 0 && trimmedName.length <= NAME_MAX && !avatarTaken;

  const handleSave = useCallback(async (): Promise<void> => {
    if (!canSave) return;
    const db = await getDb();
    const colorIndex = colorIndexForAvatarKey(avatar);
    try {
      if (existing === undefined) {
        await addChild(db, { name: trimmedName, colorIndex, avatar });
      } else {
        await updateChild(db, existing.id, { name: trimmedName, colorIndex, avatar });
      }
    } catch (e) {
      // e.g. ChildCapError — show it instead of an unhandled promise rejection.
      Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : String(e));
      return;
    }
    router.back();
  }, [canSave, existing, addChild, updateChild, trimmedName, avatar, router]);

  const handleDelete = useCallback((): void => {
    if (existing === undefined) return;
    const kidName = existing.name;
    // ADR-013: schedules shared with another kid stay (without this kid).
    const shared = useSchedulesStore
      .getState()
      .schedules.some((s) => s.memberIds.includes(existing.id) && s.memberIds.length > 1);
    Alert.alert(
      `${kidName}을(를) 삭제할까요?`,
      shared
        ? `${kidName}의 일정·준비물·할일이 삭제돼요. 다른 아이와 함께하는 일정은 남아요. 이 작업은 되돌릴 수 없어요.`
        : `${kidName}의 일정·준비물·할일이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.`,
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

  return (
    <SettingsDetailScreen
      title={isNew ? '자녀 추가' : '자녀 편집'}
      onBack={() => router.back()}
      rightLabel="저장"
      rightDisabled={!canSave}
      onRight={() => void handleSave()}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero — large avatar preview. */}
      <View style={styles.heroWrap}>
        <View style={styles.heroRing}>
          <Image
            source={AVATAR_IMAGE_BY_KEY[avatar]}
            style={styles.heroImage}
            resizeMode="contain"
            accessibilityLabel={trimmedName.length > 0 ? trimmedName : '미리보기'}
          />
        </View>
      </View>

      <HomeSection title="이름">
        <FormInputRow
          value={name}
          onChangeText={setName}
          placeholder="자녀 이름"
          maxLength={NAME_MAX}
          testID="kid-edit-name-input"
          accessibilityLabel="자녀 이름 입력"
          last
        />
      </HomeSection>

      {/* 아바타 — 6 face swatches (AVATAR_KEYS order). The avatar picks the
          palette too (1:1); avatars used by a sibling are disabled. */}
      <HomeSection title="아바타">
        <View style={styles.colorGrid}>
          {AVATAR_KEYS.map((k) => {
            const active = k === avatar;
            const takenByOther = children.some(
              (c) => c.avatar === k && (existing === undefined || c.id !== existing.id),
            );
            const disabled = takenByOther && !active;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  if (disabled) return;
                  setAvatar(k);
                }}
                accessibilityRole="button"
                accessibilityLabel={k}
                accessibilityState={{ selected: active, disabled }}
                style={[
                  styles.colorSwatch,
                  active ? styles.colorSwatchActive : styles.colorSwatchIdle,
                  disabled ? styles.colorSwatchDisabled : null,
                ]}
              >
                <Image source={AVATAR_IMAGE_BY_KEY[k]} style={styles.swatchImage} resizeMode="contain" />
                {active ? (
                  <View style={styles.colorCheckChip}>
                    <IconCheck size={11} color={theme.t.surface} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </HomeSection>

      {/* 삭제 — edit mode only. */}
      {!isNew && existing !== undefined ? (
        <View style={ss.block}>
          <FormGroup>
            <FormActionRow label={`${existing.name} 삭제`} tone="danger" onPress={handleDelete} last />
          </FormGroup>
          <Text style={ss.footnote}>이 자녀의 일정과 준비물도 모두 삭제돼요.</Text>
        </View>
      ) : null}
    </SettingsDetailScreen>
  );
}

const useStyles = makeStyles((th) => ({
  heroWrap: { alignItems: 'center', paddingTop: SPACING.sm },
  heroRing: {
    width: 128,
    height: 128,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { width: 100, height: 100 },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.md,
    padding: SPACING.lg,
  },
  colorSwatch: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.box,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  colorSwatchIdle: { borderColor: 'transparent', backgroundColor: th.t.groupedBg },
  colorSwatchActive: { borderColor: th.t.ink, backgroundColor: th.t.groupedBg },
  colorSwatchDisabled: { opacity: 0.3 },
  swatchImage: { width: 56, height: 56 },
  colorCheckChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
