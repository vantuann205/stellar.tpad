export async function fetchTokenList() {
  const res = await fetch('/api/tokens');
  return res.json();
}