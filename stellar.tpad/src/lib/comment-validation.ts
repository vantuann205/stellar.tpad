import { StrKey } from '@stellar/stellar-sdk';

/** Comments are stored in an unbounded TEXT column, so the cap is enforced here. */
export const MAX_COMMENT_LENGTH = 500;

/** Author shown when a comment is posted without a connected wallet. */
export const ANONYMOUS_AUTHOR = 'Anonymous';

export class CommentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommentValidationError';
  }
}

/** Trim a comment body and reject empty or oversized text. */
export function normalizeCommentText(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0) {
    throw new CommentValidationError('Comment text is required');
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new CommentValidationError(`Comment must be at most ${MAX_COMMENT_LENGTH} characters`);
  }
  return text;
}

/**
 * Resolve the comment author.
 * An address is only accepted when it is a valid Stellar public key — this keeps
 * arbitrary strings (and values longer than the VARCHAR(255) column) out of the table.
 */
export function normalizeCommentAuthor(...candidates: unknown[]): string {
  const provided = candidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0
  );
  if (provided === undefined) return ANONYMOUS_AUTHOR;

  const address = String(provided).trim();
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new CommentValidationError('userAddress must be a valid Stellar public key');
  }
  return address;
}

/** Parse a numeric primary key coming from a query string or JSON body. */
export function parseTokenId(value: unknown): number {
  const tokenId = Number(value);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    throw new CommentValidationError('tokenId must be a positive integer');
  }
  return tokenId;
}
