"use client";

const KEY = "poker_token";
const USER_KEY = "poker_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getUserData(): any | null {
  if (typeof window === "undefined") return null;
  const data = window.localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setUserData(user: any) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/**
 * Logout: blacklist token on server and clear local storage.
 */
export async function logout(): Promise<void> {
  try {
    const token = getToken();
    if (token) {
      // Call backend to blacklist the token
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch {
    // Ignore errors (e.g., network down) — just clear local token anyway
  } finally {
    clearToken();
  }
}
