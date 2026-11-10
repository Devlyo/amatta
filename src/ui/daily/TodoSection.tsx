import { memo, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTodosStore, useUiStore } from '../../state';
import { getDb } from '../../db/client';
import type { ISODate, Todo } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import Ionicons from '@expo/vector-icons/Ionicons';

import { IconCheck } from '../icons';
import { SwipeToDelete } from '../common/SwipeToDelete';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { isDueOnDate } from '../utils/date';
import { makeStyles, useTheme } from '../appearance';

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
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text style={styles.headerLabel}>{label}</Text>
      <Text style={styles.headerCount}>
        {done}/{total}
      </Text>
    </View>
  );
}

interface TodoSectionProps {
  /** Date to show. Defaults to the calendar's `currentDate`; home passes today. */
  date?: ISODate;
}

function TodoSectionImpl({ date }: TodoSectionProps = {}): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const todos = useTodosStore((s) => s.todos);
  const storeDate = useUiStore((s) => s.currentDate);
  const currentDate = date ?? storeDate;

  // Todos are date-bound — only show the ones due on the day the daily view
  // is anchored to. A todo added on June 5 must not appear on June 6.
  const sorted = useMemo<Todo[]>(() => {
    return todos
      .filter((t) => isDueOnDate(t.dueAt, currentDate))
      .sort((a, b) => {
        if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
        return a.id - b.id;
      });
  }, [todos, currentDate]);

  const total = sorted.length;
  const done = sorted.filter((t) => t.isDone).length;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  const onToggle = async (id: number): Promise<void> => {
    const db = await getDb();
    await useTodosStore.getState().toggleDone(db, id);
  };

  // Swipe-to-delete is a deliberate gesture (a long swipe or the 삭제 tap),
  // so no extra confirm — like iOS lists.
  const onDelete = async (id: number): Promise<void> => {
    const db = await getDb();
    await useTodosStore.getState().removeOne(db, id);
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
        {sorted.map((todo, i) => {
          const isDone = todo.isDone;
          return (
            <SwipeToDelete
              key={todo.id}
              onDelete={() => void onDelete(todo.id)}
              accessibilityLabel={todo.title}
              testID={`todo-row-${todo.id}`}
            >
            {/* Line between todos, inset to the labels (same as 준비물). */}
            {i > 0 ? <View style={styles.itemSeparator} /> : null}
              <Pressable
                onPress={() => {
                  void onToggle(todo.id);
                }}
                style={styles.itemRow}
                testID={`todo-item-${todo.id}`}
              >
                <View
                  style={[
                    styles.checkbox,
                    isDone ? styles.itemRowDone : null,
                    isDone
                      ? { backgroundColor: theme.t.primary, borderColor: theme.t.primary }
                      : styles.checkboxIdle,
                  ]}
                >
                  {isDone ? <IconCheck size={12} color={theme.t.surface} /> : null}
                </View>
                <Text style={[styles.itemLabel, isDone ? styles.itemLabelDone : null, isDone ? styles.itemRowDone : null]}>
                  {todo.title}
                </Text>
              </Pressable>
            </SwipeToDelete>
          );
        })}

        <Pressable
          onPress={beginAdd}
          accessibilityRole="button"
          accessibilityLabel="할일 추가"
          style={[styles.addRow, sorted.length > 0 ? styles.addRowDivider : null]}
          testID="todo-add-row"
        >
          {/* Same as the form's 준비물 추가: red add-circle + red label. */}
          <Ionicons name="add-circle" size={22} color={theme.t.danger} />
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
              placeholder="할일"
              placeholderTextColor={theme.t.inkSub}
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

const useStyles = makeStyles((th) => ({
  // Matches HomeSection (home screen headings): headline + muted count,
  // 6px above the box. These sections now live only on the home screen.
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: SPACING.xs,
    paddingBottom: 6,
  },
  headerLabel: { ...TYPE.headline, color: th.t.ink },
  headerCount: { ...TYPE.subhead, color: th.t.inkSub },
  card: {
    backgroundColor: th.t.surface,
    borderRadius: RADIUS.box,
    padding: 6,
  },
  // Inset to the label: card padding 6 + row padding 10 + checkbox 22 + gap 10.
  itemSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: th.t.separator,
    marginLeft: 42,
    marginRight: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    // Opaque, so the red 삭제 behind it shows only while swiping.
    backgroundColor: th.t.surface,
  },
  itemRowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxIdle: {
    backgroundColor: th.t.surface,
    borderColor: th.t.ink30,
  },
  itemLabel: {
    flex: 1,
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 16,
    fontWeight: '400',
    color: th.t.ink,
    letterSpacing: -0.2,
  },
  itemLabelDone: {
    textDecorationLine: 'line-through',
  },
  // The form's FormActionRow look (준비물 추가): 44pt row, hairline above.
  addRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  addRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: th.t.separator,
    marginTop: SPACING.xxs,
  },
  addLabel: { ...TYPE.row, flex: 1, color: th.t.danger },
  addInput: {
    flex: 1,
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 16,
    fontWeight: '400',
    color: th.t.ink,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },
}));
