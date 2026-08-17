/** Longest search term accepted — anything longer is a scan, not a search. */
export const MAX_SEARCH_LENGTH = 64;

/**
 * Escape the wildcards Postgres LIKE/ILIKE treats specially so a search for
 * "%" matches a literal percent sign instead of every row in the table.
 * Backslash is the default LIKE escape character in Postgres.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export interface SearchTerm {
  /** Exact term, used for relevance ordering. */
  exact: string;
  /** Escaped `%term%` pattern, used for matching. */
  pattern: string;
}

/**
 * Normalize a raw query string into safe SQL search inputs.
 * Returns null when the query is empty and no search should run.
 */
export function normalizeSearchTerm(value: string | null | undefined): SearchTerm | null {
  const trimmed = (value ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
  if (trimmed.length === 0) return null;

  const escaped = escapeLikePattern(trimmed);
  return { exact: escaped, pattern: `%${escaped}%` };
}
