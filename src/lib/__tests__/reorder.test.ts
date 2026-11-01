import { dropIndex, moveItem } from '../reorder';

describe('moveItem', () => {
  it('moves an item forward and back without mutating the input', () => {
    const src = ['a', 'b', 'c', 'd'];
    expect(moveItem(src, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(src, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(src).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns the same order for a no-op or out-of-range move', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  });
});

describe('dropIndex', () => {
  it('snaps to the row the dragged item is closest to', () => {
    expect(dropIndex(1, 0, 50, 4)).toBe(1);
    expect(dropIndex(1, 24, 50, 4)).toBe(1);
    expect(dropIndex(1, 26, 50, 4)).toBe(2);
    expect(dropIndex(2, -80, 50, 4)).toBe(0);
  });

  it('clamps to the list bounds', () => {
    expect(dropIndex(1, 1000, 50, 4)).toBe(3);
    expect(dropIndex(1, -1000, 50, 4)).toBe(0);
  });

  it('stays put when the row height is unknown', () => {
    expect(dropIndex(2, 100, 0, 4)).toBe(2);
  });
});
