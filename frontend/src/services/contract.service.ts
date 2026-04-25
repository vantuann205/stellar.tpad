export async function simulateContractCall(payload: Record<string, unknown>) {
  const res = await fetch('/api/contract/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}