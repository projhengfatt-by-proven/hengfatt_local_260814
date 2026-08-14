import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export function CTABanner() {
  return (
    <section className="py-20 bg-primary">
      <div className="container text-center">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Find Your Perfect Property?
        </h2>
        <p className="font-body text-base text-white/60 max-w-lg mx-auto mb-8">
          Speak to our specialists today — no obligation, just expertise.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="bg-[#C6A75E] hover:bg-[#D4B46A] text-[#0B1C2D] font-body font-semibold text-base px-8 py-6 rounded-lg border-none shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_18px_rgba(198,167,94,0.35)] transition-all duration-300 ease-in-out">
            <Link to="/contact">Book a Consultation</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="bg-transparent text-[#F5F1E8] border-[1.5px] border-[#C6A75E] hover:bg-[rgba(198,167,94,0.1)] hover:text-white hover:border-[#D4B46A] font-body font-medium text-base px-8 py-6 rounded-lg transition-all duration-300 ease-in-out">
            <a
              href="https://wa.me/6562201979"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} className="mr-2" />
              WhatsApp Us
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
