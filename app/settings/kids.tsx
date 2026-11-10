// 자녀 관리 — settings sub-screen in the shared settings style (ADR-007 §10).
//
// - One row per kid (avatar + name ›) → /settings/kid-edit; deleting lives
//   inside the edit screen.
// - "자녀 추가" row like the form's 준비물 추가 (red add-circle); at the cap it
//   turns grey and tapping it explains the limit. The hard cap also lives in
//   src/db/repositories/children.ts (ChildCapError).

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import type { Child } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { KidAvatar } from '../../src/ui/common/KidAvatar';
import { HomeSection } from '../../src/ui/home/HomeSection';
import { IconChevronRight } from '../../src/ui/icons';
import { TOKENS } from '../../src/ui/palette';
import { SPACING } from '../../src/ui/spacing';
import { TYPE } from '../../src/ui/typography';
import { SettingsDetailScreen, settingsStyles } from '../../src/ui/settings/SettingsChrome';

// Kept for older imports; the shared bar lives in src/ui/settings.
export { DetailTopBar } from '../../src/ui/settings/SettingsChrome';

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

  const sortedChildren = [...children].sort((a, b) => a.id - b.id);

  return (
    <SettingsDetailScreen
      title="자녀 관리"
      onBack={() => router.back()}
      rightLabel={atCap ? undefined : '추가'}
      onRight={handleAddPress}
    >
      <View style={settingsStyles.block}>
        <HomeSection title="자녀" count={`${sortedChildren.length}/${MAX_CHILDREN}`}>
          {sortedChildren.length === 0 ? (
            <View style={styles.row}>
              <Text style={styles.empty}>등록된 자녀가 없어요</Text>
            </View>
          ) : (
            sortedChildren.map((c) => (
              <View key={c.id}>
                <KidRow
                  child={c}
                  onEdit={() => router.push({ pathname: '/settings/kid-edit', params: { id: String(c.id) } })}
                />
                <View style={styles.separator} />
              </View>
            ))
          )}
          <Pressable
            onPress={handleAddPress}
            accessibilityRole="button"
            accessibilityLabel="자녀 추가하기"
            accessibilityState={{ disabled: atCap }}
            testID="add-child-button"
            style={styles.row}
          >
            <Ionicons name="add-circle" size={22} color={atCap ? TOKENS.ink30 : TOKENS.danger} />
            <Text style={[styles.addLabel, atCap ? styles.addLabelDisabled : null]}>자녀 추가</Text>
          </Pressable>
        </HomeSection>
        {atCap && capMessageVisible ? (
          <Text style={[settingsStyles.footnote, styles.capMessage]} testID="cap-message">
            최대 {MAX_CHILDREN}명까지 등록할 수 있습니다.
          </Text>
        ) : (
          <Text style={settingsStyles.footnote}>
            {atCap ? `최대 ${MAX_CHILDREN}명까지 등록할 수 있어요.` : '아이를 눌러 이름과 아바타를 바꿀 수 있어요.'}
          </Text>
        )}
      </View>
    </SettingsDetailScreen>
  );
}

function KidRow({ child, onEdit }: { child: Child; onEdit: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${child.name} 편집`}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <KidAvatar child={child} size={30} />
      <Text style={styles.name}>{child.name}</Text>
      <IconChevronRight size={14} color={TOKENS.ink30} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Form-row metrics (44pt+, 16 inset) so it reads like the other lists.
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: SPACING.md,
  },
  rowPressed: { backgroundColor: TOKENS.ink04 },
  separator: { marginLeft: 16, height: StyleSheet.hairlineWidth, backgroundColor: TOKENS.ink12 },
  name: { ...TYPE.row, color: TOKENS.ink, flex: 1 },
  empty: { ...TYPE.row, color: TOKENS.inkSub, flex: 1 },
  addLabel: { ...TYPE.row, color: TOKENS.danger, flex: 1 },
  addLabelDisabled: { color: TOKENS.ink30 },
  capMessage: { color: TOKENS.danger },
});
