// Onboarding 2 — Add kids (design canvas "O2 첫째 등록" / "O3 둘째 등록").
//
// State machine (unchanged):
//   - `registered` holds kids already added in earlier steps (in-memory).
//   - `name` + `avatar` hold the current step's draft; the palette slot is
//     derived 1:1 from the avatar (colorIndexForAvatarKey).
//   - "+ 다음 아이도 추가" pushes the draft into `registered` and resets.
//   - 완료 commits everything to the DB (in order), then goes on to the
//     finish step (알림 · 보호자 일정).
//   - Back pops the last registered kid back into the draft, or returns to
//     the welcome screen on the first slot.
//
// A face a sibling already uses is dimmed and shows that sibling's name.

import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { MAX_CHILDREN } from '../../src/domain/constants';
import { AVATAR_KEYS, colorIndexForAvatarKey, type AvatarKey } from '../../src/domain/avatar';
import { useChildrenStore } from '../../src/state/children-store';
import { AVATAR_IMAGE_BY_KEY } from '../../src/ui/assets';
import { AVATAR_CIRCLE_ALPHA } from '../../src/ui/common/KidAvatar';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { IconCheck, IconChevronLeft } from '../../src/ui/icons';
import { withAlpha } from '../../src/ui/palette';
import { RADIUS } from '../../src/ui/radius';
import { SPACING } from '../../src/ui/spacing';
import { makeStyles, useTheme } from '../../src/ui/appearance';

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

/** One dot per kid slot: done = faded orange, current = orange bar. */
function StepDots({ current }: { current: number }): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.dots} accessible accessibilityLabel={`${current + 1}번째 아이, 최대 ${MAX_CHILDREN}명`}>
      {Array.from({ length: MAX_CHILDREN }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current ? styles.dotCurrent : i < current ? styles.dotDone : null]}
        />
      ))}
    </View>
  );
}

