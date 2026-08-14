import { Link } from "react-router-dom";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-skyline.jpg";

export function HeroSection() {
  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Singapore skyline"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/60 to-primary/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 container text-center px-4">
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6 animate-fade-in-up">
          Trusted Since 1979.
          <br />
          <span className="text-gold">Your Property. Your Legacy.</span>
        </h1>
        <p className="font-body text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          Singapore's boutique real estate specialists — discreet, dignified,
          dedicated.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Button asChild size="lg" className="bg-[#C6A75E] hover:bg-[#D4B46A] text-[#0B1C2D] font-body font-semibold text-base px-8 py-6 rounded-lg border-none shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_18px_rgba(198,167,94,0.35)] transition-all duration-300 ease-in-out">
            <Link to="/listings">Explore Listings</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="bg-transparent text-[#F5F1E8] border-[1.5px] border-[#C6A75E] hover:bg-[rgba(198,167,94,0.1)] hover:text-white hover:border-[#D4B46A] font-body font-medium text-base px-8 py-6 rounded-lg transition-all duration-300 ease-in-out">
            <a href="https://wa.me/6588254821?text=Hi%2C%20I%27d%20like%20to%20enquire%20about%20your%20properties." target="_blank" rel="noopener noreferrer">
              <MessageCircle size={18} className="mr-2" />
              WhatsApp Us
            </a>
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/50">
        <ChevronDown size={28} />
      </div>
    </section>
  );
}
