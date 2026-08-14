import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { getUserRoles } from "@/lib/userRoles";

const ADMIN_EMAIL = "provenmarketplace@gmail.com";

function PasswordInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-body text-[13px] font-medium" style={{ color: "#374151" }}>
        Password
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

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"login" | "forgot" | "sent">("login");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Step 1: Sign in
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Step 2: Read role using the session we just got
    const userId = data.session!.user.id;
    const { roles, error: roleError } = await getUserRoles(userId);

    console.log("userId:", userId);
    console.log("roles:", roles);
    console.log("roleError:", roleError);

    if (!roles.includes("admin")) {
      await supabase.auth.signOut();
      setError("This area is for admins only.");
      setLoading(false);
      return;
    }

    // Step 3: All good
    navigate("/admin");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (!resetError) {
      setView("sent");
    } else if (resetError.message?.toLowerCase().includes("rate limit")) {
      setError("Too many attempts. Please wait a minute before trying again.");
    } else {
      setError("Could not send reset email. Please check the address.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "#0D1B2A" }}>
      <div className="w-full max-w-[400px] rounded-xl bg-white p-10 shadow-xl">
        {/* Branding */}
        <p className="text-center font-heading text-[40px] font-bold" style={{ color: "#C9A84C" }}>HF</p>
        <p className="text-center font-body text-[12px] tracking-[0.15em]" style={{ color: "#94A3B8" }}>
          Heng Fatt Property
        </p>
        <p className="text-center font-body text-[11px] uppercase tracking-[0.1em]" style={{ color: "#C9A84C" }}>
          Admin Panel
        </p>

        {/* Divider */}
        <div className="my-6 flex justify-center">
          <div className="w-10 border-t" style={{ borderColor: "#C9A84C" }} />
        </div>

        {view === "login" && (
          <>
            <h1 className="text-center font-heading text-[24px] font-bold" style={{ color: "#1F2937" }}>
              Sign In
            </h1>

            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              {error && (
                <div
                  className="rounded-md px-4 py-3 font-body text-[13px]"
                  style={{ borderLeft: "3px solid #DC2626", backgroundColor: "#FEF2F2", color: "#DC2626" }}
                >
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="block font-body text-[13px] font-medium" style={{ color: "#374151" }}>
                  Email address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ADMIN_EMAIL}
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
                <p className="font-body text-[12px]" style={{ color: "#64748B" }}>
                  Admin account: {ADMIN_EMAIL}
                </p>
              </div>

              <PasswordInput id="admin-password" value={password} onChange={setPassword} />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setError(""); setView("forgot"); }}
                  className="font-body text-[13px] transition-colors hover:underline"
                  style={{ color: "#64748B" }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-lg font-body text-[15px] font-semibold text-white transition-[background] duration-150"
                style={{ height: 44, backgroundColor: loading ? "#B8973B" : "#C9A84C" }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#B8973B"; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#C9A84C"; }}
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Sign In"}
              </button>
            </form>
          </>
        )}

        {view === "forgot" && (
          <>
            <button
              type="button"
              onClick={() => { setError(""); setView("login"); }}
              className="mb-4 flex items-center gap-1 font-body text-[13px] transition-colors hover:underline"
              style={{ color: "#64748B" }}
            >
              <ArrowLeft size={14} /> Back to login
            </button>
            <h1 className="font-heading text-[24px] font-bold" style={{ color: "#1F2937" }}>
              Reset Password
            </h1>
            <p className="mt-2 font-body text-[14px]" style={{ color: "#64748B" }}>
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleForgotPassword} className="mt-6 space-y-5">
              {error && (
                <div
                  className="rounded-md px-4 py-3 font-body text-[13px]"
                  style={{ borderLeft: "3px solid #DC2626", backgroundColor: "#FEF2F2", color: "#DC2626" }}
                >
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="reset-email" className="block font-body text-[13px] font-medium" style={{ color: "#374151" }}>
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ADMIN_EMAIL}
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
                <p className="font-body text-[12px]" style={{ color: "#64748B" }}>
                  Make sure this matches the registered admin mailbox exactly.
                </p>
              </div>

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

        {view === "sent" && (
          <div className="flex flex-col items-center py-4">
            <CheckCircle size={40} style={{ color: "#16A34A" }} />
            <p className="mt-4 font-body text-[15px] font-medium" style={{ color: "#16A34A" }}>
              If the email is registered, the reset link has been sent. Check your inbox and spam folder.
            </p>
            <p className="mt-1 font-body text-[13px]" style={{ color: "#64748B" }}>
              The link expires in 1 hour.
            </p>
            <button
              type="button"
              onClick={() => { setError(""); setView("login"); }}
              className="mt-6 font-body text-[13px] transition-colors hover:underline"
              style={{ color: "#C9A84C" }}
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
