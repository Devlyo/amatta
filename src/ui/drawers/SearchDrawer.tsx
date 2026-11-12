// 1:1 port of SearchDrawer from docs/design/amatta-v1/app-weekly-drawers.jsx,
// extended with real data sources.
//
// The prototype searches only over (mock) weekly events. We fan out across the
// three real surfaces:
//   • schedules — title or location matches
//   • todos     — title matches (todos may be unattached → no kid caption)
//   • checklist — label matches; resolved to its parent schedule for the kid
//
// Tapping a schedule result opens EventDetailDrawer for *today's* occurrence
// (the day the user is currently viewing). Todos and checklist items currently
// only close the drawer — focusing them inside their respective list is left
// for a follow-up (the corresponding sections don't yet support deep-linking).

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useChildrenStore } from '../../state/children-store';
import { useChecklistStore } from '../../state/checklist-store';
import { useSchedulesStore } from '../../state/schedules-store';
import { useTodosStore } from '../../state/todos-store';
import type {
  ChecklistItem,
  Child,
  Schedule,
  Todo,
} from '../../domain/types';
import { memberNames } from '../../domain/occurrences';
import { KidAvatar } from '../common/KidAvatar';
import { IconCheck, IconChevronRight, IconSearch, IconXMark } from '../icons';
import { repeatSummary, TYPE_LABELS_KO } from '../sheets/edit-sheet-form';
import { TYPE } from '../typography';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { fmtRange, todayIso } from '../utils/date';
import { makeStyles, useTheme } from '../appearance';

type Result =
  | { kind: 'schedule'; key: string; schedule: Schedule; child: Child | undefined }
  | { kind: 'todo'; key: string; todo: Todo; child: Child | undefined }
  | {
      kind: 'checklist';
      key: string;
      item: ChecklistItem;
      schedule: Schedule | undefined;
      child: Child | undefined;
    };

function matches(haystack: string | null | undefined, needle: string): boolean {
  if (haystack === null || haystack === undefined) return false;
  return haystack.toLowerCase().includes(needle);
}

export interface SearchContentProps {
  onClose: () => void;
}

