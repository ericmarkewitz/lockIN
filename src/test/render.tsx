import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DbProvider } from '@/db/DbContext';
import type { Db } from '@/db/types';

export const renderWithDb = (ui: ReactElement, db: Db) => render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DbProvider db={db}>{ui}</DbProvider>
    </GestureHandlerRootView>,
  );
