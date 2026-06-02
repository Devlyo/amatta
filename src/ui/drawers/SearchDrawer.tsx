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

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useChildrenStore } from '../../state/children-store';
import { useChecklistStore } from '../../state/checklist-store';
import { useSchedulesStore } from '../../state/schedules-store';
import { useTodosStore } from '../../state/todos-store';
import { useUiStore } from '../../state/ui-store';
import type {
  ChecklistItem,
  Child,
  Schedule,
  Todo,
} from '../../domain/types';
import { ColorDot } from '../common/ColorDot';
import { FONT_FAMILIES } from '../fonts';
import { IconCheck, IconSearch, IconXMark, KIND_ICON } from '../icons';
import { TOKENS } from '../palette';
import { todayIso } from '../utils/date';

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

export function SearchDrawer(): React.ReactElement {
  const open = useUiStore((s) => s.searchDrawerOpen);
  const closeSearch = useUiStore((s) => s.closeSearch);
  const openEventDetail = useUiStore((s) => s.openEventDetail);

  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const todos = useTodosStore((s) => s.todos);
  const itemsByScheduleId = useChecklistStore((s) => s.itemsByScheduleId);

  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      // Clear the query when the sheet closes so re-opens start fresh — matches
      // the prototype's `setQ('')` on close.
      setQuery('');
    }
  }, [open]);

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
      if (matches(s.title, q) || matches(s.location, q)) {
        out.push({
          kind: 'schedule',
          key: `s-${s.id}`,
          schedule: s,
          child: childById.get(s.childId),
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

  const handleSelectSchedule = useCallback(
    (schedule: Schedule) => {
      openEventDetail({
        scheduleId: schedule.id,
        occurrenceDate: todayIso(),
      });
      closeSearch();
    },
    [openEventDetail, closeSearch],
  );

  const handleSelectTodo = useCallback(() => {
    // TODO(R3.x): focus this todo inside TodoSection. The todo tab doesn't yet
    // expose an imperative focus API, so close the sheet for now.
    closeSearch();
  }, [closeSearch]);

  const handleSelectChecklist = useCallback(
    (result: Extract<Result, { kind: 'checklist' }>) => {
      // TODO(R3.x): focus the checklist item under its schedule. For now, if
      // we know the parent schedule, fall back to opening EventDetailDrawer for
      // it — the checklist will be visible in that view.
      if (result.schedule !== undefined) {
        openEventDetail({
          scheduleId: result.schedule.id,
          occurrenceDate: todayIso(),
        });
      }
      closeSearch();
    },
    [openEventDetail, closeSearch],
  );

  const trimmed = query.trim();
  const showEmpty = trimmed === '';

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={closeSearch}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={closeSearch} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.sheet, showEmpty ? styles.sheetCompact : null]}
      >
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          testID="search-drawer-content"
        >
          {/* Search input */}
          <View style={styles.inputWrap}>
            <View style={styles.inputBox}>
              <IconSearch size={16} color={TOKENS.inkSub} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="일정·장소·자녀 검색"
                placeholderTextColor={TOKENS.inkSub}
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="none"
                testID="search-drawer-input"
                accessibilityLabel="검색어 입력"
              />
              {trimmed.length > 0 ? (
                <Pressable
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="검색어 지우기"
                  hitSlop={6}
                  style={styles.clearBtn}
                >
                  <IconXMark size={14} color={TOKENS.inkSub} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Results / empty state */}
          <View style={styles.resultsWrap}>
            {showEmpty ? (
              <Text style={styles.placeholder}>검색어를 입력하세요</Text>
            ) : (
              <>
                <Text style={styles.resultsCount}>결과 {results.length}건</Text>
                {results.length === 0 ? (
                  <Text style={styles.noResults}>검색 결과가 없습니다</Text>
                ) : (
                  <View style={styles.resultList}>
                    {results.map((r) => (
                      <ResultRow
                        key={r.key}
                        result={r}
                        onSelectSchedule={handleSelectSchedule}
                        onSelectTodo={handleSelectTodo}
                        onSelectChecklist={handleSelectChecklist}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ResultRowProps {
  result: Result;
  onSelectSchedule: (schedule: Schedule) => void;
  onSelectTodo: () => void;
  onSelectChecklist: (
    result: Extract<Result, { kind: 'checklist' }>,
  ) => void;
}

function ResultRow({
  result,
  onSelectSchedule,
  onSelectTodo,
  onSelectChecklist,
}: ResultRowProps): React.ReactElement {
  if (result.kind === 'schedule') {
    const KindIcon = KIND_ICON[result.schedule.type];
    return (
      <Pressable
        onPress={() => onSelectSchedule(result.schedule)}
        accessibilityRole="button"
        accessibilityLabel={`일정: ${result.schedule.title}`}
        style={styles.row}
        testID={`search-result-schedule-${result.schedule.id}`}
      >
        <View style={styles.iconWrap}>
          <KindIcon size={14} color={TOKENS.ink} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {result.schedule.title}
          </Text>
          <View style={styles.rowCaption}>
            {result.child !== undefined ? (
              <>
                <ColorDot colorIndex={result.child.colorIndex} size={8} />
                <Text style={styles.rowCaptionText} numberOfLines={1}>
                  {result.child.name}
                  {result.schedule.location !== null
                    ? ` · ${result.schedule.location}`
                    : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.rowCaptionText} numberOfLines={1}>
                {result.schedule.location ?? ''}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  if (result.kind === 'todo') {
    return (
      <Pressable
        onPress={onSelectTodo}
        accessibilityRole="button"
        accessibilityLabel={`할 일: ${result.todo.title}`}
        style={styles.row}
        testID={`search-result-todo-${result.todo.id}`}
      >
        <View style={styles.iconWrap}>
          <IconCheck size={14} color={TOKENS.ink} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {result.todo.title}
          </Text>
          <View style={styles.rowCaption}>
            {result.child !== undefined ? (
              <>
                <ColorDot colorIndex={result.child.colorIndex} size={8} />
                <Text style={styles.rowCaptionText} numberOfLines={1}>
                  {result.child.name} · 할 일
                </Text>
              </>
            ) : (
              <Text style={styles.rowCaptionText} numberOfLines={1}>
                할 일
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  // checklist
  return (
    <Pressable
      onPress={() => onSelectChecklist(result)}
      accessibilityRole="button"
      accessibilityLabel={`준비물: ${result.item.label}`}
      style={styles.row}
      testID={`search-result-checklist-${result.item.id}`}
    >
      <View style={styles.iconWrap}>
        <IconCheck size={14} color={TOKENS.ink} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {result.item.label}
        </Text>
        <View style={styles.rowCaption}>
          {result.child !== undefined ? (
            <>
              <ColorDot colorIndex={result.child.colorIndex} size={8} />
              <Text style={styles.rowCaptionText} numberOfLines={1}>
                {result.child.name}
                {result.schedule !== undefined
                  ? ` · ${result.schedule.title}`
                  : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.rowCaptionText} numberOfLines={1}>
              준비물
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,29,27,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '22%',
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  // Empty-query state — shrink sheet to match CalendarDrawer footprint
  // (top:'50%' + paddingBottom 8) so the bottom whitespace stays consistent.
  sheetCompact: {
    top: '50%',
    paddingBottom: 8,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKENS.ink30,
  },
  sheetScroll: { flex: 1 },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  inputWrap: {
    paddingTop: 6,
    paddingBottom: 10,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TOKENS.ink04,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultsWrap: {
    flex: 1,
    paddingTop: 4,
  },
  placeholder: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    textAlign: 'center',
    paddingVertical: 24,
  },
  resultsCount: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  noResults: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    textAlign: 'center',
    paddingVertical: 20,
  },
  resultList: {
    gap: 4,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  rowCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  rowCaptionText: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    flexShrink: 1,
  },
});
