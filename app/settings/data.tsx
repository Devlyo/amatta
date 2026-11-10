// 데이터 — JSON export, in the shared settings style (ADR-007 §10). JSON
// import is a disabled "v1.1 출시 예정" row.

import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '../../src/db/client';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useTodosStore } from '../../src/state/todos-store';
import { useChecklistStore } from '../../src/state/checklist-store';
import { HomeSection } from '../../src/ui/home/HomeSection';
import { TOKENS } from '../../src/ui/palette';
import { TYPE } from '../../src/ui/typography';
import { FormGroup, FormValueRow } from '../../src/ui/sheets/form-rows';
import { SettingsDetailScreen, settingsStyles } from '../../src/ui/settings/SettingsChrome';
import { exportDb } from '../../src/utils/db-export';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function todayFilename(): string {
  const d = new Date();
  return `schedulapp-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.json`;
}

export default function DataScreen(): React.ReactElement {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const kidCount = useChildrenStore((s) => s.children.length);
  const scheduleCount = useSchedulesStore((s) => s.schedules.length);
  const todoCount = useTodosStore((s) => s.todos.length);
  const checklistCount = useChecklistStore((s) => {
    let n = 0;
    for (const items of s.itemsByScheduleId.values()) n += items.length;
    return n;
  });

  const filename = useMemo(todayFilename, []);

  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    try {
      const db = await getDb();
      const result = await exportDb(db);
      const docDir = FileSystem.Paths.document.uri;
      const baseUri = docDir.endsWith('/') ? docDir : `${docDir}/`;
      const uri = `${baseUri}${result.suggestedFilename}`;
      const file = new FileSystem.File(uri);
      try {
        if (file.exists) file.delete();
      } catch {
        /* ignore */
      }
      file.create();
      file.write(result.json);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: '데이터 내보내기',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('내보내기 완료', `파일 위치:\n${uri}`, [{ text: '확인' }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? 'Unknown error');
      Alert.alert('내보내기 실패', msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SettingsDetailScreen title="데이터" onBack={() => router.back()}>
      <View style={settingsStyles.block}>
        <HomeSection title="내보낼 데이터">
          <FormValueRow label="자녀" value={`${kidCount}명`} />
          <FormValueRow label="일정" value={`${scheduleCount}건`} />
          <FormValueRow label="준비물" value={`${checklistCount}건`} />
          <FormValueRow label="할일" value={`${todoCount}건`} last />
        </HomeSection>
        <Text style={settingsStyles.footnote}>{filename} 파일로 저장돼요. 백업용으로 보관할 수 있어요.</Text>
      </View>

      <FormGroup>
        <Pressable
          onPress={() => void handleExport()}
          accessibilityRole="button"
          accessibilityLabel="데이터 내보내기"
          accessibilityState={{ disabled: exporting }}
          disabled={exporting}
          testID="export-button"
          style={styles.exportRow}
        >
          <Text style={[styles.exportLabel, exporting ? styles.exportLabelBusy : null]}>
            {exporting ? '내보내는 중...' : '내보내기'}
          </Text>
        </Pressable>
      </FormGroup>

      <View style={settingsStyles.block}>
        <HomeSection title="가져오기">
          <FormValueRow label="데이터 가져오기 (JSON)" value="v1.1 출시 예정" last />
        </HomeSection>
        <Text style={settingsStyles.footnote}>백업한 파일에서 복원하는 기능은 v1.1에서 지원돼요.</Text>
      </View>
    </SettingsDetailScreen>
  );
}

const styles = StyleSheet.create({
  exportRow: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  exportLabel: { ...TYPE.headline, color: TOKENS.danger },
  exportLabelBusy: { color: TOKENS.ink30 },
});
