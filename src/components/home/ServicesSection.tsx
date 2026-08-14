import { Link } from "react-router-dom";
import { Home, TrendingUp, Key, Building2, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Home,
    title: "Buy",
    description: "Find your dream home with expert guidance through Singapore's property market.",
    link: "/services",
  },
  {
    icon: TrendingUp,
    title: "Sell",
    description: "Maximise your property's value with our proven marketing strategies.",
    link: "/services",
  },
  {
    icon: Building2,
    title: "Invest",
    description: "Build wealth through strategic property investments with personalised advice.",
    link: "/services",
  },
  {
    icon: Key,
    title: "Rent",
    description: "Seamless rental solutions for tenants and landlords across all districts.",
    link: "/services",
  },
];

export function ServicesSection() {
  return (
    <section className="py-20 bg-cream-dark">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            How We Help You
          </h2>
          <p className="font-body text-muted-foreground mt-2 max-w-lg mx-auto">
            Four decades of expertise at your service
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service) => (
            <Link
              key={service.title}
              to={service.link}
              className="group bg-card p-6 rounded-lg border border-transparent hover:border-gold/40 shadow-card hover:shadow-gold transition-all duration-300"
            >
              <service.icon size={32} className="text-gold mb-4" />
              <h3 className="font-heading text-xl font-bold text-foreground mb-2">
                {service.title}
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
                {service.description}
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-body font-medium text-gold group-hover:gap-2 transition-all">
                Learn More <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
