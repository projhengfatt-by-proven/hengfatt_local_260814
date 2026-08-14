import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BrandedLeftPanel from "@/components/auth/BrandedLeftPanel";

function PasswordInput({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-body text-[13px] font-medium" style={{ color: "#374151" }}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full rounded-lg border px-3.5 py-2.5 font-body text-sm outline-none transition-all"
          style={{ borderColor: "#E2E8F0" }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#C9A84C";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,168,76,0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E2E8F0";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="mb-4 rounded-md px-4 py-3 font-body text-[13px]"
      style={{
        borderLeft: "3px solid #DC2626",
        backgroundColor: "#FEF2F2",
        color: "#DC2626",
      }}
    >
      {message}
    </div>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check URL hash for errors (e.g. expired link)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        setError(errorDesc);
        setLinkError(true);
        return;
      }
    }

    // Check if there is already an active recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
    });

    // Also listen for the PASSWORD_RECOVERY event in case it fires after mount
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          setReady(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(e: React.FormEvent) {
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

    const { data: { session } } = await supabase.auth.getSession();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError("Could not update password. Please request a new reset link.");
      return;
    }

    // Route back to the login page matching the account's role — an agent
    // resetting via /agent-login must not land on the admin login screen.
    let role: string | null = null;
    if (session) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      role = roleRow?.role ?? null;
    }

    setLoading(false);
    toast({ title: "Password updated successfully", description: "Please sign in with your new password." });
    await supabase.auth.signOut();
    navigate(role === "admin" ? "/admin/login" : "/agent-login");
  }

  if (linkError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ backgroundColor: "#0D1B2A" }}>
        <div className="w-full max-w-[400px] rounded-xl bg-white p-8 text-center shadow-lg">
          <h2 className="font-heading text-xl font-bold" style={{ color: "#DC2626" }}>Link Expired</h2>
          <p className="mt-3 font-body text-sm" style={{ color: "#64748B" }}>
            {error || "This password reset link is invalid or has expired."}
          </p>
          <p className="mt-2 font-body text-sm" style={{ color: "#64748B" }}>
            Please request a new reset link from the login page.
          </p>
          <button
            onClick={() => navigate("/agent-login")}
            className="mt-6 rounded-lg px-6 py-2.5 font-body text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "#C9A84C" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#B8973B"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#C9A84C"}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center" style={{ backgroundColor: "#0D1B2A" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#C9A84C" }} />
        <p className="mt-4 font-body text-[15px]" style={{ color: "#F5F0E8" }}>Verifying reset link…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <BrandedLeftPanel />

      <div className="flex flex-1 flex-col items-center justify-between bg-white px-6 py-10 lg:w-[60%]">
        <div />

        <div className="w-full max-w-[380px]">
          <h1 className="font-heading text-[26px] font-bold" style={{ color: "#0D1B2A" }}>
            Set New Password
          </h1>
          <p className="mt-2 font-body text-sm" style={{ color: "#64748B" }}>
            Choose a new password for your account.
          </p>

          <form onSubmit={handleReset} className="mt-8 space-y-5">
            <ErrorBanner message={error} />
            <PasswordInput id="new-password" label="New Password" value={password} onChange={setPassword} />
            <PasswordInput id="confirm-password" label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} />

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg font-body text-[15px] font-semibold text-white transition-[background] duration-150"
              style={{ height: 44, backgroundColor: loading ? "#B8973B" : "#C9A84C" }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#B8973B"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#C9A84C"; }}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Update Password"}
            </button>
          </form>
        </div>

        <p className="mt-8 font-body text-[11px] text-center" style={{ color: "#94A3B8" }}>
          Heng Fatt Property Pte. Ltd. · CEA Licensed
        </p>
      </div>
    </div>
  );
}
