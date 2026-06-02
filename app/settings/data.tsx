// Data management screen — 1:1 port of docs/design/amatta-v1/app-settings-data.jsx
// JsonExport. JSON import is disabled with a "v1.1 출시 예정" label.

import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '../../src/db/client';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useTodosStore } from '../../src/state/todos-store';
import { useChecklistStore } from '../../src/state/checklist-store';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { TOKENS } from '../../src/ui/palette';
import { exportDb } from '../../src/utils/db-export';

import { DetailTopBar } from './kids';

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DetailTopBar
        title="데이터"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero — file card */}
        <View style={styles.hero}>
          <FileIcon />
          <View style={styles.heroText}>
            <Text style={styles.heroFilename}>{filename}</Text>
            <Text style={styles.heroMeta}>JSON · 백업</Text>
          </View>
        </View>

        {/* 내보낼 정보 */}
        <SectionHeader label="내보낼 정보" />
        <View style={styles.card}>
          <CountRow label="자녀" count={kidCount} unit="명" />
          <Divider />
          <CountRow label="일정" count={scheduleCount} unit="건" />
          <Divider />
          <CountRow label="준비물" count={checklistCount} unit="건" />
          <Divider />
          <CountRow label="할일" count={todoCount} unit="건" />
        </View>

        <Text style={styles.note}>
          내보낸 JSON 파일은 다른 기기의 아마따에서 가져오기로 복원하거나, 백업용으로 보관할 수 있어요.
        </Text>

        {/* CTA — 내보내기 */}
        <Pressable
          onPress={() => void handleExport()}
          accessibilityRole="button"
          accessibilityLabel="데이터 내보내기"
          accessibilityState={{ disabled: exporting }}
          disabled={exporting}
          testID="export-button"
          style={({ pressed }) => [
            styles.primaryCta,
            pressed ? styles.primaryCtaPressed : null,
            exporting ? styles.primaryCtaDisabled : null,
          ]}
        >
          <Text style={styles.primaryCtaLabel}>
            {exporting ? '내보내는 중...' : '내보내기'}
          </Text>
        </Pressable>

        {/* Import — disabled placeholder */}
        <SectionHeader label="가져오기" />
        <View style={styles.card}>
          <View style={[styles.row, styles.rowDisabled]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, styles.rowLabelDisabled]}>
                데이터 가져오기 (JSON)
              </Text>
              <Text style={styles.rowSub}>백업한 파일에서 복원</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>v1.1 출시 예정</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CountRow({
  label,
  count,
  unit,
}: {
  label: string;
  count: number;
  unit: string;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.countWrap}>
        <Text style={styles.countValue}>{count}</Text>
        <Text style={styles.countUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function FileIcon(): React.ReactElement {
  return (
    <View style={styles.fileIcon}>
      <View style={styles.fileIconCorner} />
      <View style={styles.fileIconLabel}>
        <Text style={styles.fileIconLabelText}>JSON</Text>
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

function Divider(): React.ReactElement {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surfaceSoft },

  scrollContent: { paddingHorizontal: 14, paddingBottom: 32 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: TOKENS.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroFilename: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  heroMeta: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.1,
  },

  fileIcon: {
    width: 48,
    height: 56,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: TOKENS.primary,
    backgroundColor: TOKENS.surface,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fileIconCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    backgroundColor: TOKENS.primary,
    borderBottomLeftRadius: 4,
  },
  fileIconLabel: {
    backgroundColor: TOKENS.primary,
    paddingVertical: 3,
    alignItems: 'center',
  },
  fileIconLabelText: {
    fontSize: 9,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.surface,
    letterSpacing: 0.6,
  },

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
  rowDisabled: { opacity: 0.55 },

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

  countWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  countValue: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  countUnit: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
  },

  note: {
    paddingHorizontal: 6,
    paddingVertical: 14,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 18,
    letterSpacing: -0.2,
  },

  primaryCta: {
    marginTop: 4,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: TOKENS.primary,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaPressed: { backgroundColor: TOKENS.primaryDeep },
  primaryCtaDisabled: { backgroundColor: TOKENS.ink12 },
  primaryCtaLabel: {
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
    letterSpacing: -0.3,
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: TOKENS.ink04,
  },
  badgeLabel: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.1,
  },

  bottomSpacer: { height: 32 },
});
