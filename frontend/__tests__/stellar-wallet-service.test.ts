const mockKit = {
  init: jest.fn(),
  on: jest.fn(),
  setWallet: jest.fn(),
  authModal: jest.fn(),
  getNetwork: jest.fn(),
  disconnect: jest.fn(),
  getAddress: jest.fn(),
  selectedModule: { productId: 'freighter-id' },
};

jest.mock('@creit.tech/stellar-wallets-kit', () => ({
  KitEventType: { WALLET_SELECTED: 'WALLET_SELECTED' },
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
}));

jest.mock('@creit.tech/stellar-wallets-kit/sdk', () => ({
  StellarWalletsKit: mockKit,
}));

jest.mock('@creit.tech/stellar-wallets-kit/modules/freighter', () => ({
  FREIGHTER_ID: 'freighter-id',
  FreighterModule: class FreighterModule {},
}));

jest.mock('@creit.tech/stellar-wallets-kit/modules/rabet', () => ({
  RABET_ID: 'rabet-id',
  RabetModule: class RabetModule {},
}));

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  length = 0;

  clear(): void {
    this.data.clear();
    this.length = 0;
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
    this.length = this.data.size;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
    this.length = this.data.size;
  }
}

describe('stellarWalletService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (global as any).window = { localStorage: new MemoryStorage() };
    mockKit.selectedModule = { productId: 'freighter-id' };
    mockKit.getNetwork.mockResolvedValue({
      network: 'testnet',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
  });

  test('connect returns provider and address', async () => {
    mockKit.authModal.mockResolvedValue({
      address: 'GDH6Y7NQDW4JQ3SRTJKW45MMQ3WQ3VFS46SM3V24BW5Z2X5RBQHB5QCU',
    });

    const { stellarWalletService } = await import('../lib/stellarWalletService');
    const result = await stellarWalletService.connect();

    expect(result.provider).toBe('freighter');
    expect(result.address.startsWith('GD')).toBe(true);
    expect(mockKit.authModal).toHaveBeenCalledTimes(1);
  });

  test('connect maps rejection error', async () => {
    mockKit.authModal.mockRejectedValue(new Error('User rejected the request'));
    const { stellarWalletService, WalletServiceError } = await import('../lib/stellarWalletService');

    await expect(stellarWalletService.connect()).rejects.toBeInstanceOf(WalletServiceError);
    await expect(stellarWalletService.connect()).rejects.toMatchObject({ code: 'user_rejected' });
  });

  test('restoreSession returns null without persisted session', async () => {
    const { stellarWalletService } = await import('../lib/stellarWalletService');
    const restored = await stellarWalletService.restoreSession();
    expect(restored).toBeNull();
  });

  test('disconnect clears local session', async () => {
    const storage = (global as any).window.localStorage as MemoryStorage;
    storage.setItem('stellar.wallet.session.v1', JSON.stringify({
      walletId: 'freighter-id',
      address: 'GABC',
    }));

    const { stellarWalletService } = await import('../lib/stellarWalletService');
    await stellarWalletService.disconnect();

    expect(storage.getItem('stellar.wallet.session.v1')).toBeNull();
  });
});
