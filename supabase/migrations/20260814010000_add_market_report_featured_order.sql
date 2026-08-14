alter table public.market_reports
  add column if not exists is_featured boolean not null default false,
  add column if not exists display_order integer not null default 100;

update public.market_reports
set
  is_featured = true,
  display_order = 1
where title = 'Singapore Luxury Property Market 2026: Why the Prime Market Is Regaining Momentum';
