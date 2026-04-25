'use client';

import React from 'react';

interface ConnectButtonProps {
  connected: boolean;
  onConnect: () => void;
  onDisconnect?: () => void;
}

export default function ConnectButton({ connected, onConnect, onDisconnect }: ConnectButtonProps) {
  return connected ? (
    <button onClick={onDisconnect} className="rounded-lg border border-red-400/30 px-3 py-2 text-sm">Disconnect</button>
  ) : (
    <button onClick={onConnect} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-sm">Connect Wallet</button>
  );
}