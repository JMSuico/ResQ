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

export const requestJson = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('resqtrack_token') : null;
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const baseUrl = getApiBaseUrl();
  const resolvedUrl = url.startsWith('/') && baseUrl ? `${baseUrl}${url}` : url;

  let response: Response;
  try {
    response = await fetch(resolvedUrl, {
      ...options,
      credentials: 'include',
      headers: { ...defaultHeaders, ...options.headers }
    });
  } catch (err: unknown) {
    const rawError = err instanceof Error ? err.message : String(err);
    throw new ApiError(
      'Backend API is unreachable. Ensure .NET backend is running on port 5000 (run ".\\start.ps1 -Dev").',
      0,
      { raw: rawError }
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    let errorMsg = (data as { message?: string; error?: string } | null)?.message
      || (data as { message?: string; error?: string } | null)?.error;
    if (!errorMsg) {
      if (response.status === 502 || response.status === 503) {
        errorMsg = 'Backend API is unreachable on port 5000. Please launch the backend with ".\\start.ps1 -Dev".';
      } else {
        errorMsg = `HTTP error ${response.status}`;
      }
    }
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
};
