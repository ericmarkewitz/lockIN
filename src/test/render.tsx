import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { DbProvider } from '@/db/DbContext';
import type { Db } from '@/db/types';

export const renderWithDb = (ui: ReactElement, db: Db) => render(<DbProvider db={db}>{ui}</DbProvider>);
