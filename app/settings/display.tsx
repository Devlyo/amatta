// 설정 > 화면 — ADR-009.
//   화면 모드         시스템(기본) / 라이트 / 다크 — applied app-wide at once
//   새 일정 + 버튼 위치  오른쪽(기본) / 왼쪽 — for left-handed use

import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { useDisplayStore, type AddButtonSide, type AppearanceMode } from '../../src/state/display-store';
import { HomeSection } from '../../src/ui/home/HomeSection';
import { FormOptionList } from '../../src/ui/sheets/form-rows';
import { SettingsDetailScreen, useSettingsStyles } from '../../src/ui/settings/SettingsChrome';

const MODES: readonly { key: AppearanceMode; label: string }[] = [
  { key: 'system', label: '시스템 설정 따르기' },
  { key: 'light', label: '라이트' },
  { key: 'dark', label: '다크' },
];

const SIDES: readonly { key: AddButtonSide; label: string }[] = [
  { key: 'right', label: '오른쪽' },
  { key: 'left', label: '왼쪽' },
];

export default function DisplaySettingsScreen(): React.ReactElement {
  const ss = useSettingsStyles();
  const router = useRouter();
  const side = useDisplayStore((s) => s.addButtonSide);
  const mode = useDisplayStore((s) => s.appearance);
  const onSelect = useCallback(async (next: AddButtonSide) => {
    await useDisplayStore.getState().setAddButtonSide(await getDb(), next);
  }, []);

  const onMode = useCallback(async (next: AppearanceMode) => {
    await useDisplayStore.getState().setAppearance(await getDb(), next);
  }, []);

  return (
    <SettingsDetailScreen title="화면" onBack={() => router.back()}>
      <View style={ss.block}>
        <HomeSection title="화면 모드">
          <View style={{ paddingLeft: 16 }}>
            <FormOptionList<AppearanceMode>
              options={MODES}
              selected={mode}
              labelPrefix="화면 모드: "
              onSelect={(k) => void onMode(k)}
            />
          </View>
        </HomeSection>
        {mode === 'system' ? <Text style={ss.footnote}>아이폰의 라이트/다크 설정을 따라 바뀌어요.</Text> : null}
      </View>

      <View style={ss.block}>
        <HomeSection title="새 일정 + 버튼 위치">
          <View style={{ paddingLeft: 16 }}>
            <FormOptionList<AddButtonSide>
              options={SIDES}
              selected={side}
              labelPrefix="+ 버튼 위치: "
              onSelect={(k) => void onSelect(k)}
            />
          </View>
        </HomeSection>
      </View>

    </SettingsDetailScreen>
  );
}
