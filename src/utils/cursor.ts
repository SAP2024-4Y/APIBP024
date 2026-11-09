/** Encode an opaque cursor from a record's sort field value and its id. */
export function encodeCursor(sortField: string, sortValue: string | number, id: string): string {
  return Buffer.from(JSON.stringify({ sortField, sortValue, id })).toString('base64url');
}

/** Decode a cursor; returns null on invalid input. */
export function decodeCursor(cursor: string): { sortField: string; sortValue: string | number; id: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Build the WHERE clause fragment and params for keyset pagination.
 * Assumes the result set is already filtered; we append this to existing WHERE conditions.
 *
 * For ASC:  next page is WHERE (sortField > cursorVal) OR (sortField = cursorVal AND id > cursorId)
 * For DESC: next page is WHERE (sortField < cursorVal) OR (sortField = cursorVal AND id < cursorId)
 */
export function buildCursorWhere(
  cursor: { sortField: string; sortValue: string | number; id: string },
  order: 'asc' | 'desc',
  tableAlias = 'e'
): { sql: string; params: (string | number)[] } {
  const col = `${tableAlias}.${cursor.sortField}`;
  const idCol = `${tableAlias}.id`;
  const op = order === 'asc' ? '>' : '<';
  return {
    sql: `(${col} ${op} ? OR (${col} = ? AND ${idCol} ${op} ?))`,
    params: [cursor.sortValue, cursor.sortValue, cursor.id],
  };
}
