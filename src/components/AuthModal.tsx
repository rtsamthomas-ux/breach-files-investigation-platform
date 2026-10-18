import { useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase-client";
import { Shield, Key, Mail, User, AlertCircle, CheckCircle2, LogOut, KeyRound } from "lucide-react";

export type AuthMode = "signin" | "signup" | "forgot";

interface AuthModalProps {
  user: {
    id: string;
    email?: string | undefined;
    username?: string | undefined;
    role?: string | undefined;
  } | null;
  onAuthChange: () => void;
  onClose: () => void;
  initialMode?: AuthMode;
}

export function AuthModal({ user, onAuthChange, onClose, initialMode = "signin" }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = getSupabaseClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isSupabaseConfigured || !supabase) {
      setError(
        "Supabase credentials are not configured yet. Add VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) to your .env to enable cloud accounts.",
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim() || email.split("@")[0],
            },
          },
        });

        if (signUpError) throw signUpError;
        if (data.session) {
          setSuccess("Account created and signed in successfully.");
          onAuthChange();
          setTimeout(onClose, 1000);
        } else {
          setSuccess("Confirmation email sent. Please check your inbox to verify your account.");
        }
      } else if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          typeof window !== "undefined" ? { redirectTo: window.location.origin } : {},
        );

        if (resetError) throw resetError;
        setSuccess("Password reset email sent. Please check your inbox for instructions.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        setSuccess("Signed in successfully.");
        onAuthChange();
        setTimeout(onClose, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase credentials are not configured yet.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;
      setSuccess("Password updated successfully.");
      setNewPassword("");
      setShowPasswordChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    onAuthChange();
    onClose();
  };

  const getModalTitle = () => {
    if (user) return "INVESTIGATOR CREDENTIALS";
    if (mode === "signup") return "REGISTER PARTICIPANT";
    if (mode === "forgot") return "RESET PASSWORD";
    return "SIGN IN";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-mono text-sm font-bold tracking-widest">{getModalTitle()}</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground font-mono text-xs"
          >
            [ESC / CLOSE]
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-4 border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
            <div className="flex items-center gap-1.5 font-mono font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              DATABASE CREDENTIALS PENDING
            </div>
            <p className="mt-1 leading-relaxed text-[11px] text-muted-foreground">
              Real Supabase keys are not yet configured in <code>.env</code>. The application is
              running in <strong>Offline Investigator Mode</strong> with local score validation.
            </p>
          </div>
        )}

        {user ? (
          <div className="mt-5 space-y-4 font-mono text-xs">
            <div className="border border-border bg-background p-3 space-y-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Active Investigator
              </div>
              <div className="text-foreground font-bold">{user.username || user.email}</div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground">ROLE:</span>
                <span className="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-primary uppercase">
                  {user.role || "participant"}
                </span>
                <span className="text-muted-foreground">ID:</span>
                <span className="text-muted-foreground">{user.id.slice(0, 8)}...</span>
              </div>
            </div>

            {error && (
              <div className="border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {showPasswordChange ? (
              <form
                onSubmit={handleUpdatePassword}
                className="space-y-3 border border-border bg-background p-3"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Update Password
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full border border-border bg-card py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary px-3 py-1.5 font-mono text-xs font-bold uppercase text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? "SAVING..." : "SAVE PASSWORD"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordChange(false);
                      setNewPassword("");
                      setError(null);
                    }}
                    className="border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(true);
                  setError(null);
                  setSuccess(null);
                }}
                className="flex w-full items-center justify-center gap-2 border border-border bg-secondary/30 px-4 py-2 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                <KeyRound className="h-3.5 w-3.5" /> CHANGE PASSWORD
              </button>
            )}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 border border-destructive/40 bg-destructive/10 px-4 py-2.5 font-mono text-xs text-destructive hover:bg-destructive/20"
            >
              <LogOut className="h-4 w-4" /> SIGN OUT
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Investigator Call-sign / Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. agent_keller"
                    className="w-full border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@agency.internal"
                  className="w-full border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setSuccess(null);
                      }}
                      className="font-mono text-[10px] text-muted-foreground hover:text-primary underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {mode === "forgot" && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Enter your registered investigator email to receive a password recovery link.
              </p>
            )}

            {error && (
              <div className="border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 bg-primary px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading
                ? "AUTHENTICATING..."
                : mode === "signup"
                  ? "CREATE ACCOUNT"
                  : mode === "forgot"
                    ? "SEND RESET LINK"
                    : "SIGN IN"}
            </button>

            <div className="text-center space-y-1">
              {mode === "signup" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="font-mono text-[11px] text-muted-foreground hover:text-primary underline"
                >
                  Already have an account? Sign in here
                </button>
              )}
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="font-mono text-[11px] text-muted-foreground hover:text-primary underline"
                >
                  Need a participant profile? Register here
                </button>
              )}
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="font-mono text-[11px] text-muted-foreground hover:text-primary underline"
                >
                  Remembered your password? Back to Sign In
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
