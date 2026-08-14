import { useState, useEffect } from "react";
import { useCommand } from "../CommandContext";

export function CommissionScene() {
  const { state } = useCommand();
  const [price, setPrice] = useState(state.sceneParams?.price || 2000000);
  const [rate, setRate] = useState((state.sceneParams?.rate || 0.01) * 100);
  const [coBroke, setCoBroke] = useState(false);
  const [myShare, setMyShare] = useState(60);
  const [gst, setGst] = useState(true);
  const [txType, setTxType] = useState<"sale" | "rental">("sale");

  const gross = price * (rate / 100);
  const agentShare = coBroke ? gross * (myShare / 100) : gross;
  const cobrokeShare = coBroke ? gross - agentShare : 0;
  const withGst = gst ? agentShare * 1.09 : agentShare;
  const agencyDeduction = 0.3;
  const takeHome = agentShare * (1 - agencyDeduction);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="font-heading text-2xl text-navy font-bold mb-6">Commission Calculator</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          {/* Transaction type */}
          <div className="flex gap-2">
            {(["sale", "rental"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTxType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-body capitalize transition-colors ${
                  txType === t ? "bg-navy text-cream" : "bg-muted text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Price */}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-body block mb-1">
              {txType === "sale" ? "Property Price" : "Monthly Rent"}
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm font-body bg-surface focus:outline-none focus:ring-1 focus:ring-gold/30"
            />
          </div>

          {/* Rate */}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-body block mb-1">
              Commission Rate (%)
            </label>
            <div className="flex gap-2 mb-2">
              {[0.5, 1, 2].map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-body transition-colors ${
                    rate === r ? "bg-gold text-navy" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm font-body bg-surface focus:outline-none focus:ring-1 focus:ring-gold/30"
            />
          </div>

          {/* Co-broke */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={coBroke}
              onChange={(e) => setCoBroke(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-body text-foreground">Co-broke split</span>
          </label>
          {coBroke && (
            <div>
              <label className="text-xs text-muted-foreground font-body block mb-1">
                My Share: {myShare}%
              </label>
              <input
                type="range"
                min={10}
                max={90}
                value={myShare}
                onChange={(e) => setMyShare(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          {/* GST */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={gst}
              onChange={(e) => setGst(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-body text-foreground">Add 9% GST</span>
          </label>
        </div>

        {/* Output */}
        <div className="bg-navy rounded-xl p-6 text-cream space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-cream/50 font-body">Gross Commission</p>
            <p className="font-heading text-3xl font-bold text-gold">${gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>

          {coBroke && (
            <div className="border-t border-cream/10 pt-3">
              <p className="text-xs text-cream/50 font-body">After co-broke ({myShare}% / {100 - myShare}%):</p>
              <p className="text-sm text-cream font-body">Your share: ${agentShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-sm text-cream/60 font-body">Co-broke: ${cobrokeShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          )}

          {gst && (
            <div className="border-t border-cream/10 pt-3">
              <p className="text-xs text-cream/50 font-body">After GST (9%):</p>
              <p className="text-sm text-cream font-body">Client pays: ${withGst.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          )}

          <div className="border-t border-cream/10 pt-3">
            <p className="text-xs text-cream/50 font-body">Agency deduction (est. 30%):</p>
            <p className="font-heading text-2xl font-bold text-gold">
              Take-home: ${takeHome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-cream/30 font-body mt-2">
              Agency deduction % is an estimate. Confirm with management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
