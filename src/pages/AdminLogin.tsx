import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [require2FA, setRequire2FA] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, token: require2FA ? token : undefined }),
    });
    
    const data = await res.json();
    
    if (res.ok && data.success) {
      navigate("/admin");
    } else if (data.require2FA) {
      setRequire2FA(true);
      setError("");
    } else {
      setError(data.error || "Connexion echouee");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-8">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-center text-zinc-900 dark:text-white mb-8">
          Connexion admin
        </h2>
        <form onSubmit={handleLogin} className="space-y-6">
          {!require2FA ? (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 dark:text-white"
                required
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Code 2FA
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-center tracking-widest font-mono text-lg text-zinc-900 dark:text-white"
                required
                autoFocus
                maxLength={6}
                placeholder="000000"
              />
              <div className="mt-2 text-center">
                <button 
                  type="button"
                  onClick={() => { setRequire2FA(false); setToken(""); }}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Retour au mot de passe
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
          >
            {require2FA ? "Verifier le code" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
