import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { TOKENS } from '../palette';

export function EmptyChildrenState(): React.ReactElement {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.message} accessibilityRole="text">
        자녀를 등록해 일정을 시작하세요.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="자녀 추가하기"
        onPress={() => router.push('/(tabs)/settings')}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: pressed ? TOKENS.primaryDeep : TOKENS.primary },
        ]}
      >
        <Text style={styles.ctaLabel}>자녀 추가하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: TOKENS.surface,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: TOKENS.ink,
    textAlign: 'center',
    marginBottom: 24,
  },
  cta: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.surface,
  },
});
