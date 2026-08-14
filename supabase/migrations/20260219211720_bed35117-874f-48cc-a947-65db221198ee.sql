
-- ============================================================
-- HENG FATT PROPERTY — FULL SCHEMA MIGRATION
-- Adapted for existing user_roles + has_role() setup
-- ============================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- NEW ENUMS (app_role already exists)
-- ============================================================
DO $$ BEGIN CREATE TYPE property_type AS ENUM ('HDB', 'Condo', 'Landed', 'Commercial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tenure_type AS ENUM ('Freehold', '99-year', '999-year', 'Leasehold'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listing_status AS ENUM ('active', 'sold', 'rented', 'archived', 'draft'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'viewing', 'offer', 'closed', 'lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lead_source AS ENUM ('website', 'whatsapp', 'referral', 'portal', 'voice', 'agent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE application_status AS ENUM ('pending', 'reviewing', 'interview', 'approved', 'declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE enquiry_channel AS ENUM ('form', 'whatsapp', 'phone', 'email', 'voice'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE viewing_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lang_code AS ENUM ('en', 'zh'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_type AS ENUM ('sale', 'rental'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PROFILES (NO role column — roles live in user_roles table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  display_name    text,
  email           text unique not null,
  phone           text,
  avatar_url      text,
  preferred_lang  lang_code default 'en',
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- DROP OLD agents_profile (empty), CREATE new agent_profiles
-- ============================================================
DROP TABLE IF EXISTS public.agents_profile CASCADE;

CREATE TABLE public.agent_profiles (
  id                uuid primary key references public.profiles(id) on delete cascade,
  slug              text unique not null,
  cea_no            text unique not null,
  bio_en            text,
  bio_zh            text,
  specialisations   text[] default '{}',
  languages         text[] default '{English}',
  years_experience  int default 0,
  video_intro_url   text,
  linkedin_url      text,
  is_featured       boolean default false,
  display_order     int default 99,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- ALTER existing agent_applications to match new schema
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS nric_last4 char(4);
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS specialisations text[] DEFAULT '{}';
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS portfolio_url text;
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS resume_url text;
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS short_bio text;
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS status application_status DEFAULT 'pending';
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS admin_notes text;
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS reviewed_by uuid;
  ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
END $$;
-- Rename cea_registration_number to cea_no if it exists
DO $$ BEGIN
  ALTER TABLE public.agent_applications RENAME COLUMN cea_registration_number TO cea_no;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ============================================================
-- MEMBER PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_preferences (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  preferred_types     property_type[] default '{}',
  preferred_districts int[] default '{}',
  budget_min          numeric(12,2),
  budget_max          numeric(12,2),
  tenure_preference   tenure_type,
  bedroom_min         int,
  subscribed_reports  boolean default true,
  subscribed_alerts   boolean default true,
  updated_at          timestamptz default now()
);

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id                uuid primary key default uuid_generate_v4(),
  agent_id          uuid not null references public.agent_profiles(id),
  title             text not null,
  title_zh          text,
  description_en    text,
  description_zh    text,
  type              property_type not null,
  transaction_type  transaction_type not null default 'sale',
  status            listing_status not null default 'draft',
  district          int check (district between 1 and 28),
  address           text,
  postal_code       char(6),
  price             numeric(14,2) not null,
  price_psf         numeric(10,2),
  size_sqft         numeric(10,2),
  bedrooms          int,
  bathrooms         int,
  floor_level       text,
  total_floors      int,
  tenure            tenure_type,
  top_year          int,
  mrt_nearest       text,
  mrt_distance_m    int,
  school_nearest    text,
  latitude          numeric(10,7),
  longitude         numeric(10,7),
  is_featured       boolean default false,
  view_count        int default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

CREATE INDEX IF NOT EXISTS properties_fts_idx ON public.properties
  USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description_en,'')));

-- ============================================================
-- PROPERTY IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_images (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  url          text not null,
  is_cover     boolean default false,
  display_order int default 0,
  created_at   timestamptz default now()
);

-- ============================================================
-- PROPERTY AUDIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_audio (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  lang         lang_code not null,
  audio_url    text not null,
  script_text  text,
  generated_at timestamptz default now(),
  unique(property_id, lang)
);

-- ============================================================
-- PROPERTY FLOOR PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_floor_plans (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  url          text not null,
  label        text,
  display_order int default 0
);

-- ============================================================
-- SAVED LISTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_listings (
  id           uuid primary key default uuid_generate_v4(),
  member_id    uuid not null references public.profiles(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  created_at   timestamptz default now(),
  unique(member_id, property_id)
);

-- ============================================================
-- SAVED SEARCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id               uuid primary key default uuid_generate_v4(),
  member_id        uuid not null references public.profiles(id) on delete cascade,
  label            text,
  filters          jsonb not null default '{}',
  alert_enabled    boolean default true,
  last_alerted_at  timestamptz,
  created_at       timestamptz default now()
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id            uuid primary key default uuid_generate_v4(),
  full_name     text,
  email         text,
  phone         text,
  nationality   text,
  source        lead_source default 'website',
  property_id   uuid references public.properties(id),
  agent_id      uuid references public.agent_profiles(id),
  member_id     uuid references public.profiles(id),
  ai_score      int check (ai_score between 0 and 100),
  ai_summary    text,
  status        lead_status default 'new',
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- ENQUIRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enquiries (
  id           uuid primary key default uuid_generate_v4(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  message      text not null,
  channel      enquiry_channel default 'form',
  replied_at   timestamptz,
  created_at   timestamptz default now()
);

-- ============================================================
-- VIEWINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.viewings (
  id            uuid primary key default uuid_generate_v4(),
  lead_id       uuid not null references public.leads(id),
  property_id   uuid not null references public.properties(id),
  agent_id      uuid not null references public.agent_profiles(id),
  scheduled_at  timestamptz not null,
  duration_mins int default 60,
  status        viewing_status default 'pending',
  notes         text,
  gcal_event_id text,
  created_at    timestamptz default now()
);

-- ============================================================
-- VOICE SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id                uuid primary key default uuid_generate_v4(),
  lead_id           uuid references public.leads(id),
  member_id         uuid references public.profiles(id),
  transcript        text,
  intent_json       jsonb,
  matched_listings  uuid[] default '{}',
  lang              lang_code default 'en',
  created_at        timestamptz default now()
);

-- ============================================================
-- BLOG POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id              uuid primary key default uuid_generate_v4(),
  author_id       uuid references public.agent_profiles(id),
  title_en        text not null,
  title_zh        text,
  slug            text unique not null,
  excerpt_en      text,
  excerpt_zh      text,
  content_en      text,
  content_zh      text,
  cover_image_url text,
  category        text,
  is_gated        boolean default false,
  is_featured     boolean default false,
  published_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- MARKET REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.market_reports (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  description  text,
  file_url     text not null,
  cover_url    text,
  period       text,
  published_at timestamptz default now(),
  created_at   timestamptz default now()
);

-- ============================================================
-- TESTIMONIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.testimonials (
  id            uuid primary key default uuid_generate_v4(),
  agent_id      uuid references public.agent_profiles(id),
  client_name   text not null,
  client_type   text,
  content       text not null,
  rating        int check (rating between 1 and 5),
  is_verified   boolean default false,
  is_featured   boolean default false,
  created_at    timestamptz default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         text not null,
  title        text,
  message      text,
  link         text,
  is_read      boolean default false,
  created_at   timestamptz default now()
);

-- ============================================================
-- MORTGAGE PRESETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mortgage_presets (
  id            uuid primary key default uuid_generate_v4(),
  label         text not null,
  rate_percent  numeric(5,3) not null,
  max_tenure_yr int default 25,
  loan_type     text,
  is_default    boolean default false,
  updated_at    timestamptz default now()
);

INSERT INTO public.mortgage_presets (label, rate_percent, max_tenure_yr, loan_type, is_default)
SELECT * FROM (VALUES
  ('HDB Concessionary Loan', 2.600, 25, 'HDB', true),
  ('Bank Loan (Fixed 2yr)', 3.400, 30, 'Bank', false),
  ('Bank Loan (Floating)', 3.750, 30, 'Bank', false)
) AS v(label, rate_percent, max_tenure_yr, loan_type, is_default)
WHERE NOT EXISTS (SELECT 1 FROM public.mortgage_presets LIMIT 1);

-- ============================================================
-- DISTRICTS REFERENCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.districts (
  district_no   int primary key check (district_no between 1 and 28),
  name_en       text not null,
  name_zh       text,
  area          text,
  avg_psf       numeric(10,2),
  description   text
);

INSERT INTO public.districts (district_no, name_en, area)
SELECT * FROM (VALUES
  (1,'Boat Quay / Raffles Place / Marina','Central'),
  (2,'Chinatown / Tanjong Pagar','Central'),
  (3,'Alexandra / Commonwealth','Central'),
  (4,'Harbourfront / Telok Blangah','Central'),
  (5,'Buona Vista / West Coast / Clementi','West'),
  (6,'City Hall / Clarke Quay','Central'),
  (7,'Beach Road / Bugis / Rochor','Central'),
  (8,'Farrer Park / Serangoon Road','Central'),
  (9,'Orchard / River Valley','Core Central'),
  (10,'Tanglin / Holland / Bukit Timah','Core Central'),
  (11,'Newton / Novena','Core Central'),
  (12,'Balestier / Toa Payoh / Serangoon','Central'),
  (13,'Macpherson / Braddell','Central'),
  (14,'Eunos / Geylang / Paya Lebar','East'),
  (15,'East Coast / Marine Parade','East'),
  (16,'Bedok / Upper East Coast','East'),
  (17,'Changi / Loyang / Pasir Ris','East'),
  (18,'Pasir Ris / Tampines','East'),
  (19,'Hougang / Punggol / Sengkang','North-East'),
  (20,'Ang Mo Kio / Bishan / Thomson','Central'),
  (21,'Clementi Park / Upper Bukit Timah','West'),
  (22,'Boon Lay / Jurong / Tuas','West'),
  (23,'Bukit Batok / Bukit Panjang / Choa Chu Kang','West'),
  (24,'Lim Chu Kang / Tengah','North'),
  (25,'Admiralty / Woodlands','North'),
  (26,'Mandai / Upper Thomson','North'),
  (27,'Sembawang / Yishun','North'),
  (28,'Seletar / Yio Chu Kang','North-East')
) AS v(district_no, name_en, area)
WHERE NOT EXISTS (SELECT 1 FROM public.districts LIMIT 1);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles visible to all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- AGENT PROFILES
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent profiles public read" ON public.agent_profiles FOR SELECT USING (true);
CREATE POLICY "Agents update own agent profile" ON public.agent_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Agents insert own agent profile" ON public.agent_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin full access agent profiles" ON public.agent_profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- AGENT APPLICATIONS (keep existing insert policy, add admin read)
CREATE POLICY "Admin read applications" ON public.agent_applications FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update applications" ON public.agent_applications FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- MEMBER PREFERENCES
ALTER TABLE public.member_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage own preferences" ON public.member_preferences FOR ALL USING (auth.uid() = id);

-- PROPERTIES
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active listings public read" ON public.properties FOR SELECT USING (status = 'active');
CREATE POLICY "Agents manage own listings" ON public.properties FOR ALL USING (auth.uid() = agent_id);
CREATE POLICY "Admin full access properties" ON public.properties FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PROPERTY IMAGES (public read, agents manage via property ownership)
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Property images public read" ON public.property_images FOR SELECT USING (true);
CREATE POLICY "Agents manage own property images" ON public.property_images FOR ALL USING (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND agent_id = auth.uid())
);

-- PROPERTY AUDIO
ALTER TABLE public.property_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Property audio public read" ON public.property_audio FOR SELECT USING (true);
CREATE POLICY "Agents manage own property audio" ON public.property_audio FOR ALL USING (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND agent_id = auth.uid())
);

-- PROPERTY FLOOR PLANS
ALTER TABLE public.property_floor_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Floor plans public read" ON public.property_floor_plans FOR SELECT USING (true);
CREATE POLICY "Agents manage own floor plans" ON public.property_floor_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND agent_id = auth.uid())
);

-- SAVED LISTINGS
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage own saved listings" ON public.saved_listings FOR ALL USING (auth.uid() = member_id);

-- SAVED SEARCHES
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage own saved searches" ON public.saved_searches FOR ALL USING (auth.uid() = member_id);

-- LEADS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents see own leads" ON public.leads FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Members see own lead" ON public.leads FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Anyone can create leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Agents update own leads" ON public.leads FOR UPDATE USING (auth.uid() = agent_id);
CREATE POLICY "Admin full access leads" ON public.leads FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ENQUIRIES
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enquiry owners read" ON public.enquiries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND (agent_id = auth.uid() OR member_id = auth.uid()))
);
CREATE POLICY "Anyone can create enquiries" ON public.enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access enquiries" ON public.enquiries FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- VIEWINGS
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents manage own viewings" ON public.viewings FOR ALL USING (auth.uid() = agent_id);
CREATE POLICY "Admin full access viewings" ON public.viewings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- VOICE SESSIONS
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see own voice sessions" ON public.voice_sessions FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Anyone can create voice sessions" ON public.voice_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access voice sessions" ON public.voice_sessions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- BLOG POSTS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published posts public read" ON public.blog_posts FOR SELECT USING (published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "Agents manage own posts" ON public.blog_posts FOR ALL USING (auth.uid() = author_id);
CREATE POLICY "Admin full access blog posts" ON public.blog_posts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- MARKET REPORTS (public read for metadata, gated download handled in app)
ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Market reports public read" ON public.market_reports FOR SELECT USING (true);
CREATE POLICY "Admin manage market reports" ON public.market_reports FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- TESTIMONIALS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verified testimonials public read" ON public.testimonials FOR SELECT USING (is_verified = true);
CREATE POLICY "Admin full access testimonials" ON public.testimonials FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- MORTGAGE PRESETS (public read, admin manage)
ALTER TABLE public.mortgage_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mortgage presets public read" ON public.mortgage_presets FOR SELECT USING (true);
CREATE POLICY "Admin manage mortgage presets" ON public.mortgage_presets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- DISTRICTS (public read)
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Districts public read" ON public.districts FOR SELECT USING (true);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_agent_profiles_updated_at BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Increment property view count
CREATE OR REPLACE FUNCTION public.increment_view_count(property_uuid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.properties SET view_count = view_count + 1 WHERE id = property_uuid;
$$;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('property-audio', 'property-audio', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-avatars', 'agent-avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('floor-plans', 'floor-plans', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('market-reports', 'market-reports', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-applications', 'agent-applications', false) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for public buckets
CREATE POLICY "Public read property images" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
CREATE POLICY "Public read property audio" ON storage.objects FOR SELECT USING (bucket_id = 'property-audio');
CREATE POLICY "Public read agent avatars" ON storage.objects FOR SELECT USING (bucket_id = 'agent-avatars');
CREATE POLICY "Public read floor plans" ON storage.objects FOR SELECT USING (bucket_id = 'floor-plans');

-- Agents can upload to their buckets
CREATE POLICY "Agents upload property images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-images' AND auth.role() = 'authenticated');
CREATE POLICY "Agents upload property audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-audio' AND auth.role() = 'authenticated');
CREATE POLICY "Agents upload agent avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agent-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Agents upload floor plans" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'floor-plans' AND auth.role() = 'authenticated');

-- Members can read market reports if authenticated
CREATE POLICY "Authenticated read market reports" ON storage.objects FOR SELECT USING (bucket_id = 'market-reports' AND auth.role() = 'authenticated');
CREATE POLICY "Admin upload market reports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'market-reports' AND public.has_role(auth.uid(), 'admin'));

-- Agent applications storage (applicant upload + admin read)
CREATE POLICY "Anyone upload agent applications" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agent-applications');
CREATE POLICY "Admin read agent applications" ON storage.objects FOR SELECT USING (bucket_id = 'agent-applications' AND public.has_role(auth.uid(), 'admin'));
