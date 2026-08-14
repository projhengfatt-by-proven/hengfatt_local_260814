-- Expand market reports so insights can hold full article content.
alter table public.market_reports
  add column if not exists category text,
  add column if not exists read_time text,
  add column if not exists body text;

alter table public.market_reports
  alter column file_url drop not null;

-- Seed the first editorial insight so the public site has a real article
-- and the admin can continue editing it from the same source of truth.
insert into public.market_reports (
  title,
  category,
  description,
  body,
  cover_url,
  period,
  read_time,
  file_url,
  published_at
)
select
  'Singapore Luxury Property Market 2026: Why the Prime Market Is Regaining Momentum',
  'MARKET OUTLOOK',
  'Singapore''s luxury residential market is showing renewed strength in 2026, with prime Core Central Region properties outperforming the wider private housing market.',
  E'Singapore''s luxury residential market is entering a more interesting phase in 2026.\n\nThe headline Singapore property market remains relatively moderate, but the numbers become considerably more interesting when the market is separated by location and property type.\n\nIn Q2 2026, Singapore''s overall private residential price index increased 0.5% quarter-on-quarter, following a 0.9% increase in Q1. That brought price growth for the first half of 2026 to 1.4%.\n\nBut the prime market performed considerably better.\n\nNon-landed properties in the Core Central Region (CCR) increased 1.8% in Q2, compared with declines of 1.2% in the RCR and 0.1% in the OCR.\n\nThat divergence is important.\n\nPrime property is outperforming\n\nThe CCR has effectively moved from being one of the weaker segments after the 2023 cooling measures to becoming one of the more resilient parts of the market.\n\nAccording to CBRE, CCR prices rose 1.8% in Q2, supported by firm pricing at existing projects and buyers recognising the narrowing price gap between prime and non-prime markets.\n\nFor high-net-worth buyers, this creates an interesting environment:\n\n- prime locations remain scarce\n- the price gap with some RCR/OCR properties has narrowed\n- new supply is still relatively limited in the luxury segment\n- Singapore continues to attract international wealth\n- the highest-quality properties increasingly trade according to scarcity rather than broad market sentiment\n\nWhat does this mean for buyers?\n\nThe luxury market should not be viewed simply as "Singapore property prices are rising." Instead, the market is becoming increasingly selective.\n\nA well-located freehold residence in District 9 or 10 with excellent views, large floor area, privacy and strong developer pedigree can behave very differently from a generic condominium elsewhere.\n\nOur view: 2026 is increasingly a market where quality matters more than market direction.\n\nThere will be photos for that insight which to be created in a card list view and detail view.',
  null,
  '14 Aug 2026',
  '7 min read',
  null,
  '2026-08-14 00:00:00+08'
where not exists (
  select 1
  from public.market_reports
  where title = 'Singapore Luxury Property Market 2026: Why the Prime Market Is Regaining Momentum'
);
