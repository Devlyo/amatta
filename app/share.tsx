// 캘린더 공유 — read-only link (ADR-016, board SH1). The chosen range is packed
// into the link's # part; the web viewer only draws it. Nothing is uploaded.

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../src/domain/constants';
import { buildSharePayload, encodeShare, shareUrl } from '../src/share/share-payload';
import { useChecklistStore } from '../src/state/checklist-store';
import { useChildrenStore } from '../src/state/children-store';
import { useSchedulesStore } from '../src/state/schedules-store';
import { KidAvatar } from '../src/ui/common/KidAvatar';
import { Segmented } from '../src/ui/components/Segmented';
import { FormGroup, FormOptionList, FormToggleRow } from '../src/ui/sheets/form-rows';
import { RADIUS } from '../src/ui/radius';
import { SPACING } from '../src/ui/spacing';
import { TYPE } from '../src/ui/typography';
import { todayIso } from '../src/ui/utils/date';
import { IconAlertCircle } from '../src/ui/icons';
import { makeStyles, useTheme } from '../src/ui/appearance';

const WEEKS = [2, 4, 8] as const;
/** Above this the link gets unwieldy in chat apps — ask for a shorter range. */
const MAX_LINK = 8000;

export default function ShareScreen(): React.ReactElement {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);
  const kids = useMemo(() => [...children].sort((a, b) => a.id - b.id).slice(0, MAX_CHILDREN), [children]);
  const [picked, setPicked] = useState<number[]>(() => kids.map((k) => k.id));
  const [weeks, setWeeks] = useState<(typeof WEEKS)[number]>(4);
  const [supplies, setSupplies] = useState(true);
  const [placeNotes, setPlaceNotes] = useState(false);
  const today = todayIso();
  const m = Number((today as unknown as string).slice(5, 7));
  const d = Number((today as unknown as string).slice(8, 10));

  const onShare = async (): Promise<void> => {
    if (picked.length === 0) {
      Alert.alert('아이를 골라 주세요', '보여 줄 아이를 한 명 이상 골라 주세요.');
      return;
    }
    const st = useSchedulesStore.getState();
    const payload = buildSharePayload(
      {
        children: kids,
        schedules: st.schedules,
        exceptions: st.exceptions,
        checklistByScheduleId: useChecklistStore.getState().itemsByScheduleId,
      },
      { kidIds: picked, from: today, weeks, includeSupplies: supplies, includePlaceNotes: placeNotes, createdOn: today },
    );
    if (encodeShare(payload).length > MAX_LINK) {
      Alert.alert('링크가 너무 길어요', '기간을 줄이거나 준비물·장소를 빼고 다시 공유해 주세요.');
      return;
    }
    const url = shareUrl(payload);
    try {
      await Share.share({ message: `WeMoa 캘린더 (${m}월 ${d}일 기준, 보기 전용)\n${url}` });
    } catch {
      // Dismissed or failed — nothing to undo.
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.navSide} hitSlop={8}>
          <Text style={styles.close}>닫기</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          캘린더 공유
        </Text>
        <View style={styles.navSide} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.block}>
          <Text style={styles.header}>자녀</Text>
          <FormGroup>
            <View style={styles.kidList}>
            <FormOptionList<number>
              options={kids.map((k) => ({ key: k.id, label: k.name }))}
              selected={-1}
              isSelected={(id) => picked.includes(id)}
              onSelect={(id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
              labelPrefix="공유: "
              render={(id) => {
                const kid = kids.find((k) => k.id === id);
                return kid !== undefined ? <KidAvatar child={kid} size={26} /> : null;
              }}
            />
            </View>
          </FormGroup>
        </View>

        <View style={styles.block}>
          <Text style={styles.header}>공유할 일정</Text>
          <FormGroup>
            <View style={styles.periodRow}>
              <Text style={styles.label}>기간</Text>
              <Segmented options={WEEKS} value={weeks} onChange={setWeeks} renderLabel={(w) => `${w}주`} style={styles.seg} />
            </View>
            <FormToggleRow label="준비물 포함" value={supplies} onChange={setSupplies} />
            <FormToggleRow label="장소·메모 포함" value={placeNotes} onChange={setPlaceNotes} last />
          </FormGroup>
          <Text style={styles.foot}>
            오늘부터 {weeks}주 일정이 공유됩니다.
          </Text>
        </View>

        <View style={styles.warn}>
          <IconAlertCircle size={18} color={theme.t.danger} />
          <Text style={styles.warnText}>
            링크를 받은 사람은 누구나 아이 이름과 일정을 확인할 수 있어요. 믿을 수 있는 보호자에게만 전달해주세요.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={() => void onShare()} accessibilityRole="button" style={styles.cta} testID="share-link">
          <Text style={styles.ctaText}>링크 공유하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((th) => ({
  safe: { flex: 1, backgroundColor: th.t.groupedBg },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm },
  navSide: { width: 72, paddingHorizontal: SPACING.sm },
  close: { ...TYPE.row, color: th.t.danger },
  title: { ...TYPE.headline, flex: 1, textAlign: 'center', color: th.t.ink },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, paddingBottom: SPACING.xl, gap: 22 },
  block: { gap: 6 },
  header: { ...TYPE.footnote, color: th.t.inkSub, paddingHorizontal: SPACING.lg },
  foot: { ...TYPE.footnote, color: th.t.inkSub, paddingHorizontal: SPACING.lg },
  periodRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingLeft: SPACING.lg, paddingRight: SPACING.lg, borderBottomWidth: 0.5, borderBottomColor: th.t.separator },
  label: { ...TYPE.row, color: th.t.ink },
  seg: { flex: 1 },
  warn: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.box, backgroundColor: th.t.primaryTint },
  warnText: { ...TYPE.footnote, flex: 1, color: th.t.danger },
  kidList: { paddingLeft: SPACING.lg },
  footer: { paddingHorizontal: 20, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  cta: { height: 54, borderRadius: RADIUS.full, backgroundColor: th.t.primary, alignItems: 'center', justifyContent: 'center' },
  ctaText: { ...TYPE.headline, color: th.t.onDark },
}));
