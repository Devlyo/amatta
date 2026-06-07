import { Fragment, useState } from 'react';
import { ScrollView, View, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { IconPlus } from '../src/ui/icons';

import { TOKENS, SPACING, RADIUS, type TypeKey } from '../src/ui/theme';
import {
  Text,
  Button,
  Card,
  Input,
  Fab,
  Pill,
  Badge,
  SelectChip,
  DayCircle,
  Toggle,
  DateField,
  DashedAddButton,
  Segmented,
  type ButtonVariant,
  type ButtonSize,
} from '../src/ui/components';

// Dev-only design-system gallery (kitchen sink). Reachable from Settings in
// __DEV__, or directly at /dev-gallery. Renders every foundation token + every
// primitive × variant × size so visual consistency can be eyeballed in one
// place. Not shipped to users (entry point is __DEV__-gated).

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text variant="titleM" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }): React.ReactElement {
  return <View style={[styles.row, style]}>{children}</View>;
}

const TYPE_KEYS: TypeKey[] = [
  'display',
  'titleL',
  'titleM',
  'titleS',
  'bodyL',
  'body',
  'caption',
  'mono',
];

const BTN_VARIANTS: ButtonVariant[] = ['primary', 'ghost', 'tertiary', 'danger'];
const BTN_SIZES: ButtonSize[] = ['sm', 'md', 'lg'];

const KIND_OPTIONS: { id: 'school' | 'academy' | 'activity' | 'etc'; label: string }[] = [
  { id: 'school', label: '학교' },
  { id: 'academy', label: '학원' },
  { id: 'activity', label: '운동' },
  { id: 'etc', label: '기타' },
];
const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

const KID_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Petunia', hex: '#FFA9FF' },
  { name: 'Mint', hex: '#C0F0AA' },
  { name: 'Glacier', hex: '#D8E6FF' },
  { name: 'Peach', hex: '#FFE8D2' },
  { name: 'Citrus', hex: '#E0E446' },
  { name: 'Lavender', hex: '#C7B0FF' },
];

const BRAND_SWATCHES: { name: string; hex: string }[] = [
  { name: 'primary', hex: TOKENS.primary },
  { name: 'primaryDeep', hex: TOKENS.primaryDeep },
  { name: 'primaryTint', hex: TOKENS.primaryTint },
  { name: 'ink', hex: TOKENS.ink },
  { name: 'inkSub', hex: TOKENS.inkSub },
  { name: 'hair', hex: TOKENS.hair },
  { name: 'surfaceWarm', hex: TOKENS.surfaceWarm },
  { name: 'success', hex: TOKENS.success },
  { name: 'danger', hex: TOKENS.danger },
  { name: 'warningDot', hex: TOKENS.warningDot },
  { name: 'controlIdle', hex: TOKENS.controlIdle },
  { name: 'controlActive', hex: TOKENS.controlActive },
  { name: 'switchOff', hex: TOKENS.switchOff },
];

