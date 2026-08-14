import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BrandedLeftPanel from "@/components/auth/BrandedLeftPanel";

/* ------------------------------------------------------------------ */
/*  Password input with show/hide toggle                              */
/* ------------------------------------------------------------------ */
function PasswordInput({
  id,
  value,
  onChange,
  placeholder = "••••••••",
  label = "Password",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
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
          placeholder={placeholder}
          required
          className="w-full rounded-lg border px-3.5 py-2.5 font-body text-sm outline-none transition-all"
          style={{
            borderColor: "#E2E8F0",
          }}
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

/* ------------------------------------------------------------------ */
/*  Error banner                                                       */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Gold input styling helper                                          */
/* ------------------------------------------------------------------ */
function TextInput({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  label,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-body text-[13px] font-medium" style={{ color: "#374151" }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function AgentLoginPage() {
  const navigate = useNavigate();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // View state
  const [view, setView] = useState<"login" | "forgot" | "resetSent">("login");

  /* ---------- Login handler ---------- */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Step 1: Sign in
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !session) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Step 2: Check is_active
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", session.user.id)
      .single();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setError("Your account has been suspended. Please contact the admin.");
      setLoading(false);
      return;
    }

    // Step 3: Check role
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (roleRow?.role !== "agent" && roleRow?.role !== "admin") {
      await supabase.auth.signOut();
      setError("This portal is for Heng Fatt agents only.");
      setLoading(false);
      return;
    }

    // Step 4: Check agent_profile exists
    const { data: agentProfile } = await supabase
      .from("agent_profiles")
      .select("id")
      .eq("id", session.user.id)
      .single();

    if (!agentProfile) {
      navigate("/portal/agent/setup");
      return;
    }

    // Step 5: Go to portal
    navigate("/portal/agent");
  }

  /* ---------- Forgot password handler ---------- */
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    setLoading(false);
    if (!resetError) {
      setView("resetSent");
    } else {
      setError("Could not send reset email. Please check the address.");
    }
  }

  /* ---------- Render ---------- */
  return (
    <div className="flex min-h-screen">
      <BrandedLeftPanel />

      {/* Right column */}
      <div className="flex flex-1 flex-col items-center justify-between bg-white px-6 py-10 lg:w-[60%]">
        <div />

        <div className="w-full max-w-[380px]">
          {/* ===== LOGIN VIEW ===== */}
          {view === "login" && (
            <>
              <h1 className="font-heading text-[28px] font-bold" style={{ color: "hsl(var(--navy))" }}>
                Agent Portal
              </h1>
              <p className="mt-1 font-body text-sm" style={{ color: "#64748B" }}>
                Sign in to access your Command Center
              </p>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <ErrorBanner message={error} />

                <TextInput id="email" type="email" label="Email address" placeholder="your@email.com" value={email} onChange={setEmail} />
                <PasswordInput id="password" value={password} onChange={setPassword} />

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg font-body text-[15px] font-semibold text-white transition-[background] duration-150"
                  style={{
                    height: 44,
                    backgroundColor: loading ? "#B8973B" : "#C9A84C",
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#B8973B"; }}
                  onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#C9A84C"; }}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "Sign In"}
                </button>

                <div className="flex items-center justify-between font-body text-[13px]" style={{ color: "#64748B" }}>
                  <button type="button" className="hover:underline cursor-pointer" onClick={() => { setError(""); setView("forgot"); }}>
                    Forgot password?
                  </button>
                  <button type="button" className="hover:underline cursor-pointer" onClick={() => navigate("/")}>
                    Not an agent? View listings →
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ===== FORGOT PASSWORD VIEW ===== */}
          {view === "forgot" && (
            <>
              <button
                type="button"
                onClick={() => { setError(""); setView("login"); }}
                className="mb-6 flex items-center gap-1 font-body text-[13px] hover:underline"
                style={{ color: "#64748B" }}
              >
                <ArrowLeft size={16} /> Back to login
              </button>

              <h1 className="font-heading text-[24px] font-bold" style={{ color: "hsl(var(--navy))" }}>
                Reset Password
              </h1>
              <p className="mt-2 font-body text-sm" style={{ color: "#64748B" }}>
                Enter your registered email address and we'll send you a reset link.
              </p>

              <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
                <ErrorBanner message={error} />
                <TextInput id="reset-email" type="email" label="Email address" placeholder="your@email.com" value={email} onChange={setEmail} />

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg font-body text-[15px] font-semibold text-white transition-[background] duration-150"
                  style={{ height: 44, backgroundColor: loading ? "#B8973B" : "#C9A84C" }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#B8973B"; }}
                  onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#C9A84C"; }}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "Send Reset Link"}
                </button>
              </form>
            </>
          )}

          {/* ===== RESET SENT VIEW ===== */}
          {view === "resetSent" && (
            <div className="flex flex-col items-center text-center py-8">
              <CheckCircle size={48} style={{ color: "#16A34A" }} />
              <p className="mt-4 font-body text-[15px] font-semibold" style={{ color: "#16A34A" }}>
                Reset link sent! Check your inbox.
              </p>
              <p className="mt-1 font-body text-[13px]" style={{ color: "#64748B" }}>
                The link expires in 1 hour.
              </p>
              <button
                type="button"
                className="mt-6 font-body text-[13px] hover:underline"
                style={{ color: "#64748B" }}
                onClick={() => { setError(""); setView("login"); }}
              >
                Back to login
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 font-body text-[11px] text-center" style={{ color: "#94A3B8" }}>
          Heng Fatt Property Pte. Ltd. · CEA Licensed
        </p>
      </div>
    </div>
  );
}
