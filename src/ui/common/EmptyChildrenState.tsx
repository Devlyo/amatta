import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ColorIndex } from '../../domain/types';
import { getDb } from '../../db/client';
import { useChildrenStore } from '../../state/children-store';
import { MASCOTS } from '../assets';
import { FONT_FAMILIES } from '../fonts';
import { getKidPalette, TOKENS } from '../palette';

type Screen = 'welcome' | 'addKid';

const KID_COLOR_INDICES: readonly ColorIndex[] = [0, 1, 2, 3, 4, 5];

export function EmptyChildrenState(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('welcome');

  if (screen === 'welcome') {
    return <WelcomeScreen onStart={() => setScreen('addKid')} />;
  }
  return <AddKidScreen onBack={() => setScreen('welcome')} />;
}

function WelcomeScreen({ onStart }: { onStart: () => void }): React.ReactElement {
  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeBody}>
        <Image
          source={MASCOTS.pink}
          style={styles.mascot}
          resizeMode="contain"
          accessibilityLabel="아마따 캐릭터"
        />
        <Text style={styles.welcomeTitle} accessibilityRole="header">
          Welcome
        </Text>
        <Text style={styles.welcomeSub} accessibilityRole="text">
          {'아마따와 함께 여러 자녀의\n일정과 준비물을 관리해보세요.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="시작하기"
          onPress={onStart}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: pressed ? TOKENS.primaryDeep : TOKENS.primary },
          ]}
        >
          <Text style={styles.ctaLabel}>시작하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AddKidScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const addChild = useChildrenStore((s) => s.add);
  const [name, setName] = useState('');
  const [colorIndex, setColorIndex] = useState<ColorIndex>(0);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const handleAdd = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const db = await getDb();
      await addChild(db, { name: trimmed, colorIndex });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.addKidContainer}>
      <View style={styles.addKidTopBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={onBack}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={TOKENS.ink} />
        </Pressable>
      </View>

      <View style={styles.addKidBody}>
        <Text style={styles.addKidTitle} accessibilityRole="header">
          자녀를 알려주세요
        </Text>
        <Text style={styles.addKidSub} accessibilityRole="text">
          언제든 설정에서 추가할 수 있어요 (최대 4명).
        </Text>

        <Text style={styles.fieldLabel}>자녀 이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="자녀 이름"
          placeholderTextColor={TOKENS.inkSub}
          maxLength={20}
          autoFocus
          accessibilityLabel="자녀 이름"
          style={styles.nameInput}
        />

        <Text style={styles.fieldLabel}>색상</Text>
        <View style={styles.swatchRow}>
          {KID_COLOR_INDICES.map((idx) => {
            const palette = getKidPalette(idx);
            const active = idx === colorIndex;
            return (
              <Pressable
                key={idx}
                accessibilityRole="button"
                accessibilityLabel={`색상 ${String(idx + 1)}`}
                accessibilityState={{ selected: active }}
                onPress={() => setColorIndex(idx)}
                style={[
                  styles.swatch,
                  { backgroundColor: palette.source },
                  active ? styles.swatchActive : null,
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.addKidFooter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="추가"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={() => {
            void handleAdd();
          }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: !canSubmit
                ? TOKENS.ink12
                : pressed
                  ? TOKENS.primaryDeep
                  : TOKENS.primary,
            },
          ]}
        >
          <Text style={styles.ctaLabel}>추가</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: TOKENS.surface,
  },
  welcomeBody: {
    alignItems: 'center',
  },
  mascot: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: FONT_FAMILIES.pretendardBold,
    color: TOKENS.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  welcomeSub: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  cta: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
  },
  addKidContainer: {
    flex: 1,
    backgroundColor: TOKENS.surface,
  },
  addKidTopBar: {
    paddingTop: 54,
    paddingHorizontal: 14,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  addKidBody: {
    flex: 1,
    paddingHorizontal: 22,
  },
  addKidTitle: {
    fontSize: 22,
    fontFamily: FONT_FAMILIES.pretendardBold,
    color: TOKENS.ink,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  addKidSub: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  fieldLabel: {
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 2,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  nameInput: {
    backgroundColor: TOKENS.ink04,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: TOKENS.ink,
  },
  addKidFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
  },
});