export default function DevGallery(): React.ReactElement {
  const [chip, setChip] = useState<'school' | 'academy' | 'activity' | 'etc'>('academy');
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [tgSm, setTgSm] = useState(true);
  const [tgMd, setTgMd] = useState(false);
  const [tgLg, setTgLg] = useState(true);
  const [notifyLead, setNotifyLead] = useState<10 | 30 | 60>(30);
  const toggleDay = (i: number): void =>
    setDays((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'DS Gallery' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ---- TYPOGRAPHY ---- */}
        <Section title="Typography (TYPE)">
          {TYPE_KEYS.map((k) => (
            <View key={k} style={styles.typeRow}>
              <Text variant="caption" color={TOKENS.inkSub} style={styles.typeLabel}>
                {k}
              </Text>
              <Text variant={k}>다람쥐 Aa 09:30</Text>
            </View>
          ))}
        </Section>

        {/* ---- BRAND / NEUTRAL COLORS ---- */}
        <Section title="Color — brand / neutral (TOKENS)">
          <Row>
            {BRAND_SWATCHES.map((s) => (
              <View key={s.name} style={styles.swatchCell}>
                <View style={[styles.swatch, { backgroundColor: s.hex }]} />
                <Text variant="caption" color={TOKENS.inkSub}>
                  {s.name}
                </Text>
              </View>
            ))}
          </Row>
        </Section>

        {/* ---- KID PALETTE ---- */}
        <Section title="Color — kid palette (6)">
          <Row>
            {KID_SWATCHES.map((s) => (
              <View key={s.name} style={styles.swatchCell}>
                <View style={[styles.swatch, { backgroundColor: s.hex }]} />
                <Text variant="caption" color={TOKENS.inkSub}>
                  {s.name}
                </Text>
              </View>
            ))}
          </Row>
        </Section>

        {/* ---- SPACING ---- */}
        <Section title="Spacing (4px grid)">
          {(Object.keys(SPACING) as (keyof typeof SPACING)[]).map((k) => (
            <View key={k} style={styles.scaleRow}>
              <Text variant="caption" color={TOKENS.inkSub} style={styles.scaleLabel}>
                {k} · {SPACING[k]}
              </Text>
              <View style={[styles.scaleBar, { width: SPACING[k] * 4 }]} />
            </View>
          ))}
        </Section>

        {/* ---- RADIUS ---- */}
        <Section title="Radius">
          <Row>
            {(Object.keys(RADIUS) as (keyof typeof RADIUS)[]).map((k) => (
              <View key={k} style={styles.swatchCell}>
                <View
                  style={[
                    styles.radiusBox,
                    { borderRadius: Math.min(RADIUS[k], 32) },
                  ]}
                />
                <Text variant="caption" color={TOKENS.inkSub}>
                  {k} · {RADIUS[k]}
                </Text>
              </View>
            ))}
          </Row>
        </Section>

        {/* ---- BUTTONS ---- */}
        <Section title="Button — variant × size">
          {BTN_VARIANTS.map((v) => (
            <Fragment key={v}>
              <Text variant="caption" color={TOKENS.inkSub} style={styles.subLabel}>
                {v}
              </Text>
              <Row style={styles.btnRow}>
                {BTN_SIZES.map((sz) => (
                  <Button key={sz} label={`${v} ${sz}`} variant={v} size={sz} onPress={() => {}} />
                ))}
              </Row>
            </Fragment>
          ))}
          <Text variant="caption" color={TOKENS.inkSub} style={styles.subLabel}>
            shape / state
          </Text>
          <Row style={styles.btnRow}>
            <Button label="pill" shape="pill" onPress={() => {}} />
            <Button label="loading" loading onPress={() => {}} />
            <Button label="disabled" disabled onPress={() => {}} />
            <Button label="icon" leftIcon={<IconPlus size={16} color={TOKENS.surface} />} onPress={() => {}} />
          </Row>
          <Row style={styles.btnRow}>
            <Button label="fullWidth primary" fullWidth onPress={() => {}} />
          </Row>
        </Section>

        {/* ---- CARD ---- */}
        <Section title="Card">
          <Card style={styles.gap}>
            <Text variant="titleS">plain card</Text>
            <Text variant="body" color={TOKENS.inkSub}>
              hair 보더 + radius lg, drop shadow 없음.
            </Text>
          </Card>
          <Card variant="warm">
            <Text variant="titleS">warm card</Text>
            <Text variant="body" color={TOKENS.inkSub}>
              surface-warm 배경.
            </Text>
          </Card>
        </Section>

        {/* ---- INPUT ---- */}
        <Section title="Input (md / lg)">
          <Input placeholder="md — 일정 제목" style={styles.gap} />
          <Input placeholder="lg — 큰 입력" size="lg" />
        </Section>

        {/* ---- PILL ---- */}
        <Section title="Pill / Chip">
          <Row>
            <Pill label="solid" />
            <Pill label="outline" variant="outline" />
            <Pill label="primary" tone={TOKENS.primary} />
            <Pill label="success" tone={TOKENS.success} />
            <Pill label="md" size="md" tone={TOKENS.inkSub} />
          </Row>
        </Section>

        {/* ---- BADGE ---- */}
        <Section title="Badge">
          <Row style={styles.badgeRow}>
            <Badge count={3} />
            <Badge count={128} />
            <Badge count={5} tone={TOKENS.primary} />
            <Badge dot tone={TOKENS.warningDot} />
            <Badge dot tone={TOKENS.success} />
          </Row>
        </Section>

        {/* ---- FAB ---- */}
        <Section title="FAB (ink, not orange)">
          <Fab onPress={() => {}}>
            <IconPlus size={24} color={TOKENS.surface} />
          </Fab>
        </Section>

        {/* ════ 새 일정 폼 컴포넌트 ════ */}
        <Section title="SelectChip — 종류/알림 (sm·md·lg)">
          {(['sm', 'md', 'lg'] as const).map((sz) => (
            <Row key={sz}>
              {KIND_OPTIONS.map((k) => (
                <SelectChip
                  key={k.id}
                  label={k.label}
                  size={sz}
                  active={chip === k.id}
                  onPress={() => setChip(k.id)}
                />
              ))}
            </Row>
          ))}
        </Section>

        <Section title="DayCircle — 반복 요일 (sm·md·lg)">
          {(['sm', 'md', 'lg'] as const).map((sz) => (
            <Row key={sz}>
              {DAYS_KR.map((d, i) => (
                <DayCircle
                  key={d}
                  label={d}
                  size={sz}
                  active={days.includes(i)}
                  onPress={() => toggleDay(i)}
                />
              ))}
            </Row>
          ))}
        </Section>

        <Section title="Toggle (sm·md·lg)">
          <Row style={styles.badgeRow}>
            <Toggle size="sm" value={tgSm} onChange={setTgSm} ariaLabel="sm" />
            <Toggle size="md" value={tgMd} onChange={setTgMd} ariaLabel="md" />
            <Toggle size="lg" value={tgLg} onChange={setTgLg} ariaLabel="lg" />
          </Row>
        </Section>

        <Section title="DateField — 날짜/시간 (md·lg)">
          <DateField displayText="2026.06.05 (금)" onPress={() => {}} style={styles.gap} />
          <DateField displayText="오후 4:00" size="lg" onPress={() => {}} />
        </Section>

        <Section title="DashedAddButton — 점선 추가 (sm·md·lg)">
          <Row style={styles.badgeRow}>
            <DashedAddButton size="sm" onPress={() => {}} />
            <DashedAddButton size="md" onPress={() => {}} />
            <DashedAddButton size="lg" onPress={() => {}} />
          </Row>
          <Row>
            <DashedAddButton size="md" label="추가" onPress={() => {}} />
            <DashedAddButton size="lg" label="자녀 추가" disabled />
          </Row>
        </Section>

        <Section title="Segmented — 기본 알림 시점 (설정 탭 요소)">
          <Segmented
            options={[10, 30, 60] as const}
            value={notifyLead}
            onChange={setNotifyLead}
            renderLabel={(v) => `${v}분 전`}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxxl, rowGap: SPACING.xl },
  section: { rowGap: SPACING.sm },
  sectionTitle: { marginBottom: SPACING.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm },
  typeRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.md },
  typeLabel: { width: 56 },
  subLabel: { marginTop: SPACING.sm },
  btnRow: { alignItems: 'flex-start' },
  swatchCell: { alignItems: 'center', gap: SPACING.xs, width: 72 },
  swatch: { width: 48, height: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: TOKENS.hair },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  scaleLabel: { width: 72 },
  scaleBar: { height: 12, backgroundColor: TOKENS.primaryTint, borderRadius: RADIUS.xs },
  radiusBox: { width: 48, height: 48, backgroundColor: TOKENS.primaryTint, borderWidth: 1, borderColor: TOKENS.primary },
  gap: { marginBottom: SPACING.sm },
  badgeRow: { alignItems: 'center' },
});
