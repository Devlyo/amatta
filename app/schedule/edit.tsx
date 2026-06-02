import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Phase 4 onwards: edit happens in a globally-mounted `ScheduleEditSheet`
 * driven by `useUiStore.openEditSheet`, not via route navigation. This
 * route is retained so deep links don't 404, but it immediately bounces
 * back to the previous screen.
 */
export default function ScheduleEditScreen(): React.ReactElement {
  const router = useRouter();
  useEffect(() => {
    router.back();
  }, [router]);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
});
