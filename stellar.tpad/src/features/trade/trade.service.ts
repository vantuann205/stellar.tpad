export async function submitTrade(payload: Record<string, unknown>) {
  const res = await fetch('/api/tx/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}