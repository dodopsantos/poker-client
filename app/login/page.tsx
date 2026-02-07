"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../src/lib/api";
import { setToken, clearToken } from "../../src/lib/auth";
import { disconnectSocket } from "../../src/lib/socket";

type AuthResponse = { token: string; user: { id: string; username: string } };

async function post<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
  return data as T;
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const data = await post<AuthResponse>(path, { username, password });
      setToken(data.token);
      disconnectSocket(); // garante reconexão com token novo
      setInfo(`Logado como ${data.user.username}.`);
      router.push("/lobby");
    } catch (err: any) {
      setError(err.message ?? "Falha ao autenticar.");
    }
  }

  function logout() {
    clearToken();
    disconnectSocket();
    setInfo("Token removido (logout).");
  }

  return (
    <div className="card">
      <h2>Login (MVP)</h2>
      <p className="small">
        Use <code>/auth/register</code> para criar usuário e receber token. O token fica no <code>localStorage</code>.
      </p>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className={"btn " + (mode === "login" ? "btnPrimary" : "")} onClick={() => setMode("login")}>
          Entrar
        </button>
        <button className={"btn " + (mode === "register" ? "btnPrimary" : "")} onClick={() => setMode("register")}>
          Registrar
        </button>
        <button className="btn" onClick={logout}>Logout</button>
      </div>

      <form onSubmit={onSubmit} className="grid" style={{ maxWidth: 520 }}>
        <input className="input" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="input" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn btnPrimary" type="submit">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      {error && <p style={{ color: "salmon" }}>{error}</p>}
      {info && <p style={{ color: "lightgreen" }}>{info}</p>}

      <div className="hr" />
      <p className="small">
        Backend esperado em <code>{API_URL}</code>. Ajuste em <code>.env.local</code> se precisar.
      </p>
    </div>
  );
}
