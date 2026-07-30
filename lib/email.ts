export async function sendEmail(type: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/email/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json() as Promise<{ success?: boolean; error?: string }>
}
