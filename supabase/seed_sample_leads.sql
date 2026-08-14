-- One-off sample/test lead data for exercising LeadsScene and its activities
-- (filters, search, reassignment once that migration is live, etc.).
-- NOT a schema migration — lives outside supabase/migrations/ deliberately,
-- since it's test rows with hardcoded per-database UUIDs, not a repeatable
-- schema change. Run once via the Supabase Dashboard SQL Editor (needs
-- elevated privileges past RLS — the anon key alone cannot insert here on
-- this project's actual live policy, confirmed 2026-08-10).
--
-- Agents used (already existing, published agent_profiles):
--   Peh Heng Tuk   (htpeh73@gmail.com)      380851cd-4e31-43cf-8b34-5333833a2be9
--   Toh Jun Chong  (junchong@hengfatt.com)  c299c65c-3a69-4940-9713-026ef8b4bf32
-- Properties linked (already existing, active listings):
--   Oxley Residence               0a1db21a-644d-4a1d-a784-50fec670b4d5
--   69 70 Mohamed Sultan Road     fcc20ad1-1279-4df8-b4af-4a08bffca078

insert into public.leads
  (agent_id, full_name, email, phone, status, source, ai_score, property_id, converted_at, notes)
values
  ('380851cd-4e31-43cf-8b34-5333833a2be9', 'Alice Tan',    'alice.tan@example.com',    '91234567', 'new',       'website',  82,   null,                                     null,                    'Enquired via homepage contact form, keen on District 9-10 condos.'),
  ('380851cd-4e31-43cf-8b34-5333833a2be9', 'Marcus Lee',   'marcus.lee@example.com',   '92345678', 'new',       'whatsapp', null, null,                                     null,                    'Messaged directly on WhatsApp asking about rental options.'),
  ('380851cd-4e31-43cf-8b34-5333833a2be9', 'Priya Nair',   'priya.nair@example.com',   '93456789', 'contacted', 'referral', 55,   null,                                     null,                    'Referred by an existing client, first call done, following up next week.'),
  ('380851cd-4e31-43cf-8b34-5333833a2be9', 'David Ong',    'david.ong@example.com',    '94567890', 'viewing',   'portal',   68,   '0a1db21a-644d-4a1d-a784-50fec670b4d5',   null,                    'Viewing scheduled for Oxley Residence.'),
  ('380851cd-4e31-43cf-8b34-5333833a2be9', 'Grace Koh',    'grace.koh@example.com',    '95678901', 'offer',     'agent',    91,   'fcc20ad1-1279-4df8-b4af-4a08bffca078',   null,                    'Submitted an offer, awaiting seller response.'),
  ('380851cd-4e31-43cf-8b34-5333833a2be9', 'Farah Ismail', 'farah.ismail@example.com', '96789012', 'closed',    'website',  75,   null,                                     '2026-08-01T10:00:00+08', 'Deal closed last week.'),
  ('c299c65c-3a69-4940-9713-026ef8b4bf32', 'Ryan Chua',    'ryan.chua@example.com',    '97890123', 'lost',      'voice',    20,   null,                                     null,                    'Went with another agency.'),
  ('c299c65c-3a69-4940-9713-026ef8b4bf32', 'Siti Aminah',  'siti.aminah@example.com',  '98901234', 'new',       'whatsapp', null, null,                                     null,                    'New enquiry, not yet contacted.');
