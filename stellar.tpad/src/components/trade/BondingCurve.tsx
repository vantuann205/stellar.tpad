interface BondingCurveProps {
  maxReserve: number;   // XLM collected so far
  bondingTarget: number; // XLM target for graduation (e.g. 10,000)
}

export default function BondingCurve({ maxReserve, bondingTarget }: BondingCurveProps) {
  const pct = Math.min(100, Math.max(0, (maxReserve / bondingTarget) * 100));

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="w-full bg-gray-300 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-2.5 rounded-full bg-pump-green transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
