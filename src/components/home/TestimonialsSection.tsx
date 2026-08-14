import { useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    quote: "Heng Fatt guided us through selling our family home of 30 years. They were sensitive, professional, and achieved a price above our expectations.",
    name: "Mr & Mrs Tan",
    type: "Seller",
    rating: 5,
  },
  {
    quote: "As a first-time buyer, I was nervous about the process. My agent walked me through every step and found me the perfect flat in Clementi.",
    name: "Sarah Lim",
    type: "Buyer",
    rating: 5,
  },
  {
    quote: "I've been investing through Heng Fatt for over a decade. Their market knowledge and discretion are unmatched in the industry.",
    name: "James Wong",
    type: "Investor",
    rating: 5,
  },
  {
    quote: "The rental process was seamless. Within two weeks, they found quality tenants for my Orchard Road unit at my asking rent.",
    name: "Dr. Chen Wei Lin",
    type: "Landlord",
    rating: 5,
  },
];

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? testimonials.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === testimonials.length - 1 ? 0 : c + 1));

  const t = testimonials[current];

  return (
    <section className="py-20 gradient-navy">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white">
            What Our Clients Say
          </h2>
        </div>

        <div className="max-w-2xl mx-auto text-center relative">
          <div className="flex justify-center gap-1 mb-6">
            {Array.from({ length: t.rating }).map((_, i) => (
              <Star key={i} size={18} className="fill-gold text-gold" />
            ))}
          </div>
          <blockquote className="font-body text-lg md:text-xl text-white/90 leading-relaxed italic mb-6 min-h-[80px]">
            "{t.quote}"
          </blockquote>
          <p className="font-heading text-base font-semibold text-gold">
            {t.name}
          </p>
          <p className="font-body text-sm text-white/50 mt-1">{t.type}</p>

          {/* Navigation */}
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-gold hover:border-gold transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === current ? "bg-gold" : "bg-white/30"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-gold hover:border-gold transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
