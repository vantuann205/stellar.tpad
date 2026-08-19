import { StrKey } from '@stellar/stellar-sdk';

/** Column limits from the tokens table — enforced before Postgres rejects the row. */
export const TOKEN_LIMITS = {
  name: 255,
  symbol: 50,
  description: 2000,
  socialLink: 255,
  maxSupply: 1e15,
} as const;

export class TokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

export interface TokenInput {
  name: string;
  symbol: string;
  description: string | null;
  imageUrl: string | null;
  socialLink: string | null;
  totalSupply: number;
  owner: string;
  contractAddress: string;
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0) throw new TokenValidationError(`${field} is required`);
  if (text.length > maxLength) {
    throw new TokenValidationError(`${field} must be at most ${maxLength} characters`);
  }
  return text;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (text.length === 0) return null;
  if (text.length > maxLength) {
    throw new TokenValidationError(`${field} must be at most ${maxLength} characters`);
  }
  return text;
}

/**
 * Only http(s) links are stored — `javascript:` and `data:` URLs are rejected.
 * A scheme-less value such as `x.com/token` is treated as https so the form
 * stays forgiving.
 */
function optionalUrl(value: unknown, field: string, maxLength: number): string | null {
  const text = optionalText(value, field, maxLength);
  if (text === null) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new TokenValidationError(`${field} must be a valid URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TokenValidationError(`${field} must be an http or https URL`);
  }
  if (candidate.length > maxLength) {
    throw new TokenValidationError(`${field} must be at most ${maxLength} characters`);
  }
  return candidate;
}

/** Validate the body of POST /api/tokens before it reaches the database. */
export function validateTokenInput(body: Record<string, unknown>): TokenInput {
  const owner = String(body.owner ?? '').trim();
  if (!StrKey.isValidEd25519PublicKey(owner)) {
    throw new TokenValidationError('owner must be a valid Stellar public key');
  }

  const contractAddress = String(body.contractAddress ?? '').trim();
  if (!StrKey.isValidContract(contractAddress)) {
    throw new TokenValidationError('contractAddress must be a valid Stellar contract id');
  }

  const totalSupply = Number(body.totalSupply);
  if (!Number.isFinite(totalSupply) || totalSupply <= 0 || totalSupply > TOKEN_LIMITS.maxSupply) {
    throw new TokenValidationError('totalSupply must be a positive number');
  }

  return {
    name: requiredText(body.name, 'name', TOKEN_LIMITS.name),
    symbol: requiredText(body.symbol, 'symbol', TOKEN_LIMITS.symbol),
    description: optionalText(body.description, 'description', TOKEN_LIMITS.description),
    imageUrl: optionalUrl(body.image_url, 'image_url', TOKEN_LIMITS.socialLink),
    socialLink: optionalUrl(body.social_link, 'social_link', TOKEN_LIMITS.socialLink),
    totalSupply,
    owner,
    contractAddress,
  };
}
