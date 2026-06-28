// Secure client-side fetch wrapper that injects Authorization headers and handles 401 responses
export const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const storedUser = localStorage.getItem('twin_user');
  let token: string | null = null;

  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      if (user && user.token) {
        token = user.token;
      }
    } catch (e) {
      console.error("Error parsing stored user for fetch interceptor", e);
    }
  }

  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  // Only inject headers for relative app /api/ requests
  if (url.startsWith('/api/') || url.includes('/api/')) {
    init = init || {};
    const headers = new Headers(init.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    init.headers = headers;
  }

  try {
    const response = await window.fetch(input, init);
    if (response.status === 401) {
      console.warn("Session expired or unauthorized. Logging out...");
      // Trigger a custom event so the App component can catch it and logout
      window.dispatchEvent(new CustomEvent('auth-error'));
    }
    return response;
  } catch (err) {
    throw err;
  }
};
