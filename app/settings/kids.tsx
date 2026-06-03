// Children CRUD — 1:1 port of docs/design/amatta-v1/app-settings-kids.jsx
// KidsList screen.
//
// - List rows: palette-tinted avatar + name → tap routes to /settings/kid-edit
//   (full-screen). Destruction lives inside the edit screen per spec; the
//   inline 삭제 button is gone.
// - "자녀 추가" card pinned beneath the list, hidden at the 4-kid cap.
// - Cap belt: tapping the disabled add area reveals a "최대 4명까지" message.
//   The hard cap also lives in src/db/repositories/children.ts (ChildCapError).

import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import type { Child } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { KidAvatar } from '../../src/ui/common/KidAvatar';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from '../../src/ui/icons';
import { getKidPalette, TOKENS } from '../../src/ui/palette';

export default function KidsScreen(): React.ReactElement {
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);

  const [capMessageVisible, setCapMessageVisible] = useState(false);

  const atCap = children.length >= MAX_CHILDREN;

  // The message auto-dismisses once a child is removed and we drop below cap.
  useEffect(() => {
    if (!atCap) setCapMessageVisible(false);
  }, [atCap]);

  const handleAddPress = useCallback((): void => {
    if (atCap) {
      setCapMessageVisible(true);
      return;
    }
    router.push('/settings/kid-edit');
  }, [atCap, router]);

  const handleEditPress = useCallback((c: Child): void => {
    router.push({
      pathname: '/settings/kid-edit',
      params: { id: String(c.id) },
    });
  }, [router]);

  const sortedChildren = [...children].sort((a, b) => a.id - b.id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DetailTopBar
        title="자녀 관리"
        onBack={() => router.back()}
        rightLabel={atCap ? undefined : '추가'}
        rightDisabled={atCap}
        onRight={handleAddPress}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionHeader label={`총 ${sortedChildren.length}명 / ${MAX_CHILDREN}명`} />

        <View style={styles.card}>
          {sortedChildren.length === 0 ? (
            <View style={styles.row}>
              <Text style={styles.empty}>등록된 자녀가 없습니다.</Text>
            </View>
          ) : (
            sortedChildren.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <KidRow
                  child={c}
                  onEdit={() => handleEditPress(c)}
                />
              </View>
            ))
          )}
        </View>

        {!atCap ? (
          <Pressable
            onPress={handleAddPress}
            accessibilityRole="button"
            accessibilityLabel="자녀 추가하기"
            accessibilityState={{ disabled: false }}
            testID="add-child-button"
            style={({ pressed }) => [
              styles.addCard,
              pressed ? styles.addCardPressed : null,
            ]}
          >
            <View style={styles.addAvatar}>
              <IconPlus size={18} color={TOKENS.ink50} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>자녀 추가</Text>
              <Text style={styles.rowSub}>새 자녀를 등록하고 색상을 지정하세요</Text>
            </View>
            <IconChevronRight size={16} color={TOKENS.ink30} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleAddPress}
            accessibilityRole="button"
            accessibilityLabel="자녀 추가하기"
            accessibilityState={{ disabled: true }}
            testID="add-child-button"
            style={styles.addCardDisabled}
          >
            <View style={styles.addAvatarDisabled}>
              <IconPlus size={18} color={TOKENS.ink30} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, styles.rowLabelDisabled]}>자녀 추가</Text>
              <Text style={styles.rowSub}>최대 {MAX_CHILDREN}명까지 등록할 수 있어요</Text>
            </View>
          </Pressable>
        )}

        {atCap && capMessageVisible ? (
          <Text style={styles.capMessage} testID="cap-message">
            최대 4명까지 등록할 수 있습니다.
          </Text>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────

function KidRow({
  child,
  onEdit,
}: {
  child: Child;
  onEdit: () => void;
}): React.ReactElement {
  // Inline 삭제 button removed — destruction lives inside the edit screen
  // per docs/design/amatta-v1/app-settings-kids.jsx KidEdit's bottom
  // destructive section. Tap the row → edit screen.
  const palette = getKidPalette(child.colorIndex);
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${child.name} 편집`}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <View
        style={[styles.kidAvatar, { backgroundColor: palette.bg }]}
      >
        {/* Spec line 88: AvatarPH size=26 inside the 36 ring. */}
        <KidAvatar child={child} size={26} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{child.name}</Text>
      </View>
      <IconChevronRight size={16} color={TOKENS.ink30} />
    </Pressable>
  );
}

function SectionHeader({ label }: { label: string }): React.ReactElement {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

export function DetailTopBar({
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

  empty: { fontSize: 14, color: TOKENS.inkSub, paddingVertical: 12 },

  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  rowLabelDisabled: { color: TOKENS.ink50 },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.1,
    lineHeight: 16,
  },

  kidAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor overridden per-row to palette.bg.
    backgroundColor: TOKENS.surfaceWarm,
  },

  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: TOKENS.surface,
    borderRadius: 18,
  },
  addCardPressed: { backgroundColor: TOKENS.surfaceWarm },
  addCardDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: TOKENS.surface,
    borderRadius: 18,
    opacity: 0.6,
  },
  addAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: TOKENS.ink30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAvatarDisabled: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: TOKENS.ink12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  capMessage: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.danger,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: -0.2,
  },

  bottomSpacer: { height: 32 },
});
