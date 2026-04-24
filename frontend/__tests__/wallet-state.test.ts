import { initialWalletState, walletStateReducer } from '../lib/walletState';

describe('walletStateReducer', () => {
  test('transitions idle -> connecting -> connected', () => {
    const connecting = walletStateReducer(initialWalletState, { type: 'connecting' });
    expect(connecting.status).toBe('connecting');
    expect(connecting.errorCode).toBeNull();

    const connected = walletStateReducer(connecting, {
      type: 'connected',
      payload: {
        provider: 'freighter',
        address: 'GDH6Y7NQDW4JQ3SRTJKW45MMQ3WQ3VFS46SM3V24BW5Z2X5RBQHB5QCU',
      },
    });

    expect(connected.status).toBe('connected');
    expect(connected.provider).toBe('freighter');
    expect(connected.shortAddress).toContain('...');
  });

  test('transitions to error and clears with disconnected', () => {
    const errored = walletStateReducer(initialWalletState, {
      type: 'error',
      payload: { errorCode: 'user_rejected' },
    });

    expect(errored.status).toBe('error');
    expect(errored.errorCode).toBe('user_rejected');

    const disconnected = walletStateReducer(errored, { type: 'disconnected' });
    expect(disconnected).toEqual(initialWalletState);
  });
});
