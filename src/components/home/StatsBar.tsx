import { CountUp } from "@/components/ui/count-up";

const stats = [
  { value: 45, suffix: "+", label: "Years" },
  { value: 13, suffix: "", label: "Specialists" },
  { value: 1000, suffix: "+", label: "Transactions" },
  { value: 1, suffix: "", label: "CEA Licensed", displayValue: "CEA" },
];

export function StatsBar() {
  return (
    <section className="gradient-gold py-8">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="font-heading text-3xl md:text-4xl font-bold text-primary">
                {stat.displayValue ? (
                  stat.displayValue
                ) : (
                  <CountUp end={stat.value} suffix={stat.suffix} />
                )}
              </div>
              <p className="font-body text-sm text-primary/70 mt-1 font-medium uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
