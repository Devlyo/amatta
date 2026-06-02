import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '../../src/db/client';
import { MAX_CHILDREN } from '../../src/domain/constants';
import type { Child, NotificationSetting } from '../../src/domain/types';
import { notificationSettingsRepo } from '../../src/db/repositories';
import { useChildrenStore } from '../../src/state/children-store';
import { ColorDot } from '../../src/ui/common/ColorDot';
import { TOKENS } from '../../src/ui/palette';
import {
  ChildEditModal,
  type ChildEditValues,
} from '../../src/ui/settings/ChildEditModal';
import { exportDb } from '../../src/utils/db-export';

const APP_VERSION = '1.0.0';

export default function SettingsScreen(): React.ReactElement {
  const children = useChildrenStore((s) => s.children);
  const addChild = useChildrenStore((s) => s.add);
  const updateChild = useChildrenStore((s) => s.updateOne);
  const removeChild = useChildrenStore((s) => s.removeOne);

  const [modalChild, setModalChild] = useState<Child | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSetting, setModalSetting] = useState<NotificationSetting | undefined>(undefined);
  const [capMessageVisible, setCapMessageVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const atCap = children.length >= MAX_CHILDREN;

  // Reset cap-message when child count changes (e.g., after a delete it goes away).
  useEffect(() => {
    if (!atCap) setCapMessageVisible(false);
  }, [atCap]);

  const handleAddPress = (): void => {
    if (atCap) {
      setCapMessageVisible(true);
      return;
    }
    setModalChild(undefined);
    setModalSetting(undefined);
    setModalOpen(true);
  };

  const handleEditPress = async (c: Child): Promise<void> => {
    const db = await getDb();
    const setting = await notificationSettingsRepo.getByChildId(db, c.id);
    setModalChild(c);
    setModalSetting(setting ?? undefined);
    setModalOpen(true);
  };

  const handleDelete = (c: Child): void => {
    Alert.alert(
      '자녀 삭제',
      '이 자녀와 모든 일정을 삭제합니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const db = await getDb();
            await removeChild(db, c.id);
          },
        },
      ],
    );
  };

  const handleSave = async (values: ChildEditValues): Promise<void> => {
    const db = await getDb();
    let childId: number;
    if (modalChild === undefined) {
      const created = await addChild(db, {
        name: values.name,
        colorIndex: values.colorIndex,
      });
      childId = created.id;
    } else {
      await updateChild(db, modalChild.id, {
        name: values.name,
        colorIndex: values.colorIndex,
      });
      childId = modalChild.id;
    }
    // Upsert notification setting. The repo's create() requires no preexisting
    // row, so we check-then-route.
    const existing = await notificationSettingsRepo.getByChildId(db, childId);
    if (existing === null) {
      await notificationSettingsRepo.create(db, {
        childId,
        defaultMinutesBefore: values.defaultMinutesBefore,
        sound: values.sound,
        enabled: values.enabled,
      });
    } else {
      await notificationSettingsRepo.update(db, childId, {
        defaultMinutesBefore: values.defaultMinutesBefore,
        sound: values.sound,
        enabled: values.enabled,
      });
    }
    setModalOpen(false);
  };

  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    try {
      const db = await getDb();
      const result = await exportDb(db);
      const docDir = FileSystem.Paths.document.uri;
      // Ensure trailing slash on directory URI.
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
        Alert.alert(
          '내보내기 완료',
          `파일 위치:\n${uri}`,
          [{ text: '확인' }],
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? 'Unknown error');
      Alert.alert('내보내기 실패', msg);
    } finally {
      setExporting(false);
    }
  };

  const sortedChildren = useMemo(
    () => [...children].sort((a, b) => a.id - b.id),
    [children],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>설정</Text>

        {/* Children section */}
        <Text style={styles.sectionTitle}>자녀</Text>
        <View style={styles.list}>
          {sortedChildren.length === 0 ? (
            <Text style={styles.empty}>등록된 자녀가 없습니다.</Text>
          ) : (
            sortedChildren.map((c) => (
              <View key={c.id} style={styles.row}>
                <ColorDot colorIndex={c.colorIndex} size={14} />
                <Text style={styles.rowName}>{c.name}</Text>
                <View style={styles.rowSpacer} />
                <Pressable
                  onPress={() => void handleEditPress(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name} 수정`}
                  hitSlop={8}
                  style={styles.iconBtn}
                >
                  <Ionicons name="pencil" size={18} color={TOKENS.ink} />
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name} 삭제`}
                  hitSlop={8}
                  style={styles.iconBtn}
                >
                  <Ionicons name="trash" size={18} color={TOKENS.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Pressable
          onPress={handleAddPress}
          accessibilityRole="button"
          accessibilityLabel="자녀 추가하기"
          accessibilityState={{ disabled: atCap }}
          testID="add-child-button"
          style={({ pressed }) => [
            styles.addButton,
            atCap
              ? styles.addButtonDisabled
              : {
                  backgroundColor: pressed ? TOKENS.primaryDeep : TOKENS.primary,
                },
          ]}
        >
          <Text
            style={[
              styles.addButtonLabel,
              atCap ? styles.addButtonLabelDisabled : null,
            ]}
          >
            자녀 추가하기
          </Text>
        </Pressable>
        {atCap && capMessageVisible ? (
          <Text style={styles.capMessage} testID="cap-message">
            최대 4명까지 등록할 수 있습니다.
          </Text>
        ) : null}

        {/* Data section */}
        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>데이터</Text>
        <Pressable
          onPress={() => void handleExport()}
          accessibilityRole="button"
          accessibilityLabel="데이터 내보내기"
          accessibilityState={{ disabled: exporting }}
          disabled={exporting}
          style={styles.ghostButton}
          testID="export-button"
        >
          <Ionicons
            name="share-outline"
            size={18}
            color={TOKENS.ink}
            style={styles.ghostIcon}
          />
          <Text style={styles.ghostButtonLabel}>
            {exporting ? '내보내는 중...' : '데이터 내보내기 (JSON)'}
          </Text>
        </Pressable>

        {/* App info */}
        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>앱 정보</Text>
        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>버전</Text>
            <Text style={styles.infoValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>오픈소스 라이선스</Text>
            <Text style={styles.infoValueMuted}>(준비 중)</Text>
          </View>
        </View>
      </ScrollView>

      <ChildEditModal
        visible={modalOpen}
        child={modalChild}
        notificationSetting={modalSetting}
        onCancel={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 12 },

  title: { fontSize: 24, fontWeight: '700', color: TOKENS.ink, marginBottom: 8 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.inkSub,
    marginTop: 8,
  },
  sectionTitleSpaced: { marginTop: 24 },

  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.hair,
    backgroundColor: TOKENS.surface,
  },
  rowName: { fontSize: 15, fontWeight: '500', color: TOKENS.ink },
  rowSpacer: { flex: 1 },
  iconBtn: { padding: 4 },
  empty: { fontSize: 14, color: TOKENS.inkSub, paddingVertical: 12 },

  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonDisabled: { backgroundColor: TOKENS.ink12 },
  addButtonLabel: { fontSize: 14, fontWeight: '600', color: TOKENS.surface },
  addButtonLabelDisabled: { color: TOKENS.ink50 },
  capMessage: {
    fontSize: 13,
    color: TOKENS.danger,
    textAlign: 'center',
    marginTop: 4,
  },

  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.ink30,
    backgroundColor: TOKENS.surface,
  },
  ghostIcon: {},
  ghostButtonLabel: { fontSize: 14, fontWeight: '500', color: TOKENS.ink },

  infoBlock: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.hair,
    backgroundColor: TOKENS.surface,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoKey: { fontSize: 14, color: TOKENS.ink },
  infoValue: { fontSize: 14, fontWeight: '500', color: TOKENS.ink },
  infoValueMuted: { fontSize: 14, color: TOKENS.inkSub },
});
