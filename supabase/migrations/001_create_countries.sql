-- Countries table
-- Stores all markets/regions the dashboard tracks.
-- id matches the frontend's country code (e.g. 'us', 'au', 'jp').

create table if not exists countries (
  id          text primary key,
  name        text not null,
  region      text not null,
  flag_code   text not null,
  lat         numeric,
  lng         numeric,
  created_at  timestamptz default now()
);

-- Seed from the existing mock data
insert into countries (id, name, region, flag_code, lat, lng) values
  ('us', 'United States',  'North America',  'us',  39.8,  -98.5),
  ('cn', 'China',          'Asia',           'cn',  35.8,  104.2),
  ('jp', 'Japan',          'Asia',           'jp',  36.2,  138.2),
  ('kr', 'South Korea',    'Asia',           'kr',  35.9,  127.7),
  ('gb', 'United Kingdom', 'Europe',         'gb',  55.3,  -3.4),
  ('de', 'Germany',        'Europe',         'de',  51.1,  10.4),
  ('fr', 'France',         'Europe',         'fr',  46.2,  2.2),
  ('au', 'Australia',      'Oceania',        'au', -25.2,  133.7),
  ('br', 'Brazil',         'South America',  'br', -14.2,  -51.9),
  ('in', 'India',          'Asia',           'in',  20.5,  78.9),
  ('sg', 'Singapore',      'Asia',           'sg',   1.3,  103.8),
  ('mx', 'Mexico',         'North America',  'mx',  23.6, -102.5),
  ('id', 'Indonesia',      'Asia',           'id',  -0.8,  113.9),
  ('th', 'Thailand',       'Asia',           'th',  15.8,  101.0),
  ('ca', 'Canada',         'North America',  'ca',  56.1, -106.3)
on conflict (id) do nothing;
