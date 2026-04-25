import { KitEventType, Networks } from '@creit.tech/stellar-wallets-kit';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { FREIGHTER_ID, FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { RABET_ID, RabetModule } from '@creit.tech/stellar-wallets-kit/modules/rabet';
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

const providerToWalletId: Record<StellarWalletProvider, string> = {
  freighter: FREIGHTER_ID,
  rabet: RABET_ID,
};

const walletIdToProvider = (walletId?: string): StellarWalletProvider | null => {
  if (!walletId) return null;
  if (walletId === FREIGHTER_ID) return 'freighter';
  if (walletId === RABET_ID) return 'rabet';
  return null;
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

const ensureTestnet = async (): Promise<void> => {
  const network = await StellarWalletsKit.getNetwork();

  if (network.networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
    throw new WalletServiceError(
      'wrong_network',
      `Expected ${STELLAR_NETWORK_PASSPHRASE}, got ${network.networkPassphrase}`,
    );
  }
};

let initialized = false;

const initKit = (): void => {
  if (initialized || typeof window === 'undefined') return;

  const session = readSession();

  StellarWalletsKit.init({
    modules: [new FreighterModule(), new RabetModule()],
    selectedWalletId: session?.walletId,
    network: STELLAR_NETWORK_PASSPHRASE as Networks,
  });

  StellarWalletsKit.on(KitEventType.WALLET_SELECTED, (event) => {
    const walletId = event.payload.id;
    const existing = readSession();
    if (!walletId || !existing?.address) return;
    writeSession({ walletId, address: existing.address });
  });

  initialized = true;
};

export const getWalletErrorMessage = (code: WalletErrorCode): string => {
  switch (code) {
    case 'extension_not_installed':
      return 'Freighter hoặc Rabet chưa được cài đặt.';
    case 'user_rejected':
      return 'Bạn đã từ chối yêu cầu kết nối ví.';
    case 'wrong_network':
      return 'Vui lòng chuyển ví sang Stellar Testnet.';
    default:
      return 'Không thể kết nối ví, vui lòng thử lại.';
  }
};

export const stellarWalletService = {
  async connect(preferredProvider?: StellarWalletProvider): Promise<{ provider: StellarWalletProvider; address: string }> {
    try {
      initKit();

      if (preferredProvider) {
        StellarWalletsKit.setWallet(providerToWalletId[preferredProvider]);
      }

      const { address } = await StellarWalletsKit.authModal();
      const selectedWalletId = StellarWalletsKit.selectedModule?.productId;
      const provider = walletIdToProvider(selectedWalletId);

      if (!provider) {
        throw new WalletServiceError('unknown', 'Unsupported wallet selected');
      }

      await ensureTestnet();
      writeSession({ walletId: selectedWalletId, address });

      return {
        provider,
        address,
      };
    } catch (error) {
      if (error instanceof WalletServiceError) {
        throw error;
      }

      throw new WalletServiceError(mapErrorCode(error), error instanceof Error ? error.message : 'Wallet connection failed');
    }
  },

  async disconnect(): Promise<void> {
    initKit();
    try {
      await StellarWalletsKit.disconnect();
    } catch {
      // Keep disconnect resilient even when wallet module has no active session.
    }
    clearSession();
  },

  async restoreSession(): Promise<{ provider: StellarWalletProvider; address: string } | null> {
    try {
      initKit();
      const session = readSession();
      if (!session) return null;

      StellarWalletsKit.setWallet(session.walletId);
      const provider = walletIdToProvider(session.walletId);
      if (!provider) return null;

      const { address } = await StellarWalletsKit.getAddress();
      if (!address) return null;

      await ensureTestnet();
      writeSession({ walletId: session.walletId, address });

      return { provider, address };
    } catch {
      clearSession();
      return null;
    }
  },

  async getPublicKey(): Promise<string | null> {
    try {
      initKit();
      const { address } = await StellarWalletsKit.getAddress();
      return address || null;
    } catch {
      return null;
    }
  },

  getProviderName(provider: StellarWalletProvider): string {
    return provider === 'freighter' ? 'Freighter' : 'Rabet';
  },
};
