import { DATABASE_NAME, LEGACY_DATABASE_NAMES } from '../config';

describe('database name', () => {
  it('never reuses a file name from an incompatible earlier schema', () => {
    expect(LEGACY_DATABASE_NAMES).toContain('lockin.db');
    expect(LEGACY_DATABASE_NAMES).not.toContain(DATABASE_NAME);
  });
});
