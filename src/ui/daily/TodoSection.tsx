import { memo, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTodosStore, useUiStore } from '../../state';
import { getDb } from '../../db/client';
import type { ISODate, Todo } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import { IconCheck, IconPlus } from '../icons';
import { TOKENS } from '../palette';
import { formatTodoDue } from '../utils/date';

// Build a local-time epoch-ms anchor for the given calendar date at 12:00,
// so the resulting `dueAt` falls cleanly inside that day regardless of the
// device's timezone (avoids the midnight-boundary off-by-one).
function isoToNoonEpoch(iso: ISODate): number {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

function SectionHeader({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerLabel}>{label}</Text>
      <Text style={styles.headerCount}>
        {done}/{total}
      </Text>
    </View>
  );
}

function TodoSectionImpl(): React.ReactElement {
  const todos = useTodosStore((s) => s.todos);
  const currentDate = useUiStore((s) => s.currentDate);

  const sorted = useMemo<Todo[]>(() => {
    return [...todos].sort((a, b) => {
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      return a.id - b.id;
    });
  }, [todos]);

  const total = sorted.length;
  const done = sorted.filter((t) => t.isDone).length;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  const onToggle = async (id: number): Promise<void> => {
    const db = await getDb();
    await useTodosStore.getState().toggleDone(db, id);
  };

  const commitDraft = async (): Promise<void> => {
    const title = draft.trim();
    setDraft('');
    setAdding(false);
    if (title.length === 0) return;
    const db = await getDb();
    // Bind the new todo to the date the user is currently viewing. This is
    // what the date pill above the grid implies — a todo added on June 3 is
    // a June 3 todo, not a "tomorrow" todo.
    await useTodosStore.getState().add(db, {
      childId: null,
      title,
      dueAt: isoToNoonEpoch(currentDate),
      notifyMinutesBefore: null,
    });
  };

  const cancelDraft = (): void => {
    setDraft('');
    setAdding(false);
  };

  const beginAdd = (): void => {
    setAdding(true);
    // Focus on next tick — TextInput needs to mount before focus().
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <View testID="todo-section">
      <SectionHeader label="할일" done={done} total={total} />
      <View style={styles.card}>
        {sorted.map((todo) => {
          const isDone = todo.isDone;
          return (
            <Pressable
              key={todo.id}
              onPress={() => {
                void onToggle(todo.id);
              }}
              style={[styles.itemRow, isDone ? styles.itemRowDone : null]}
              testID={`todo-item-${todo.id}`}
            >
              <View
                style={[
                  styles.checkbox,
                  isDone
                    ? { backgroundColor: TOKENS.primary, borderColor: TOKENS.primary }
                    : styles.checkboxIdle,
                ]}
              >
                {isDone ? <IconCheck size={12} color="#fff" /> : null}
              </View>
              <Text style={[styles.itemLabel, isDone ? styles.itemLabelDone : null]}>
                {todo.title}
              </Text>
              <View style={styles.duePill}>
                <Text style={styles.duePillText}>{formatTodoDue(todo.dueAt, currentDate)}</Text>
              </View>
            </Pressable>
          );
        })}

        <Pressable
          onPress={beginAdd}
          style={[styles.addRow, sorted.length > 0 ? styles.addRowDivider : null]}
          testID="todo-add-row"
        >
          <View style={styles.addCheckbox}>
            <IconPlus size={14} color={TOKENS.ink50} />
          </View>
          {adding ? (
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => {
                void commitDraft();
              }}
              onBlur={() => {
                void commitDraft();
              }}
              placeholder="할일 입력 후 Enter…"
              placeholderTextColor={TOKENS.inkSub}
              returnKeyType="done"
              style={styles.addInput}
              testID="todo-add-input"
              blurOnSubmit
              autoFocus
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Escape') {
                  cancelDraft();
                }
              }}
            />
          ) : (
            <Text style={styles.addLabel}>할일 추가</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export const TodoSection = memo(TodoSectionImpl);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingTop: 14,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  headerLabel: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: TOKENS.ink,
  },
  headerCount: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 11,
    fontWeight: '400',
    color: TOKENS.inkSub,
  },
  card: {
    backgroundColor: TOKENS.surface,
    borderRadius: 18,
    padding: 6,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  itemRowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxIdle: {
    backgroundColor: TOKENS.surface,
    borderColor: TOKENS.ink30,
  },
  itemLabel: {
    flex: 1,
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 13,
    fontWeight: '400',
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  itemLabelDone: {
    textDecorationLine: 'line-through',
  },
  duePill: {
    backgroundColor: TOKENS.ink04,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 99,
  },
  duePillText: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 10,
    fontWeight: '400',
    color: TOKENS.inkSub,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 2,
  },
  addRowDivider: {
    borderTopWidth: 1,
    borderTopColor: TOKENS.hair,
    borderStyle: 'dashed',
  },
  addCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: TOKENS.ink30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    flex: 1,
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 13,
    fontWeight: '400',
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  addInput: {
    flex: 1,
    fontFamily: FONT_FAMILIES.pretendardBold,
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.ink,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },
});
