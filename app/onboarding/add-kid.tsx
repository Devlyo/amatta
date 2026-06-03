// Scene 2 — Add Kid (multi-step, in-memory then commit-on-done).
// 1:1 port of docs/design/amatta-v1/app-onboarding.jsx OnbAddKid.
//
// State machine (matches spec lines 153-208):
//   - `registered` holds kids already added in earlier steps (in-memory).
//   - `name` + `avatar` hold the current step's draft. avatar's palette
//     slot is derived 1:1 via AVATAR_KEYS at commit time (see kid-edit).
//   - Step indicator shows {registered.length + 1} / 4.
//   - + 자녀 추가 keeps user on this screen and pushes the draft into
//     `registered` (UI resets to empty for the next slot).
//   - 완료 commits the draft + everything in `registered` into the DB
//     via useChildrenStore.add (in order), then navigates to /.
//   - Back chev pops the last registered kid back into the draft, or
//     routes back to /onboarding/welcome on the first slot.
//
// Sibling-used avatars get disabled in the swatch grid (same uniqueness
// rule as kid-edit). The auto-picked palette slot for the current draft
// is the first AVATAR_KEYS entry not yet used by `registered`.

import { useCallback, useMemo, useState } from 'react';
import {
  Image,
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
import { useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { MAX_CHILDREN } from '../../src/domain/constants';
import {
  AVATAR_KEYS,
  colorIndexForAvatarKey,
  type AvatarKey,
} from '../../src/domain/avatar';
import { useChildrenStore } from '../../src/state/children-store';
import { AVATAR_IMAGE_BY_KEY } from '../../src/ui/assets';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { IconCheck, IconChevronLeft } from '../../src/ui/icons';
import { TOKENS } from '../../src/ui/palette';

const NAME_MAX = 10; // spec: maxLength 10
const STEP_LABELS = ['첫째', '둘째', '셋째', '넷째'] as const;

interface DraftKid {
  name: string;
  avatar: AvatarKey;
}

function nextAvailableAvatar(taken: readonly AvatarKey[]): AvatarKey {
  for (const k of AVATAR_KEYS) {
    if (!taken.includes(k)) return k;
  }
  return AVATAR_KEYS[0];
}

export default function OnbAddKidScreen(): React.ReactElement {
  const router = useRouter();
  const addChild = useChildrenStore((s) => s.add);

  const [registered, setRegistered] = useState<DraftKid[]>([]);

  // Current step's draft. avatar defaults to the first unused AvatarKey
  // so each successive step picks a different colour without the user
  // needing to touch the grid.
  const [name, setName] = useState<string>('');
  const [avatar, setAvatar] = useState<AvatarKey>(AVATAR_KEYS[0]);

  const stepIdx = registered.length;
  const stepNum = stepIdx + 1;
  const isFirst = stepIdx === 0;
  const atLast = stepNum >= MAX_CHILDREN;

  const usedAvatars = useMemo<AvatarKey[]>(
    () => registered.map((r) => r.avatar),
    [registered],
  );

  const canSubmit = name.trim().length > 0;

  const commitAll = useCallback(
    async (allDrafts: readonly DraftKid[]) => {
      const db = await getDb();
      for (const k of allDrafts) {
        await addChild(db, {
          name: k.name,
          avatar: k.avatar,
          colorIndex: colorIndexForAvatarKey(k.avatar),
        });
      }
    },
    [addChild],
  );

  const handleDone = useCallback(async () => {
    if (!canSubmit) return;
    const drafts: DraftKid[] = [
      ...registered,
      { name: name.trim(), avatar },
    ];
    await commitAll(drafts);
    // Daily view is the home screen post-onboarding.
    router.replace('/');
  }, [canSubmit, registered, name, avatar, commitAll, router]);

  const handleAddAnother = useCallback(() => {
    if (!canSubmit) return;
    const nextRegistered: DraftKid[] = [
      ...registered,
      { name: name.trim(), avatar },
    ];
    setRegistered(nextRegistered);
    setName('');
    setAvatar(nextAvailableAvatar(nextRegistered.map((r) => r.avatar)));
  }, [canSubmit, registered, name, avatar]);

  const handleBack = useCallback(() => {
    if (isFirst) {
      router.replace('/onboarding/welcome');
      return;
    }
    const last = registered[registered.length - 1];
    if (last === undefined) return;
    setRegistered(registered.slice(0, -1));
    setName(last.name);
    setAvatar(last.avatar);
  }, [isFirst, registered, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
          style={styles.topBarBack}
        >
          <IconChevronLeft size={22} color={TOKENS.ink} />
        </Pressable>
        <Text style={styles.stepIndicator}>
          {stepNum} <Text style={styles.stepDivider}>/</Text>{' '}
          {MAX_CHILDREN}
        </Text>
        <View style={styles.topBarBack} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Title + sub ────────────────────────────────── */}
          <Text style={styles.title}>
            {isFirst ? '자녀를 알려주세요' : `${STEP_LABELS[stepIdx]}도 알려주세요`}
          </Text>
          <Text style={styles.sub}>
            {isFirst
              ? '언제든 설정에서 추가할 수 있어요 (최대 4명).'
              : '건너뛰고 나중에 추가할 수 있어요.'}
          </Text>

          {/* ── Registered chips — 둘째 onward ─────────────── */}
          {registered.length > 0 ? (
            <View style={styles.chipsRow}>
              <Text style={styles.chipsLabel}>등록 완료</Text>
              {registered.map((k, i) => (
                <View key={`${k.avatar}-${i}`} style={styles.chip}>
                  <View style={styles.chipAvatarWrap}>
                    <Image
                      source={AVATAR_IMAGE_BY_KEY[k.avatar]}
                      style={styles.chipAvatar}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.chipName}>{k.name}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Hero preview ──────────────────────────────── */}
          <View style={styles.heroWrap}>
            <View style={styles.heroRing}>
              <Image
                source={AVATAR_IMAGE_BY_KEY[avatar]}
                style={styles.heroImage}
                resizeMode="contain"
                accessibilityLabel="미리보기"
              />
            </View>
          </View>

          {/* ── 이름 ──────────────────────────────────────── */}
          <Text style={styles.fieldLabel}>이름</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="자녀 이름"
            placeholderTextColor={TOKENS.inkSub}
            maxLength={NAME_MAX}
            autoFocus={isFirst}
            style={styles.nameInput}
            accessibilityLabel="자녀 이름"
            testID="onb-name-input"
          />

          {/* ── 아바타 4-col ──────────────────────────────── */}
          <Text style={styles.fieldLabel}>아바타</Text>
          <View style={styles.avatarGrid}>
            {AVATAR_KEYS.map((k) => {
              const active = k === avatar;
              const takenByOther = usedAvatars.includes(k);
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
                    styles.avatarSwatch,
                    active
                      ? styles.avatarSwatchActive
                      : styles.avatarSwatchIdle,
                    disabled ? styles.avatarSwatchDisabled : null,
                  ]}
                >
                  <Image
                    source={AVATAR_IMAGE_BY_KEY[k]}
                    style={styles.swatchImage}
                    resizeMode="contain"
                  />
                  {active ? (
                    <View style={styles.checkChip}>
                      <IconCheck size={10} color={TOKENS.surface} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* ── Bottom CTAs ────────────────────────────────── */}
        <View style={styles.ctaStack}>
          <Pressable
            onPress={() => void handleDone()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="완료"
            accessibilityState={{ disabled: !canSubmit }}
            style={({ pressed }) => [
              styles.primaryCta,
              !canSubmit ? styles.primaryCtaDisabled : null,
              pressed && canSubmit ? styles.primaryCtaPressed : null,
            ]}
          >
            <Text style={styles.primaryCtaLabel}>완료</Text>
          </Pressable>
          {!atLast ? (
            <Pressable
              onPress={handleAddAnother}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="자녀 추가"
              accessibilityState={{ disabled: !canSubmit }}
              style={({ pressed }) => [
                styles.ghostCta,
                pressed && canSubmit ? styles.ghostCtaPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.ghostCtaLabel,
                  !canSubmit ? styles.ghostCtaLabelDisabled : null,
                ]}
              >
                + 자녀 추가
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },
  flex: { flex: 1 },

  // ─── Top bar ─────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
  },
  topBarBack: {
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepIndicator: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.inkSub,
    letterSpacing: 0,
  },
  stepDivider: { color: TOKENS.ink30 },

  scroll: { paddingHorizontal: 22, paddingBottom: 24 },

  // ─── Title block ────────────────────────────────────────
  title: {
    fontSize: 22,
    fontFamily: FONT_FAMILIES.pretendardBold,
    color: TOKENS.ink,
    letterSpacing: -0.5,
    lineHeight: 29, // ≈ 1.3 of 22
    marginTop: 6,
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    lineHeight: 20,
  },

  // ─── Registered chips ───────────────────────────────────
  chipsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chipsLabel: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: 0.2,
    marginRight: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink04,
  },
  chipAvatarWrap: {
    width: 22,
    height: 22,
    borderRadius: 9999,
    backgroundColor: TOKENS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipAvatar: { width: 20, height: 20 },
  chipName: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },

  // ─── Hero ──────────────────────────────────────────────
  heroWrap: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  heroRing: {
    width: 132,
    height: 132,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { width: 102, height: 102 },

  // ─── Name input ────────────────────────────────────────
  fieldLabel: {
    paddingTop: 20,
    paddingHorizontal: 2,
    paddingBottom: 8,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  nameInput: {
    width: '100%',
    backgroundColor: TOKENS.ink04,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },

  // ─── Avatar 4-col grid ─────────────────────────────────
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  avatarSwatch: {
    flexBasis: '23%',
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSwatchIdle: { backgroundColor: TOKENS.ink04 },
  avatarSwatchActive: {
    backgroundColor: TOKENS.ink12,
    borderWidth: 2,
    borderColor: TOKENS.ink,
  },
  avatarSwatchDisabled: { opacity: 0.35 },
  swatchImage: { width: 48, height: 48 },
  checkChip: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Bottom CTAs ────────────────────────────────────────
  ctaStack: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
    gap: 8,
  },
  primaryCta: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaPressed: { opacity: 0.85 },
  primaryCtaDisabled: { backgroundColor: 'rgba(29,29,27,0.18)' },
  primaryCtaLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
    letterSpacing: -0.3,
  },
  ghostCta: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: TOKENS.ink04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostCtaPressed: { opacity: 0.85 },
  ghostCtaLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  ghostCtaLabelDisabled: { color: TOKENS.ink30 },
});
