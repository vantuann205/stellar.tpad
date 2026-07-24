import { STELLAR_NETWORK_PASSPHRASE } from '@/config/network';
import { StellarWalletProvider, WalletErrorCode } from '@/store/wallet.store';

const SESSION_KEY = 'stellar.wallet.session.v1';

type SessionData = {
  walletId: string;
  address: string;
};

export class WalletServiceError extends Error {
  code: WalletErrorCode;

  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const walletIdToProvider = (walletId?: string): StellarWalletProvider | null => {
  return walletId === 'freighter' ? 'freighter' : null;
};

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const readSession = (): SessionData | null => {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as SessionData;
    if (!data.walletId || !data.address) return null;
    return data;
  } catch {
    return null;
  }
};

const writeSession = (data: SessionData): void => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SESSION_KEY, JSON.stringify(data));
};

const clearSession = (): void => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(SESSION_KEY);
};

const mapErrorCode = (error: unknown): WalletErrorCode => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('reject') || message.includes('declined') || message.includes('denied')) {
    return 'user_rejected';
  }

  if (message.includes('install') || message.includes('not available') || message.includes('not found')) {
    return 'extension_not_installed';
  }

  if (message.includes('network')) {
    return 'wrong_network';
  }

  return 'unknown';
};

const apiError = (result: { error?: { message?: string } }): Error | null =>
  result.error ? new Error(result.error.message || 'Freighter request failed') : null;

const ensureConfiguredNetwork = async (): Promise<void> => {
  const { getNetwork } = await import('@stellar/freighter-api');
  const network = await getNetwork();
  const error = apiError(network);
  if (error) throw error;

  const passphrase = network.networkPassphrase || '';
  const expected = String(STELLAR_NETWORK_PASSPHRASE);
  if (passphrase !== expected) {
    throw new WalletServiceError(
      'wrong_network',
      `Please switch Freighter to the configured Stellar network. Got: "${passphrase}"`,
    );
  }
};

export const getWalletErrorMessage = (code: WalletErrorCode): string => {
  switch (code) {
    case 'extension_not_installed':
      return 'Freighter chưa được cài đặt.';
    case 'user_rejected':
      return 'Bạn đã từ chối yêu cầu kết nối ví.';
    case 'wrong_network':
      return 'Vui lòng chuyển ví sang Stellar Mainnet.';
    default:
      return 'Không thể kết nối ví, vui lòng thử lại.';
  }
};

export const stellarWalletService = {
  async connect(preferredProvider?: StellarWalletProvider): Promise<{ provider: StellarWalletProvider; address: string }> {
    try {
      if (preferredProvider && preferredProvider !== 'freighter') {
        throw new WalletServiceError('unknown', 'Only Freighter is supported');
      }

      const { isConnected, requestAccess } = await import('@stellar/freighter-api');
      const connection = await isConnected();
      const connectionError = apiError(connection);
      if (connectionError) throw connectionError;
      if (!connection.isConnected) {
        throw new WalletServiceError('extension_not_installed', 'Freighter is not installed');
      }

      const access = await requestAccess();
      const accessError = apiError(access);
      if (accessError) throw accessError;
      if (!access.address) throw new Error('Freighter did not return an address');
      await ensureConfiguredNetwork();
      writeSession({ walletId: 'freighter', address: access.address });

      return {
        provider: 'freighter',
        address: access.address,
      };
    } catch (error) {
      if (error instanceof WalletServiceError) {
        throw error;
      }

      throw new WalletServiceError(mapErrorCode(error), error instanceof Error ? error.message : 'Wallet connection failed');
    }
  },

  async disconnect(): Promise<void> {
    clearSession();
  },

  async restoreSession(): Promise<{ provider: StellarWalletProvider; address: string } | null> {
    try {
      const session = readSession();
      if (!session) return null;

      const provider = walletIdToProvider(session.walletId);
      if (!provider) return null;

      const { getAddress, isAllowed, isConnected } = await import('@stellar/freighter-api');
      const connection = await isConnected();
      const allowed = await isAllowed();
      if (!connection.isConnected || !allowed.isAllowed || connection.error || allowed.error) return null;

      const result = await getAddress();
      if (result.error || !result.address) return null;
      await ensureConfiguredNetwork();
      writeSession({ walletId: session.walletId, address: result.address });

      return { provider, address: result.address };
    } catch {
      clearSession();
      return null;
    }
  },

  async getPublicKey(): Promise<string | null> {
    try {
      const { getAddress } = await import('@stellar/freighter-api');
      const result = await getAddress();
      return result.error ? null : result.address || null;
    } catch {
      return null;
    }
  },

  async signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string }
  ): Promise<{ signedTxXdr: string }> {
    const { signTransaction } = await import('@stellar/freighter-api');
    const result = await signTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase,
      address: opts?.address,
    });
    const error = apiError(result);
    if (error) throw error;
    if (!result?.signedTxXdr) throw new Error('Signing failed or was rejected');
    return { signedTxXdr: result.signedTxXdr };
  },

  getProviderName(provider: StellarWalletProvider): string {
    return provider === 'freighter' ? 'Freighter' : provider;
  },
};
