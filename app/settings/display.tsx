// 설정 > 화면 — ADR-009. For now: where the new-event "+" sits next to the
// dock (right / left for left-handed use). 화면 모드 (system / light / dark)
// is added here once every screen supports dark (ADR-009 step 5).

import { useCallback } from 'react';
import { Appearance, Text, useColorScheme, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { useDisplayStore, type AddButtonSide } from '../../src/state/display-store';
import { HomeSection } from '../../src/ui/home/HomeSection';
import { FormOptionList, FormToggleRow } from '../../src/ui/sheets/form-rows';
import { SettingsDetailScreen, settingsStyles } from '../../src/ui/settings/SettingsChrome';

const SIDES: readonly { key: AddButtonSide; label: string }[] = [
  { key: 'right', label: '오른쪽' },
  { key: 'left', label: '왼쪽' },
];

export default function DisplaySettingsScreen(): React.ReactElement {
  const router = useRouter();
  const side = useDisplayStore((s) => s.addButtonSide);
  const scheme = useColorScheme();
  const onSelect = useCallback(async (next: AddButtonSide) => {
    await useDisplayStore.getState().setAddButtonSide(await getDb(), next);
  }, []);

  return (
    <SettingsDetailScreen title="화면" onBack={() => router.back()}>
      <View style={settingsStyles.block}>
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
        <Text style={settingsStyles.footnote}>왼손으로 쓰신다면 왼쪽을 고르면 엄지로 누르기 편해요.</Text>
      </View>

      {/* ADR-009 steps 1–4: developers preview converted screens in dark.
          Development builds only — users stay on light until step 5. */}
      {__DEV__ ? (
        <View style={settingsStyles.block}>
          <HomeSection title="개발용">
            <FormToggleRow
              label="다크 미리보기"
              value={scheme === 'dark'}
              onChange={(v) => Appearance.setColorScheme(v ? 'dark' : 'light')}
              last
            />
          </HomeSection>
          <Text style={settingsStyles.footnote}>다크로 바꾼 화면만 다크로 보여요(ADR-009 전환 중).</Text>
        </View>
      ) : null}
    </SettingsDetailScreen>
  );
}
