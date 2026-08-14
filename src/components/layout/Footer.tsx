import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <h3 className="font-heading text-2xl font-bold text-gold mb-3">
              Heng Fatt Property
            </h3>
            <p className="text-sm text-primary-foreground/60 font-body leading-relaxed">
              Singapore's trusted boutique real estate agency since 1979.
              Discreet, dignified, dedicated.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading text-sm font-semibold text-gold uppercase tracking-wider mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              {[
                { label: "Listings", to: "/listings" },
                { label: "Our Team", to: "/team" },
                { label: "Market Insights", to: "/insights" },
                { label: "About Us", to: "/about" },
                { label: "Contact", to: "/contact" },
              ].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-primary-foreground/60 hover:text-gold transition-colors font-body"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-heading text-sm font-semibold text-gold uppercase tracking-wider mb-4">
              Services
            </h4>
            <ul className="space-y-2">
              {["Buy a Property", "Sell Your Property", "Investment Advisory", "Rental Services"].map((s) => (
                <li key={s}>
                  <Link
                    to="/services"
                    className="text-sm text-primary-foreground/60 hover:text-gold transition-colors font-body"
                  >
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-sm font-semibold text-gold uppercase tracking-wider mb-4">
              Contact Us
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-primary-foreground/60 font-body">
                <MapPin size={16} className="text-gold mt-0.5 shrink-0" />
                10 Anson Road, #03-17, International Plaza, Singapore 079903
              </li>
              <li className="flex items-center gap-2 text-sm text-primary-foreground/60 font-body">
                <Phone size={16} className="text-gold shrink-0" />
                +65 6225-5588
              </li>
              <li className="flex items-center gap-2 text-sm text-primary-foreground/60 font-body">
                <Mail size={16} className="text-gold shrink-0" />
                enquiry@hengfatt.com
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-navy-light/40">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-primary-foreground/40 font-body">
              © {new Date().getFullYear()} Heng Fatt Property Pte. Ltd. All rights reserved.
            </p>
            <p className="text-xs text-primary-foreground/40 font-body text-center">
              CEA Licence No: L3002022A | UEN: 197900123A | Registered with the Council for Estate Agencies, Singapore
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