export function SearchContent({ onClose }: SearchContentProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const todos = useTodosStore((s) => s.todos);
  const itemsByScheduleId = useChecklistStore((s) => s.itemsByScheduleId);

  // Query starts empty on every mount — the route mounts a fresh body each open,
  // so no close-reset effect is needed.
  const [query, setQuery] = useState('');

  const childById = useMemo(() => {
    const m = new Map<number, Child>();
    for (const c of children) m.set(c.id, c);
    return m;
  }, [children]);

  const scheduleById = useMemo(() => {
    const m = new Map<number, Schedule>();
    for (const s of schedules) m.set(s.id, s);
    return m;
  }, [schedules]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return [];

    const out: Result[] = [];

    for (const s of schedules) {
      const child = childById.get(s.childId);
      // Also match a member's name so e.g. "민준" surfaces every schedule 민준 is on (ADR-013).
      const memberHit = (s.memberIds ?? [s.childId]).some((id) => matches(childById.get(id)?.name, q));
      if (matches(s.title, q) || matches(s.location, q) || memberHit) {
        out.push({
          kind: 'schedule',
          key: `s-${s.id}`,
          schedule: s,
          child,
        });
      }
    }

    for (const t of todos) {
      if (matches(t.title, q)) {
        out.push({
          kind: 'todo',
          key: `t-${t.id}`,
          todo: t,
          child: t.childId === null ? undefined : childById.get(t.childId),
        });
      }
    }

    for (const items of itemsByScheduleId.values()) {
      for (const item of items) {
        if (matches(item.label, q)) {
          const parent = scheduleById.get(item.scheduleId);
          out.push({
            kind: 'checklist',
            key: `c-${item.id}`,
            item,
            schedule: parent,
            child: parent === undefined ? undefined : childById.get(parent.childId),
          });
        }
      }
    }

    return out;
  }, [query, schedules, todos, itemsByScheduleId, childById, scheduleById]);

  // Sibling-swap via replace (NOT onClose()+push — that races: the close
  // fires router.back after the push, popping the new route).
  const handleSelectSchedule = useCallback(
    (schedule: Schedule) => {
      router.replace({
        pathname: '/event/detail',
        params: { scheduleId: String(schedule.id), occurrenceDate: todayIso() },
      });
    },
    [router],
  );

  const handleSelectTodo = useCallback(() => {
    // TODO(R3.x): focus this todo inside TodoSection. The todo tab doesn't yet
    // expose an imperative focus API, so close the sheet for now.
    onClose();
  }, [onClose]);

  const handleSelectChecklist = useCallback(
    (result: Extract<Result, { kind: 'checklist' }>) => {
      // TODO(R3.x): focus the checklist item under its schedule. For now, if
      // we know the parent schedule, fall back to opening EventDetailDrawer for
      // it — the checklist will be visible in that view.
      if (result.schedule !== undefined) {
        router.replace({
          pathname: '/event/detail',
          params: { scheduleId: String(result.schedule.id), occurrenceDate: todayIso() },
        });
      } else {
        onClose();
      }
    },
    [router, onClose],
  );

  const trimmed = query.trim();
  const showEmpty = trimmed === '';
  const groups: { title: string; items: Result[] }[] = [
    { title: '일정', items: results.filter((r) => r.kind === 'schedule') },
    { title: '준비물', items: results.filter((r) => r.kind === 'checklist') },
    { title: '할 일', items: results.filter((r) => r.kind === 'todo') },
  ].filter((g) => g.items.length > 0);

  // Board SR1/SR2 (2026-11-12): grouped iOS lists on the system background.
  return (
    <View style={styles.contentRoot}>
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        testID="search-drawer-content"
        // The search field rides at the top while results scroll under it.
        stickyHeaderIndices={[0]}
      >
        <View style={styles.searchRow}>
          <View style={styles.inputBox}>
            <IconSearch size={16} color={theme.t.inkSub} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="일정·준비물·할 일·자녀 검색"
              placeholderTextColor={theme.t.ink50}
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
              returnKeyType="search"
              testID="search-drawer-input"
              accessibilityLabel="검색어 입력"
            />
            {trimmed.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="검색어 지우기"
                hitSlop={8}
                style={styles.clearBtn}
              >
                <IconXMark size={10} color={theme.t.surface} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} testID="search-cancel">
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
        </View>
        {showEmpty ? (
          <Text style={styles.placeholder}>검색어를 입력하세요</Text>
        ) : results.length === 0 ? (
          <Text style={styles.placeholder}>검색 결과가 없어요</Text>
        ) : (
          <>
            <Text style={styles.resultsCount} accessibilityLiveRegion="polite">
              결과 {results.length}건
            </Text>
            {groups.map((g) => (
              <View key={g.title} style={styles.group}>
                <Text style={styles.groupTitle}>
                  {g.title} {g.items.length}
                </Text>
                <View style={styles.groupBox}>
                  {g.items.map((r, i) => (
                    <ResultRow
                      key={r.key}
                      result={r}
                      last={i === g.items.length - 1}
                      childById={childById}
                      onSelectSchedule={handleSelectSchedule}
                      onSelectTodo={handleSelectTodo}
                      onSelectChecklist={handleSelectChecklist}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface ResultRowProps {
  result: Result;
  last: boolean;
  childById: Map<number, Child>;
  onSelectSchedule: (schedule: Schedule) => void;
  onSelectTodo: () => void;
  onSelectChecklist: (result: Extract<Result, { kind: 'checklist' }>) => void;
}

function dueLabel(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function ResultRow({ result, last, childById, onSelectSchedule, onSelectTodo, onSelectChecklist }: ResultRowProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  let title: string;
  let caption: string;
  let onPress: () => void;
  let label: string;
  let testID: string;
  if (result.kind === 'schedule') {
    const s = result.schedule;
    const who = memberNames(s.memberIds ?? [s.childId], childById, s.withGuardian === true) || result.child?.name || '';
    const oneOff = s.validUntil !== null && s.validUntil === s.validFrom;
    const when = s.allDay ? '하루 종일' : fmtRange(s.startMinutes, s.endMinutes);
    const repeat = oneOff ? `${Number((s.validFrom as unknown as string).slice(5, 7))}월 ${Number((s.validFrom as unknown as string).slice(8, 10))}일` : repeatSummary(s.daysOfWeek);
    title = s.title;
    caption = [who, TYPE_LABELS_KO[s.type], `${repeat} ${when}`].filter((x) => x !== '').join(' · ');
    onPress = () => onSelectSchedule(s);
    label = `일정: ${s.title}`;
    testID = `search-result-schedule-${s.id}`;
  } else if (result.kind === 'todo') {
    title = result.todo.title;
    caption = [result.child?.name ?? '', `${dueLabel(result.todo.dueAt)}까지`].filter((x) => x !== '').join(' · ');
    onPress = onSelectTodo;
    label = `할 일: ${result.todo.title}`;
    testID = `search-result-todo-${result.todo.id}`;
  } else {
    title = result.item.label;
    caption = [result.child?.name ?? '', result.schedule?.title ?? '', result.item.recurring ? '매번' : '이번만']
      .filter((x) => x !== '')
      .join(' · ');
    onPress = () => onSelectChecklist(result);
    label = `준비물: ${result.item.label}`;
    testID = `search-result-checklist-${result.item.id}`;
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.row} testID={testID}>
      {result.child !== undefined ? (
        <KidAvatar child={result.child} size={30} />
      ) : (
        <View style={styles.noKid}>
          <IconCheck size={14} color={theme.t.inkSub} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {caption !== '' ? (
          <Text style={styles.rowCaption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      <IconChevronRight size={14} color={theme.t.inkSub} />
      {last ? null : <View style={styles.separator} />}
    </Pressable>
  );
}

const useStyles = makeStyles((th) => ({
  // The native route sheet owns scrim/shape/grabber; system grey underneath.
  contentRoot: { flex: 1, backgroundColor: th.t.groupedBg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    // Sticky: covers results scrolling underneath.
    backgroundColor: th.t.groupedBg,
  },
  inputBox: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: th.t.ink06,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  input: { ...TYPE.row, flex: 1, color: th.t.ink, padding: 0 },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.inkSub,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { ...TYPE.row, color: th.t.primaryDeep },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: 18 },
  placeholder: { ...TYPE.subhead, color: th.t.inkSub, textAlign: 'center', paddingVertical: SPACING.xxl },
  resultsCount: { ...TYPE.footnote, color: th.t.inkSub, paddingHorizontal: SPACING.lg, marginBottom: -10 },
  group: { gap: 6 },
  groupTitle: { ...TYPE.footnote, color: th.t.inkSub, paddingHorizontal: SPACING.lg },
  groupBox: { backgroundColor: th.t.surface, borderRadius: RADIUS.box, overflow: 'hidden' },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 14,
  },
  noKid: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.ink06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { ...TYPE.row, color: th.t.ink },
  rowCaption: { ...TYPE.footnote, color: th.t.inkSub },
  separator: {
    position: 'absolute',
    left: 56,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: th.t.separator,
  },
}));
