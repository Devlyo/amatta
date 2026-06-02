import { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

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
    backgroundColor: '#F7F6F5',
  },
  content: {
    paddingTop: 4,
    paddingHorizontal: 14,
    paddingBottom: 100,
  },
});
