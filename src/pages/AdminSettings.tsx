import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Key, Shield, ShieldAlert, ShieldCheck, Save } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { QRCodeSVG } from "qrcode.react";

export default function AdminSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setup2FA, setSetup2FA] = useState<{ secret: string; otpauth: string } | null>(null);
  const [token2FA, setToken2FA] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [twoFactorSuccess, setTwoFactorSuccess] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const data = await res.json();
      setTwoFactorEnabled(data.twoFactorEnabled);
    } else {
      navigate("/admin/login");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    const res = await fetch("/api/admin/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setPasswordSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const data = await res.json();
      setPasswordError(data.error || "Failed to update password");
    }
  };

  const start2FASetup = async () => {
    setTwoFactorError("");
    const res = await fetch("/api/admin/settings/2fa/setup", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setSetup2FA(data);
    } else {
      setTwoFactorError("Failed to initiate 2FA setup");
    }
  };

  const verify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError("");
    
    const res = await fetch("/api/admin/settings/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token2FA }),
    });

    if (res.ok) {
      setTwoFactorEnabled(true);
      setSetup2FA(null);
      setToken2FA("");
      setTwoFactorSuccess("2FA enabled successfully");
      setTimeout(() => setTwoFactorSuccess(""), 3000);
    } else {
      const data = await res.json();
      setTwoFactorError(data.error || "Invalid 2FA code");
    }
  };

  const disable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError("");
    
    const res = await fetch("/api/admin/settings/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePassword }),
    });

    if (res.ok) {
      setTwoFactorEnabled(false);
      setDisablePassword("");
      setTwoFactorSuccess("2FA disabled successfully");
      setTimeout(() => setTwoFactorSuccess(""), 3000);
    } else {
      const data = await res.json();
      setTwoFactorError(data.error || "Invalid password");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 py-8 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-3xl mx-auto mt-8">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <h2 className="text-2xl font-semibold mb-8">Settings</h2>

        <div className="space-y-8">
          {/* Change Password Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Key className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-medium">Change Password</h3>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
              {passwordError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-900/50">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                  {passwordSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                Update Password
              </button>
            </form>
          </div>

          {/* Two-Factor Authentication Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2 rounded-lg ${twoFactorEnabled ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>
                {twoFactorEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-lg font-medium">Two-Factor Authentication (2FA)</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {twoFactorEnabled ? "2FA is currently enabled" : "Add an extra layer of security to your account"}
                </p>
              </div>
            </div>

            {twoFactorError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-900/50">
                {twoFactorError}
              </div>
            )}
            {twoFactorSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                {twoFactorSuccess}
              </div>
            )}

            {!twoFactorEnabled && !setup2FA && (
              <button
                onClick={start2FASetup}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-xl text-sm font-medium transition-colors"
              >
                <Shield className="w-4 h-4" />
                Enable 2FA
              </button>
            )}

            {setup2FA && (
              <div className="space-y-6 max-w-md">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <p className="text-sm mb-4">1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                  <div className="bg-white p-4 rounded-xl inline-block mb-4">
                    <QRCodeSVG value={setup2FA.otpauth} size={150} />
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Or enter this code manually: <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">{setup2FA.secret}</code>
                  </p>
                </div>

                <form onSubmit={verify2FA} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      2. Enter the 6-digit code from your app
                    </label>
                    <input
                      type="text"
                      value={token2FA}
                      onChange={(e) => setToken2FA(e.target.value)}
                      placeholder="000000"
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 tracking-widest font-mono"
                      required
                      maxLength={6}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Verify & Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetup2FA(null)}
                      className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-xl text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {twoFactorEnabled && (
              <form onSubmit={disable2FA} className="space-y-4 max-w-md">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  To disable 2FA, please enter your current password.
                </p>
                <div>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Current Password"
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl text-sm font-medium transition-colors"
                >
                  Disable 2FA
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
