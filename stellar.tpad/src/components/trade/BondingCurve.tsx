interface BondingCurveProps {
  soldSupply: bigint;
  totalSupply: bigint;
}

export default function BondingCurve({ soldSupply, totalSupply }: BondingCurveProps) {
  const progress = totalSupply > 0n
    ? Number((soldSupply * 10000n) / totalSupply) / 100
    : 0;

  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div className="bg-pump-card border border-gray-800 rounded-lg p-4 space-y-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span className="font-medium text-gray-300">bonding curve progress</span>
        <span className="font-mono text-pump-green">{pct.toFixed(2)}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-pump-green transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">
        {(Number(soldSupply) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 0 })} /{' '}
        {(Number(totalSupply) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens sold
      </p>
    </div>
  );
}
