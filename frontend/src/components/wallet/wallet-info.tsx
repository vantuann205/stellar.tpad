'use client';

import React from 'react';

export default function WalletInfo({ address }: { address?: string }) {
  if (!address) return <p className="text-sm text-white/60">Wallet chưa kết nối</p>;
  return <p className="text-sm text-white/80">{address.slice(0, 6)}...{address.slice(-4)}</p>;
}