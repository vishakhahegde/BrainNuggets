async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const askTutor = (question, chunk, context) => post('/api/ask', { question, chunk, context });

export const breakdownAssignment = (fields) => post('/api/breakdown', fields);

// Uploads a PDF and calls onEvent for each NDJSON event the server streams back.
export async function processPdf(file, onEvent) {
  const form = new FormData();
  form.append('pdf', file);
  const res = await fetch('/api/process', { method: 'POST', body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Upload failed');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) if (line.trim()) await onEvent(JSON.parse(line));
  }
}
