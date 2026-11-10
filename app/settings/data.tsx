// 데이터 — JSON export, in the shared settings style (ADR-007 §10), and
// "파일에서 가져오기" — restore a backup, replacing everything (ADR-012).

import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '../../src/db/client';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useTodosStore } from '../../src/state/todos-store';
import { useChecklistStore } from '../../src/state/checklist-store';
import { HomeSection } from '../../src/ui/home/HomeSection';
import { TYPE } from '../../src/ui/typography';
import { FormGroup, FormValueRow } from '../../src/ui/sheets/form-rows';
import { SettingsDetailScreen, useSettingsStyles } from '../../src/ui/settings/SettingsChrome';
import { exportDb } from '../../src/utils/db-export';
import { defaultRestoreSteps, restoreFromBackup } from '../../src/state/restore';
import { makeStyles } from '../../src/ui/appearance';

export default function DataScreen(): React.ReactElement {
  const ss = useSettingsStyles();
  const styles = useStyles();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const kidCount = useChildrenStore((s) => s.children.length);
  const scheduleCount = useSchedulesStore((s) => s.schedules.length);
  const todoCount = useTodosStore((s) => s.todos.length);
  const checklistCount = useChecklistStore((s) => {
    let n = 0;
    for (const items of s.itemsByScheduleId.values()) n += items.length;
    return n;
  });

  const handleImport = async (): Promise<void> => {
    if (importing || exporting) return;
    setImporting(true);
    try {
      const outcome = await restoreFromBackup('settings', defaultRestoreSteps());
      if (outcome === 'restored') {
        // Leave the settings stack — the app now holds the backup's data.
        if (router.canDismiss()) router.dismissAll();
        router.replace('/');
      }
    } finally {
      setImporting(false);
    }
  };

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
      <View style={ss.block}>
        <HomeSection title="내보낼 데이터">
          <FormValueRow label="자녀" value={`${kidCount}명`} />
          <FormValueRow label="일정" value={`${scheduleCount}건`} />
          <FormValueRow label="준비물" value={`${checklistCount}건`} />
          <FormValueRow label="할일" value={`${todoCount}건`} last />
        </HomeSection>
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

      <View style={ss.block}>
        <HomeSection title="가져오기">
          <Pressable
            onPress={() => void handleImport()}
            accessibilityRole="button"
            accessibilityLabel="파일에서 가져오기"
            accessibilityState={{ disabled: importing, busy: importing }}
            disabled={importing}
            testID="import-button"
            style={styles.exportRow}
          >
            <Text style={[styles.exportLabel, importing ? styles.exportLabelBusy : null]}>
              {importing ? '가져오는 중...' : '파일에서 가져오기'}
            </Text>
          </Pressable>
        </HomeSection>
      </View>
    </SettingsDetailScreen>
  );
}

const useStyles = makeStyles((th) => ({
  exportRow: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  exportLabel: { ...TYPE.headline, color: th.t.danger },
  exportLabelBusy: { color: th.t.ink30 },
}));
