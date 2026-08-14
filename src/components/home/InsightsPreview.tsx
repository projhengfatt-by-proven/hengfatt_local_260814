import { Link } from "react-router-dom";

const articles = [
  {
    slug: "singapore-property-outlook-2025",
    title: "Singapore Property Market Outlook 2025",
    excerpt: "Analysing key trends shaping the residential property landscape this year.",
    category: "Market Update",
    date: "15 Jan 2025",
    readTime: "5 min read",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80",
  },
  {
    slug: "hdb-resale-guide",
    title: "Complete Guide to Buying HDB Resale Flats",
    excerpt: "Everything you need to know about the HDB resale process in Singapore.",
    category: "Buyer Tips",
    date: "8 Jan 2025",
    readTime: "8 min read",
    image: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=600&q=80",
  },
  {
    slug: "district-10-investment",
    title: "Why District 10 Remains a Top Investment",
    excerpt: "Exploring the enduring appeal of Bukit Timah and Holland Road properties.",
    category: "Investment",
    date: "2 Jan 2025",
    readTime: "6 min read",
    image: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=600&q=80",
  },
];

export function InsightsPreview() {
  return (
    <section className="py-20 bg-cream-dark">
      <div className="container">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              Market Insights
            </h2>
            <p className="font-body text-muted-foreground mt-2">
              Expert analysis from our team
            </p>
          </div>
          <Link
            to="/insights"
            className="hidden md:inline-flex font-body text-sm font-medium text-gold hover:text-gold-dark transition-colors"
          >
            View All Insights →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link
              key={article.slug}
              to={`/insights/${article.slug}`}
              className="group bg-card rounded-lg overflow-hidden shadow-card hover:shadow-elevated transition-all duration-300"
            >
              <div className="aspect-[16/10] overflow-hidden">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-5">
                <span className="text-xs font-body font-semibold text-gold uppercase tracking-wider">
                  {article.category}
                </span>
                <h3 className="font-heading text-lg font-bold text-foreground mt-2 mb-2 line-clamp-2 group-hover:text-gold transition-colors">
                  {article.title}
                </h3>
                <p className="font-body text-sm text-muted-foreground line-clamp-2 mb-3">
                  {article.excerpt}
                </p>
                <p className="text-xs font-body text-muted-foreground">
                  {article.date} · {article.readTime}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="md:hidden text-center mt-8">
          <Link
            to="/insights"
            className="font-body text-sm font-medium text-gold hover:text-gold-dark transition-colors"
          >
            View All Insights →
          </Link>
        </div>
      </div>
    </section>
  );
}
