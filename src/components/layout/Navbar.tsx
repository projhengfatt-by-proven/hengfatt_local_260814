import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Team", to: "/team" },
  { label: "Properties", to: "/properties" },
  { label: "Insights", to: "/insights" },
  { label: "Services", to: "/services" },
  { label: "Contact", to: "/contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isHero = location.pathname === "/";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-md border-b border-navy-light/30">
      <div className="container flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-heading text-xl md:text-2xl font-bold text-gold">
            Heng Fatt Property
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 text-sm font-body font-medium transition-colors rounded-md ${
                location.pathname === link.to
                  ? "text-gold"
                  : "text-primary-foreground/70 hover:text-gold"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/agent-login"
            className="ml-2 bg-[#C6A75E] hover:bg-[#D4B46A] text-[#0B1C2D] font-body font-semibold text-sm px-4 py-2 rounded-lg transition-all duration-300"
          >
            Agent Access
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden text-primary-foreground p-2"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {open && (
        <div className="lg:hidden bg-primary border-t border-navy-light/30 pb-4">
          <nav className="container flex flex-col gap-1 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={`px-3 py-2.5 text-sm font-body font-medium rounded-md transition-colors ${
                  location.pathname === link.to
                    ? "text-gold bg-navy-light/30"
                    : "text-primary-foreground/70 hover:text-gold"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/agent-login"
              onClick={() => setOpen(false)}
              className="mt-2 block text-center bg-[#C6A75E] hover:bg-[#D4B46A] text-[#0B1C2D] font-body font-semibold text-sm px-4 py-2.5 rounded-lg transition-all duration-300"
            >
              Agent Access
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