export default function OnbAddKidScreen(): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const addChild = useChildrenStore((s) => s.add);

  const [registered, setRegistered] = useState<DraftKid[]>([]);
  const [name, setName] = useState<string>('');
  const [avatar, setAvatar] = useState<AvatarKey>(AVATAR_KEYS[0]);

  const stepIdx = registered.length;
  const isFirst = stepIdx === 0;
  const atLast = stepIdx + 1 >= MAX_CHILDREN;

  // Face → the sibling who already has it.
  const takenBy = useMemo(() => new Map(registered.map((r) => [r.avatar, r.name])), [registered]);
  const canSubmit = name.trim().length > 0;
  const palette = theme.kid(colorIndexForAvatarKey(avatar));

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
    const drafts: DraftKid[] = [...registered, { name: name.trim(), avatar }];
    try {
      await commitAll(drafts);
    } catch (e) {
      Alert.alert('아이를 추가하지 못했어요', e instanceof Error ? e.message : String(e));
      return;
    }
    router.replace('/onboarding/finish');
  }, [canSubmit, registered, name, avatar, commitAll, router]);

  const handleAddAnother = useCallback(() => {
    if (!canSubmit) return;
    const nextRegistered: DraftKid[] = [...registered, { name: name.trim(), avatar }];
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
          style={styles.topBarSide}
        >
          <IconChevronLeft size={24} color={theme.t.ink} />
        </Pressable>
        <StepDots current={stepIdx} />
        <View style={styles.topBarSide} />
      </View>

      {/* No KeyboardAvoidingView — the keyboard covering the bottom buttons
          reads more naturally than buttons glued to it. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title} accessibilityRole="header">
          {`${STEP_LABELS[stepIdx] ?? '다음'} 아이를\n알려 주세요`}
        </Text>
        <Text style={styles.sub}>{`나중에 설정에서 더 추가할 수 있어요 (최대 ${MAX_CHILDREN}명)`}</Text>

        {registered.length > 0 ? (
          <View style={styles.chipsRow}>
            <Text style={styles.chipsLabel}>등록한 아이</Text>
            {registered.map((k) => (
              <View key={k.avatar} style={styles.chip}>
                <View
                  style={[
                    styles.chipCircle,
                    { backgroundColor: withAlpha(theme.kid(colorIndexForAvatarKey(k.avatar)).source, AVATAR_CIRCLE_ALPHA) },
                  ]}
                >
                  <Image source={AVATAR_IMAGE_BY_KEY[k.avatar]} style={styles.chipAvatar} resizeMode="contain" />
                </View>
                <Text style={styles.chipName}>{k.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.heroWrap, registered.length > 0 ? styles.heroWrapTight : null]}>
          <View style={[styles.heroRing, { backgroundColor: withAlpha(palette.source, 0.38) }]}>
            <Image
              source={AVATAR_IMAGE_BY_KEY[avatar]}
              style={styles.heroImage}
              resizeMode="contain"
              accessibilityLabel="미리보기"
            />
          </View>
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="이름"
          placeholderTextColor={theme.t.ink30}
          selectionColor={theme.t.primary}
          maxLength={NAME_MAX}
          style={styles.nameInput}
          accessibilityLabel="아이 이름"
          testID="onb-name-input"
        />

        <View style={styles.faceHeader}>
          <Text style={styles.faceLabel}>아바타</Text>
        </View>
        <View style={styles.faceBox}>
          {AVATAR_KEYS.map((k) => {
            const active = k === avatar;
            const owner = takenBy.get(k);
            const disabled = owner !== undefined && !active;
            const p = theme.kid(colorIndexForAvatarKey(k));
            return (
              <Pressable
                key={k}
                onPress={() => {
                  if (!disabled) setAvatar(k);
                }}
                accessibilityRole="button"
                accessibilityLabel={owner !== undefined ? `${k}, ${owner}` : k}
                accessibilityState={{ selected: active, disabled }}
                style={[
                  styles.faceCell,
                  active
                    ? { backgroundColor: withAlpha(p.source, 0.32), borderColor: p.deep }
                    : null,
                ]}
              >
                <Image
                  source={AVATAR_IMAGE_BY_KEY[k]}
                  style={[styles.faceImage, disabled ? styles.faceImageTaken : null]}
                  resizeMode="contain"
                />
                {active ? (
                  <View style={[styles.checkChip, { backgroundColor: p.deep }]}>
                    <IconCheck size={12} color={theme.t.onDark} />
                  </View>
                ) : null}
                {disabled ? (
                  <Text style={styles.faceOwner} numberOfLines={1}>
                    {owner}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.ctaStack}>
        <Pressable
          onPress={() => void handleDone()}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="완료"
          accessibilityState={{ disabled: !canSubmit }}
          style={({ pressed }) => [
            styles.cta,
            !canSubmit ? styles.ctaDisabled : null,
            pressed && canSubmit ? styles.ctaPressed : null,
          ]}
        >
          <Text style={[styles.ctaLabel, !canSubmit ? styles.ctaLabelDisabled : null]}>완료</Text>
        </Pressable>
        {!atLast ? (
          <Pressable
            onPress={handleAddAnother}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="다음 아이도 추가"
            accessibilityState={{ disabled: !canSubmit }}
            hitSlop={6}
            style={({ pressed }) => [styles.more, pressed && canSubmit ? styles.morePressed : null]}
          >
            <Text style={[styles.moreLabel, !canSubmit ? styles.moreLabelDisabled : null]}>
              + 다음 아이도 추가
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((th) => ({
  safe: { flex: 1, backgroundColor: th.t.groupedBg },
  flex: { flex: 1 },

  // ─── Top bar ─────────────────────────────────────────────
  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  topBarSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: RADIUS.full, backgroundColor: th.t.ink12 },
  dotDone: { backgroundColor: withAlpha(th.t.primary, 0.45) },
  dotCurrent: { width: 18, backgroundColor: th.t.primary },

  scroll: { paddingHorizontal: SPACING.xl, paddingTop: 6, paddingBottom: SPACING.xl },

  // ─── Title ───────────────────────────────────────────────
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

  // ─── Registered kids ─────────────────────────────────────
  chipsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  chipsLabel: { fontFamily: FONT_FAMILIES.pretendard, fontSize: 13, color: th.t.inkSub },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: SPACING.xs,
    paddingRight: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.surface,
  },
  chipCircle: { width: 26, height: 26, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipAvatar: { width: 24, height: 24 },
  chipName: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 14,
    letterSpacing: -0.2,
    color: th.t.ink,
  },

  // ─── Hero ────────────────────────────────────────────────
  heroWrap: { alignItems: 'center', paddingTop: SPACING.xxl, paddingBottom: 18 },
  heroWrapTight: { paddingTop: 18 },
  heroRing: {
    width: 128,
    height: 128,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { width: 112, height: 112 },

  // ─── Name ────────────────────────────────────────────────
  nameInput: {
    height: 54,
    borderRadius: RADIUS.box,
    backgroundColor: th.t.surface,
    paddingHorizontal: SPACING.lg,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    fontSize: 17,
    letterSpacing: -0.3,
    color: th.t.ink,
  },

  // ─── Faces ───────────────────────────────────────────────
  faceHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  faceLabel: { fontFamily: FONT_FAMILIES.pretendardSemiBold, fontSize: 13, color: th.t.inkSub },
  faceBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    padding: 10,
    borderRadius: RADIUS.box,
    backgroundColor: th.t.surface,
  },
  faceCell: {
    flexBasis: '30%',
    flexGrow: 1,
    height: 84,
    borderRadius: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: th.t.ink04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceImage: { width: 60, height: 60 },
  faceImageTaken: { opacity: 0.35 },
  faceOwner: {
    position: 'absolute',
    bottom: 5,
    left: SPACING.xs,
    right: SPACING.xs,
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 11,
    color: th.t.inkSub,
  },
  checkChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Bottom buttons ──────────────────────────────────────
  ctaStack: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cta: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { backgroundColor: th.t.primaryDeep },
  ctaDisabled: { backgroundColor: th.t.ink12 },
  ctaLabel: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: th.t.onDark,
  },
  ctaLabelDisabled: { color: th.t.ink30 },
  more: { height: 40, paddingHorizontal: SPACING.lg, justifyContent: 'center' },
  morePressed: { opacity: 0.6 },
  moreLabel: {
    fontFamily: FONT_FAMILIES.pretendardMedium,
    fontSize: 15,
    letterSpacing: -0.3,
    color: th.t.inkSub,
  },
  moreLabelDisabled: { color: th.t.ink30 },
}));
