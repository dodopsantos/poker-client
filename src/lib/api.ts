"use client";

import { getToken, clearToken } from "./auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  
  // Handle token revocation: clear local token and force re-login
  if (res.status === 401 && data?.error === "TOKEN_REVOKED") {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login?reason=token_revoked";
    }
    throw new Error("TOKEN_REVOKED");
  }
  
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
