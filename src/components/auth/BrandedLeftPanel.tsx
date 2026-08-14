/**
 * Shared left-panel branding used on Agent Login and Reset Password pages.
 * Navy background with subtle gold diagonal-line texture.
 */
export default function BrandedLeftPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-[40%] flex-col items-center justify-between py-12 px-8 relative overflow-hidden"
      style={{
        backgroundColor: "hsl(213 52% 11%)",
        backgroundImage:
          "repeating-linear-gradient(135deg, hsla(42 52% 54% / 0.05) 0px, hsla(42 52% 54% / 0.05) 1px, transparent 1px, transparent 20px)",
      }}
    >
      {/* Spacer */}
      <div />

      {/* Centre content */}
      <div className="flex flex-col items-center text-center">
        <span
          className="font-heading text-[52px] font-bold leading-none"
          style={{ color: "hsl(var(--gold))" }}
        >
          HF
        </span>
        <span
          className="mt-3 font-body text-[13px] tracking-[0.15em] uppercase"
          style={{ color: "hsl(var(--cream))" }}
        >
          Heng Fatt Property
        </span>
        <span
          className="mt-1 font-body text-[11px]"
          style={{ color: "hsla(42 52% 54% / 0.4)" }}
        >
          Est. 1979
        </span>

        {/* Divider */}
        <div
          className="w-10 h-px my-6"
          style={{ backgroundColor: "hsl(var(--gold))" }}
        />

        <div className="space-y-2">
          {["AI-powered Command Center", "Real-time lead management", "ARIA — your personal assistant"].map(
            (line) => (
              <p
                key={line}
                className="font-body text-[13px]"
                style={{ color: "hsla(36 33% 93% / 0.6)" }}
              >
                · {line}
              </p>
            )
          )}
        </div>
      </div>

      {/* Bottom */}
      <p
        className="font-body text-[11px]"
        style={{ color: "hsla(36 33% 93% / 0.3)" }}
      >
        CEA Licensed Estate Agency
      </p>
    </div>
  );
}
