import { getAuthBaseUrls } from '../config/apiConfig';

export interface LoginPayload {
  phoneNumber: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user?: {
    id: number | string;
    phoneNumber: string;
    createdAt?: string;
  };
}

export const loginWithPhoneAndPassword = async (
  payload: LoginPayload
): Promise<AuthResponse> => {
  const urls = getAuthBaseUrls();
  let lastError: Error | null = null;

  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      return data;
    } catch (err: any) {
      lastError = err;
      if (err.message && err.message !== 'Failed to fetch' && !err.message.includes('Network request failed')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Unable to connect to authentication server. Please check backend API status.');
};

export const registerWithPhoneAndPassword = async (
  payload: LoginPayload
): Promise<AuthResponse> => {
  const urls = getAuthBaseUrls();
  let lastError: Error | null = null;

  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      return data;
    } catch (err: any) {
      lastError = err;
      if (err.message && err.message !== 'Failed to fetch' && !err.message.includes('Network request failed')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Unable to connect to authentication server. Please check backend API status.');
};
