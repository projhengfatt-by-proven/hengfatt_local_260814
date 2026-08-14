import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const isSettingPasswordRef = useRef(false);

  useEffect(() => {

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        navigate("/");
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        setCurrentSession(session);
        setShowSetPassword(true);
        return;
      }

      // Skip routing if user is in the middle of setting their password
      // (updateUser triggers USER_UPDATED which would re-enter this callback)
      if (isSettingPasswordRef.current) return;

      // For all other events (including invite token exchange),
      // check the database to determine if password setup is needed.
      await routeByRole(session);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function routeByRole(session: any) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active, password_set_at")
      .eq("id", session.user.id)
      .single();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      navigate("/");
      return;
    }

    // Get role with retry (DB trigger may still be running)
    let role: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();
      if (roleRow?.role) {
        role = roleRow.role;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // If agent/admin and password_set_at is null → first login, must set password
    if ((role === "agent" || role === "admin") && !profile.password_set_at) {
      setCurrentSession(session);
      setShowSetPassword(true);
      return;
    }

    if (role === "agent" || role === "admin") {
      navigate("/portal/agent");
    } else {
      navigate("/portal/member");
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    isSettingPasswordRef.current = true;

    // Get a fresh session to avoid expired token issues
    const { data: { session: freshSession } } = await supabase.auth.getSession();

    if (!freshSession) {
      setError("Your session has expired. Please click the invite link in your email again.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError("Could not set password: " + updateError.message);
      return;
    }

    // Mark password as set in profiles
    await supabase
      .from("profiles")
      .update({ password_set_at: new Date().toISOString() })
      .eq("id", freshSession.user.id);

    // Inline role lookup and redirect to avoid stale session in routeByRole
    let role: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", freshSession.user.id)
        .single();
      if (roleRow?.role) {
        role = roleRow.role;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setLoading(false);

    if (role === "agent" || role === "admin") {
      navigate("/portal/agent");
    } else {
      navigate("/portal/member");
    }
  }

  // SET PASSWORD SCREEN
  if (showSetPassword) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0D1B2A",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 40,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}
        >
          <p
            style={{
              textAlign: "center",
              fontSize: 36,
              fontWeight: 700,
              color: "#C9A84C",
              margin: 0,
              fontFamily: "serif",
            }}
          >
            HF
          </p>
          <p
            style={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 3,
              color: "#64748B",
              margin: "4px 0 0",
            }}
          >
            HENG FATT PROPERTY
          </p>
          <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "20px 0" }} />
          <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, color: "#0F1C2E", margin: 0 }}>
            Welcome aboard
          </h1>
          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "#64748B",
              margin: "8px 0 0",
              lineHeight: 1.5,
            }}
          >
            Set a password to activate your account. You will use this to log in next time.
          </p>

          {error && (
            <div
              style={{
                marginTop: 20,
                padding: "10px 14px",
                borderLeft: "3px solid #DC2626",
                backgroundColor: "#FEF2F2",
                color: "#DC2626",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSetPassword} style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 14px",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: "border-box" as const,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94A3B8",
                  }}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 14px",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: "border-box" as const,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94A3B8",
                  }}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: 44,
                backgroundColor: loading ? "#B8973B" : "#C9A84C",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : null}
              {loading ? "Activating..." : "Activate Account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // LOADING SCREEN
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0D1B2A",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "4px solid #C9A84C",
          borderTopColor: "transparent",
          borderRadius: "50%",
        }}
        className="animate-spin"
      />
      <p style={{ marginTop: 16, fontSize: 15, color: "#F5F0E8" }}>
        Logging you in…
      </p>
    </div>
  );
}
