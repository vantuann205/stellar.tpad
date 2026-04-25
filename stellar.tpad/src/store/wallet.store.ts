export type StellarWalletProvider = 'freighter' | 'rabet';
export type WalletStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type WalletErrorCode = 'extension_not_installed' | 'user_rejected' | 'wrong_network' | 'unknown';

export interface WalletState {
  provider: StellarWalletProvider | null;
  address: string;
  shortAddress: string;
  status: WalletStatus;
  errorCode: WalletErrorCode | null;
}

export type WalletAction =
  | { type: 'connecting' }
  | {
      type: 'connected';
      payload: {
        provider: StellarWalletProvider;
        address: string;
      };
    }
  | { type: 'error'; payload: { errorCode: WalletErrorCode } }
  | { type: 'disconnected' };

export const shortenAddress = (address: string): string => {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const initialWalletState: WalletState = {
  provider: null,
  address: '',
  shortAddress: '',
  status: 'idle',
  errorCode: null,
};

export const walletStateReducer = (state: WalletState, action: WalletAction): WalletState => {
  switch (action.type) {
    case 'connecting':
      return {
        ...state,
        status: 'connecting',
        errorCode: null,
      };
    case 'connected':
      return {
        provider: action.payload.provider,
        address: action.payload.address,
        shortAddress: shortenAddress(action.payload.address),
        status: 'connected',
        errorCode: null,
      };
    case 'error':
      return {
        ...state,
        status: 'error',
        errorCode: action.payload.errorCode,
      };
    case 'disconnected':
      return {
        ...initialWalletState,
      };
    default:
      return state;
  }
};
