import { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { TOKENS } from '../palette';
import { ChecklistSection } from './ChecklistSection';
import { TodoSection } from './TodoSection';

function TodoTabContentImpl(): React.ReactElement {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
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
    paddingTop: 4,
    paddingHorizontal: 14,
    paddingBottom: 100,
  },
});
