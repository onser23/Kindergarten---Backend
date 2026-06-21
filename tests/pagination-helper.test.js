const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');

describe('parsePagination', () => {
  test('default values (page=1, limit=20)', () => {
    const r = parsePagination({});
    expect(r).toEqual({ page: 1, limit: 20, skip: 0 });
  });
  test('custom page and limit', () => {
    const r = parsePagination({ page: '3', limit: '10' });
    expect(r).toEqual({ page: 3, limit: 10, skip: 20 });
  });
  test('limit capped at maxLimit (100)', () => {
    const r = parsePagination({ limit: '500' });
    expect(r.limit).toBe(100);
  });
  test('limit default 20 when invalid', () => {
    const r = parsePagination({ limit: 'abc' });
    expect(r.limit).toBe(20);
  });
  test('page defaults to 1 when invalid', () => {
    const r = parsePagination({ page: 'xyz' });
    expect(r.page).toBe(1);
  });
  test('page minimum 1 when 0 or negative', () => {
    const r = parsePagination({ page: '0' });
    expect(r.page).toBe(1);
  });
  test('custom defaultLimit', () => {
    const r = parsePagination({}, 15);
    expect(r.limit).toBe(15);
  });
});

describe('buildPaginatedResponse', () => {
  test('basic response', () => {
    const r = buildPaginatedResponse([1, 2, 3], 10, 1, 5);
    expect(r).toEqual({ success: true, total: 10, page: 1, totalPages: 2, count: 3, data: [1, 2, 3] });
  });
  test('empty data', () => {
    const r = buildPaginatedResponse([], 0, 1, 20);
    expect(r).toEqual({ success: true, total: 0, page: 1, totalPages: 0, count: 0, data: [] });
  });
  test('extra fields merged', () => {
    const r = buildPaginatedResponse([1], 5, 1, 2, { myExtra: 'x' });
    expect(r.myExtra).toBe('x');
  });
});
