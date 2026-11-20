import { dropIndex, dropIndexByHeights, moveItem } from '../reorder';

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

describe('dropIndexByHeights', () => {
  // Rows 100, 40, 40, 200 tall with a 10 gap.
  const heights = [100, 40, 40, 200];

  it('passes a row once the drag covers half of it', () => {
    expect(dropIndexByHeights(0, 0, heights, 10)).toBe(0);
    expect(dropIndexByHeights(0, 24, heights, 10)).toBe(0);
    expect(dropIndexByHeights(0, 26, heights, 10)).toBe(1);
    expect(dropIndexByHeights(0, 76, heights, 10)).toBe(2);
    expect(dropIndexByHeights(0, 204, heights, 10)).toBe(2);
    expect(dropIndexByHeights(0, 206, heights, 10)).toBe(3);
  });

  it('works upwards too', () => {
    expect(dropIndexByHeights(3, -24, heights, 10)).toBe(3);
    expect(dropIndexByHeights(3, -26, heights, 10)).toBe(2);
    expect(dropIndexByHeights(3, -106, heights, 10)).toBe(1);
    expect(dropIndexByHeights(3, -156, heights, 10)).toBe(0);
  });

  it('clamps to the list bounds', () => {
    expect(dropIndexByHeights(1, 5000, heights, 10)).toBe(3);
    expect(dropIndexByHeights(1, -5000, heights, 10)).toBe(0);
  });

  it('stays put when a height on the way is unknown', () => {
    expect(dropIndexByHeights(0, 500, [100, undefined, 40], 10)).toBe(0);
  });
});
