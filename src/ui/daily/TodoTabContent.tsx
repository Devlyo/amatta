import { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { TOKENS } from '../palette';
import { SPACING } from '../spacing';
import { ChecklistSection } from './ChecklistSection';
import { TodoSection } from './TodoSection';

function TodoTabContentImpl(): React.ReactElement {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      // Keyboard handling: when the "할일 추가" input (bottom of the list) is
      // focused, inset the scroll content by the keyboard height so the field
      // scrolls above the keyboard instead of being covered. keyboardShouldPersistTaps
      // keeps a tap on another row working without first dismissing the keyboard.
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      testID="todo-tab-content"
    >
      <ChecklistSection />
      <TodoSection />
    </ScrollView>
  );
}

export const TodoTabContent = memo(TodoTabContentImpl);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    // Was an inline '#F7F6F5' literal (feedback-memory only-defined-tokens
    // violation). TOKENS.surfaceSoft is now the same value across the
    // app — settings hub, todo/checklist tab, and the settings detail
    // pages all share this warm gray.
    backgroundColor: TOKENS.surfaceSoft,
  },
  content: {
    paddingTop: SPACING.xs,
    paddingHorizontal: 14,
    paddingBottom: 100,
  },
});
