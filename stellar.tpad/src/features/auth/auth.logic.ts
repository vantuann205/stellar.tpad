import type { AuthUser } from './auth.types';

export const isAuthenticated = (user: AuthUser | null): boolean => Boolean(user?.id);