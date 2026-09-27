export interface User {
  id: number;
  username: string;
}

export interface Stats {
  best: number;
  played: number;
  recent: { score: number; result: string; created_at: string }[];
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null }>('GET', '/api/me'),
  signup: (username: string, password: string) =>
    request<{ user: User }>('POST', '/api/signup', { username, password }),
  login: (username: string, password: string) =>
    request<{ user: User }>('POST', '/api/login', { username, password }),
  logout: () => request<{ ok: true }>('POST', '/api/logout'),
  saveScore: (score: number) => request<{ ok: true }>('POST', '/api/scores', { score }),
  stats: () => request<Stats>('GET', '/api/scores'),
};
