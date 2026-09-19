// Empty by default: requests go to the same origin that served the page
// (proxied to the dev backend in development, same server in production).
// Set VITE_API_URL only when the API is deployed at a different origin.
export const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),

  listUsers: (token, q = '') => request(`/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token }),
  updateProfile: (token, payload) => request('/users/me', { method: 'PATCH', body: payload, token }),

  listConversations: (token) => request('/conversations', { token }),
  getConversation: (token, id) => request(`/conversations/${id}`, { token }),
  openDirectConversation: (token, userId) => request('/conversations/direct', { method: 'POST', body: { userId }, token }),
  createGroup: (token, payload) => request('/conversations/group', { method: 'POST', body: payload, token }),
  markConversationRead: (token, id) => request(`/conversations/${id}/read`, { method: 'PATCH', token }),

  listMessages: (token, conversationId, before) =>
    request(`/messages/${conversationId}${before ? `?before=${before}` : ''}`, { token }),
};
