// [Layer: Endpoints]
// Responsibility: Base HTTP fetch client configuring credentials, headers, and error parsing.
// DO NOT hardcode external API URLs; rely on relative /api proxies or dynamic environment configuration.

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const getApiBaseUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, '');
  }
  return '';
};

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Tab-isolated session storage (100% Highest Priority)
    const sessionToken = sessionStorage.getItem('resqtrack_token');
    if (sessionToken && sessionToken.trim() !== '') {
      return sessionToken;
    }

    // 2. Active tab unit-specific token (RHU Medic, BFP Fire, PNP Police)
    const tabUnit = (sessionStorage.getItem('resqtrack_unit') || '').toLowerCase().trim();
    if (tabUnit && tabUnit !== 'none') {
      const unitToken = localStorage.getItem(`resqtrack_token_${tabUnit}`);
      if (unitToken && unitToken.trim() !== '') {
        return unitToken;
      }
    }

    // 3. Port-scoped local storage
    const port = window.location.port;
    if (port === '1996') {
      const adminToken = localStorage.getItem(`resqtrack_token_${port}`) || localStorage.getItem('resqtrack_token_1996');
      if (adminToken && adminToken.trim() !== '') {
        return adminToken;
      }
    }

    // 4. General fallback local storage
    if (port) {
      const portToken = localStorage.getItem(`resqtrack_token_${port}`);
      if (portToken && portToken.trim() !== '') {
        return portToken;
      }
    }

    const localToken = localStorage.getItem('resqtrack_token');
    if (localToken && localToken.trim() !== '') {
      return localToken;
    }
  } catch {
    // Storage access safeguard
  }
  return null;
};

export const clearStalePortTokens = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const port = window.location.port || '1998';
    const tabUnit = (sessionStorage.getItem('resqtrack_unit') || '').toLowerCase().trim();
    sessionStorage.removeItem('resqtrack_token');
    sessionStorage.removeItem('resqtrack_session');
    sessionStorage.removeItem('resqtrack_user');
    if (tabUnit && tabUnit !== 'none') {
      localStorage.removeItem(`resqtrack_token_${tabUnit}`);
      localStorage.removeItem(`resqtrack_session_${tabUnit}`);
      localStorage.removeItem(`resqtrack_user_${tabUnit}`);
    }
    localStorage.removeItem(`resqtrack_token_${port}`);
    localStorage.removeItem(`resqtrack_session_${port}`);
    localStorage.removeItem(`resqtrack_user_${port}`);
    localStorage.removeItem('resqtrack_token');
  } catch {
    // Storage cleanup safeguard
  }
};

export const requestJson = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const executeFetch = async (overrideToken?: string | null): Promise<Response> => {
    const token = overrideToken !== undefined ? overrideToken : getAuthToken();
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token
        ? {
            'Authorization': `Bearer ${token}`,
            'X-Session-Token': token
          }
        : {})
    };
    const baseUrl = getApiBaseUrl();
    const resolvedUrl = url.startsWith('/') && baseUrl ? `${baseUrl}${url}` : url;
    return fetch(resolvedUrl, {
      ...options,
      credentials: 'include',
      headers: { ...defaultHeaders, ...options.headers }
    });
  };

  let response: Response;
  try {
    response = await executeFetch();
    const isAuthAttempt =
      url.includes('/login') || url.includes('/biometric-login') || url.includes('/register') || url.includes('/logout');
    if (response.status === 401 && !isAuthAttempt) {
      clearStalePortTokens();
    }
  } catch (err: unknown) {
    const rawError = err instanceof Error ? err.message : String(err);
    throw new ApiError(
      'Backend API is unreachable. Ensure .NET backend is running on port 1999 (run ".\\start.ps1 start" or ".\\start.ps1 -Dev").',
      0,
      { raw: rawError }
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const payload = data as { message?: string; error?: string; detail?: string } | null;
    let errorMsg = payload?.message || payload?.error || payload?.detail;
    if (!errorMsg) {
      if (response.status === 502 || response.status === 503) {
        errorMsg = 'Backend API is unreachable on port 1999. Please launch the backend with ".\\start.ps1 start".';
      } else {
        errorMsg = `HTTP error ${response.status}`;
      }
    } else if (
      import.meta.env?.DEV &&
      payload?.error &&
      payload?.message &&
      payload.error !== payload.message &&
      !payload.message.includes(payload.error)
    ) {
      errorMsg = `${payload.message} (${payload.error})`;
    }
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
};
