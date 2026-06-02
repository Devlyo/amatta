import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PALETTE } from '../../domain/constants';
import type { Child, ColorIndex, NotificationSetting } from '../../domain/types';
import { ColorDot } from '../common/ColorDot';
import { TOKENS } from '../palette';

export interface ChildEditValues {
  name: string;
  colorIndex: ColorIndex;
  defaultMinutesBefore: number;
  sound: boolean;
  enabled: boolean;
}

interface Props {
  visible: boolean;
  /** When provided, the modal opens in "edit" mode. Otherwise it's "add". */
  child?: Child;
  notificationSetting?: NotificationSetting;
  onCancel: () => void;
  onSave: (values: ChildEditValues) => void | Promise<void>;
}

const NOTIFY_OPTIONS: readonly number[] = [5, 10, 15, 30, 60] as const;
const NAME_MAX = 20;

export function ChildEditModal({
  visible,
  child,
  notificationSetting,
  onCancel,
  onSave,
}: Props): React.ReactElement {
  const [name, setName] = useState('');
  const [colorIndex, setColorIndex] = useState<ColorIndex>(0);
  const [defaultMinutesBefore, setDefaultMinutesBefore] = useState<number>(15);
  const [sound, setSound] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (child !== undefined) {
      setName(child.name);
      setColorIndex(child.colorIndex);
    } else {
      setName('');
      setColorIndex(0);
    }
    if (notificationSetting !== undefined) {
      setDefaultMinutesBefore(notificationSetting.defaultMinutesBefore);
      setSound(notificationSetting.sound);
      setEnabled(notificationSetting.enabled);
    } else {
      setDefaultMinutesBefore(15);
      setSound(true);
      setEnabled(true);
    }
    setSubmitted(false);
  }, [visible, child, notificationSetting]);

  const trimmed = name.trim();
  const nameError =
    trimmed.length === 0
      ? '이름을 입력하세요.'
      : trimmed.length > NAME_MAX
        ? `이름은 ${NAME_MAX}자 이하로 작성하세요.`
        : null;
  const canSave = nameError === null;

  const handleSave = (): void => {
    setSubmitted(true);
    if (!canSave) return;
    void onSave({
      name: trimmed,
      colorIndex,
      defaultMinutesBefore,
      sound,
      enabled,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      transparent
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.card}>
          <View style={styles.headerBar}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="취소"
              hitSlop={8}
            >
              <Text style={styles.cancelLabel}>취소</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {child === undefined ? '자녀 추가' : '자녀 수정'}
            </Text>
            <Pressable
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="저장"
              accessibilityState={{ disabled: !canSave }}
              disabled={!canSave}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.saveLabel,
                  !canSave ? styles.saveLabelDisabled : null,
                ]}
              >
                저장
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>이름</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="예: 민준"
              placeholderTextColor={TOKENS.inkSub}
              style={styles.input}
              maxLength={NAME_MAX}
              testID="child-name-input"
              accessibilityLabel="자녀 이름 입력"
            />
            {submitted && nameError !== null ? (
              <Text style={styles.error}>{nameError}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>색상</Text>
            <View style={styles.swatchRow}>
              {PALETTE.map((_hex, idx) => {
                const i = idx as ColorIndex;
                const selected = colorIndex === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setColorIndex(i)}
                    style={[
                      styles.swatch,
                      selected ? styles.swatchSelected : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`색상 ${i}`}
                    accessibilityState={{ selected }}
                  >
                    <ColorDot colorIndex={i} size={20} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>기본 알림 시점</Text>
            <View style={styles.chipRow}>
              {NOTIFY_OPTIONS.map((m) => {
                const selected = defaultMinutesBefore === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setDefaultMinutesBefore(m)}
                    style={[styles.chip, selected ? styles.chipSelected : null]}
                    accessibilityRole="button"
                    accessibilityLabel={`기본 ${m}분 전`}
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected ? styles.chipTextSelected : null,
                      ]}
                    >
                      {m}분 전
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.label}>알림 활성화</Text>
            <Switch value={enabled} onValueChange={setEnabled} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.label}>알림 소리</Text>
            <Switch value={sound} onValueChange={setSound} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,29,27,0.45)',
  },
  card: {
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    gap: 16,
    minHeight: '60%',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: TOKENS.ink },
  cancelLabel: { fontSize: 14, color: TOKENS.inkSub },
  saveLabel: { fontSize: 14, fontWeight: '600', color: TOKENS.primary },
  saveLabelDisabled: { color: TOKENS.ink30 },

  section: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: TOKENS.inkSub },

  input: {
    borderWidth: 1,
    borderColor: TOKENS.hair,
    borderRadius: 12,
    backgroundColor: TOKENS.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TOKENS.ink,
    fontSize: 14,
  },
  error: { fontSize: 12, color: TOKENS.danger },

  swatchRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surface,
  },
  swatchSelected: { borderColor: TOKENS.primary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
    backgroundColor: TOKENS.surfaceWarm,
    borderWidth: 1,
    borderColor: TOKENS.hair,
  },
  chipSelected: {
    backgroundColor: TOKENS.primary,
    borderColor: TOKENS.primary,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: TOKENS.ink },
  chipTextSelected: { color: TOKENS.surface },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
