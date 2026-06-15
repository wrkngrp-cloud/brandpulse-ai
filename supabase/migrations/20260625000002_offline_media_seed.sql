-- ── Radio Stations Seed ─────────────────────────────────────────────────────
insert into radio_stations (name, frequency, city, state, reach_am, reach_pm, reach_day, network, is_national) values
-- Lagos
('Cool FM Lagos',          '96.9 FM',  'Lagos',         'Lagos',  500000, 380000, 220000, 'Cool FM',       false),
('Beat FM Lagos',          '99.9 FM',  'Lagos',         'Lagos',  340000, 280000, 180000, 'Beat FM',       false),
('Rhythm FM Lagos',        '93.7 FM',  'Lagos',         'Lagos',  290000, 230000, 150000, 'Rhythm FM',     false),
('Smooth FM Lagos',        '98.1 FM',  'Lagos',         'Lagos',  210000, 190000, 120000, 'Smooth FM',     false),
('Classic FM Lagos',       '97.3 FM',  'Lagos',         'Lagos',  160000, 140000,  90000, 'Classic FM',    false),
('Traffic Radio Lagos',    '96.1 FM',  'Lagos',         'Lagos',  180000, 160000, 100000, 'Traffic Radio', false),
('Radio Continental Lagos','102.3 FM', 'Lagos',         'Lagos',  140000, 120000,  80000, 'Radio Continental', false),
('Nigeria Info Lagos',     '99.3 FM',  'Lagos',         'Lagos',  170000, 150000,  95000, 'Nigeria Info',  false),
('Wazobia FM Lagos',       '94.1 FM',  'Lagos',         'Lagos',  380000, 310000, 200000, 'Wazobia FM',    false),
('Lagos Talks',            '91.3 FM',  'Lagos',         'Lagos',  120000, 100000,  70000, 'Lagos Talks',   false),
-- Abuja
('Cool FM Abuja',          '98.9 FM',  'Abuja',         'FCT',    320000, 250000, 160000, 'Cool FM',       false),
('Wazobia FM Abuja',       '99.5 FM',  'Abuja',         'FCT',    240000, 195000, 130000, 'Wazobia FM',    false),
('Nigeria Info Abuja',     '95.1 FM',  'Abuja',         'FCT',    190000, 155000, 105000, 'Nigeria Info',  false),
('Radio Nigeria 1 Abuja',  '104.5 FM', 'Abuja',         'FCT',    280000, 210000, 145000, 'Radio Nigeria', false),
('Naija FM Abuja',         '107.3 FM', 'Abuja',         'FCT',    145000, 120000,  80000, 'Naija FM',      false),
-- Port Harcourt
('Cool FM Port Harcourt',  '92.3 FM',  'Port Harcourt', 'Rivers', 260000, 205000, 140000, 'Cool FM',       false),
('Wazobia FM Port Harcourt','93.1 FM', 'Port Harcourt', 'Rivers', 200000, 165000, 110000, 'Wazobia FM',    false),
('Rhythm FM Port Harcourt','92.7 FM',  'Port Harcourt', 'Rivers', 175000, 145000,  95000, 'Rhythm FM',     false),
('Nigeria Info PH',        '92.0 FM',  'Port Harcourt', 'Rivers', 130000, 105000,  70000, 'Nigeria Info',  false),
-- Ibadan
('Fresh FM Ibadan',        '105.9 FM', 'Ibadan',        'Oyo',    220000, 175000, 120000, 'Fresh FM',      false),
('Diamond FM Ibadan',      '89.1 FM',  'Ibadan',        'Oyo',    140000, 115000,  75000, 'Diamond FM',    false),
('Splash FM Ibadan',       '105.5 FM', 'Ibadan',        'Oyo',    160000, 130000,  90000, 'Splash FM',     false),
-- Kano
('Freedom FM Kano',        '98.0 FM',  'Kano',          'Kano',   280000, 220000, 155000, 'Freedom FM',    false),
('Rahama FM Kano',         '98.8 FM',  'Kano',          'Kano',   195000, 155000, 105000, 'Rahama FM',     false),
('Rarara FM Kano',         '101.9 FM', 'Kano',          'Kano',   160000, 130000,  88000, 'Rarara FM',     false),
-- Enugu
('Bond FM Enugu',          '92.5 FM',  'Enugu',         'Enugu',  145000, 115000,  78000, 'Bond FM',       false),
('Coal City FM Enugu',     '90.5 FM',  'Enugu',         'Enugu',  120000,  95000,  65000, 'Coal City FM',  false),
-- Kaduna
('Arewa FM Kaduna',        '93.5 FM',  'Kaduna',        'Kaduna', 230000, 185000, 125000, 'Arewa FM',      false),
('Invicta FM Kaduna',      '92.5 FM',  'Kaduna',        'Kaduna', 155000, 125000,  85000, 'Invicta FM',    false),
-- Benin City
('Brilla FM Benin',        '88.9 FM',  'Benin City',    'Edo',    175000, 140000,  95000, 'Brilla FM',     false),
('Nigeria Info Benin',     '96.5 FM',  'Benin City',    'Edo',    130000, 105000,  70000, 'Nigeria Info',  false),
-- Owerri
('Orange FM Owerri',       '97.1 FM',  'Owerri',        'Imo',    125000, 100000,  68000, 'Orange FM',     false),
-- National
('FRCN Network',           NULL,       'Lagos',         'Lagos',  850000, 680000, 450000, 'FRCN',          true),
('Voice of Nigeria',       NULL,       'Abuja',         'FCT',    420000, 340000, 230000, 'VON',           true),
('Radio Nigeria 2',        '93.3 FM',  'Lagos',         'Lagos',  310000, 250000, 170000, 'Radio Nigeria', true),
-- Warri
('Maximum FM Warri',       '95.1 FM',  'Warri',         'Delta',  120000,  96000,  65000, 'Maximum FM',    false),
-- Abeokuta
('Ogun State Broadcasting','98.7 FM',  'Abeokuta',      'Ogun',   145000, 115000,  78000, 'OGBC FM',       false),
-- Jos
('Pebbles FM Jos',         '92.1 FM',  'Jos',           'Plateau',130000, 104000,  70000, 'Pebbles FM',    false),
-- Calabar
('Calabar FM',             '90.5 FM',  'Calabar',       'Cross River',110000, 88000, 60000, 'Calabar FM', false),
-- Uyo
('Flo FM Uyo',             '94.9 FM',  'Uyo',           'Akwa Ibom',105000, 84000, 57000, 'Flo FM',       false)
on conflict do nothing;

-- ── TV Channels Seed ────────────────────────────────────────────────────────
insert into tv_channels (name, type, platform, reach_prime, reach_day) values
-- FTA National
('NTA 1',             'fta_national', 'Free-to-air', 3200000, 1800000),
('NTA 2',             'fta_national', 'Free-to-air', 2800000, 1600000),
('NTA Lagos',         'fta_regional', 'Free-to-air', 2100000, 1200000),
('NTA Abuja',         'fta_regional', 'Free-to-air', 1600000,  900000),
('NTA Ibadan',        'fta_regional', 'Free-to-air', 1100000,  620000),
('NTA Kano',          'fta_regional', 'Free-to-air', 1300000,  740000),
('AIT',               'fta_national', 'Free-to-air', 2600000, 1400000),
('Channels TV',       'fta_national', 'Free-to-air', 3500000, 1900000),
('TVC',               'fta_national', 'Free-to-air', 1800000, 1000000),
('Silverbird TV',     'fta_national', 'Free-to-air', 1500000,  850000),
('Galaxy TV',         'fta_regional', 'Free-to-air', 1200000,  680000),
('MITV',              'fta_regional', 'Free-to-air', 1000000,  580000),
('Rave TV',           'fta_national', 'Free-to-air',  800000,  450000),
('Wazobia TV',        'fta_national', 'Free-to-air', 1400000,  790000),
-- Pay TV - DSTV
('Africa Magic',      'pay_tv', 'DSTV', 4200000, 2400000),
('Africa Magic Urban','pay_tv', 'DSTV', 2800000, 1600000),
('Africa Magic Epic', 'pay_tv', 'DSTV', 2100000, 1200000),
('CNN International', 'pay_tv', 'DSTV',  950000,  540000),
('MTV Base',          'pay_tv', 'DSTV', 1800000, 1000000),
('SoundCity',         'pay_tv', 'DSTV', 1600000,  900000),
('Telemundo',         'pay_tv', 'DSTV', 2200000, 1250000),
('M-Net',             'pay_tv', 'DSTV', 1100000,  620000),
('SuperSport',        'pay_tv', 'DSTV', 3800000, 2100000),
('E! Entertainment',  'pay_tv', 'DSTV', 1300000,  740000),
('Zee World',         'pay_tv', 'DSTV', 3100000, 1750000),
('EbonyLife TV',      'pay_tv', 'DSTV', 1900000, 1050000),
('Discovery Channel', 'pay_tv', 'DSTV',  880000,  500000),
('National Geographic','pay_tv','DSTV',  720000,  410000),
-- Pay TV - GOtv
('Pearl Music TV',    'pay_tv', 'GOtv', 1200000,  680000),
('Nollywood Movies',  'pay_tv', 'GOtv', 2100000, 1200000)
on conflict do nothing;

-- ── Print Publications Seed ──────────────────────────────────────────────────
insert into print_publications (name, type, circulation, readership_mult, primary_demo) values
-- Newspapers
('The Punch',         'newspaper', 150000, 4.0, 'mass market'),
('Vanguard',          'newspaper', 120000, 4.0, 'mass market'),
('The Guardian',      'newspaper',  80000, 4.0, 'business/professional'),
('This Day',          'newspaper',  60000, 4.0, 'business/professional'),
('Daily Trust',       'newspaper',  70000, 4.0, 'mass market'),
('Tribune',           'newspaper',  50000, 4.0, 'mass market'),
('The Nation',        'newspaper',  65000, 4.0, 'mass market'),
('BusinessDay',       'newspaper',  40000, 4.0, 'business/professional'),
('New Telegraph',     'newspaper',  35000, 4.0, 'mass market'),
('Daily Sun',         'newspaper',  55000, 4.0, 'mass market'),
('Premium Times',     'newspaper',  45000, 3.5, 'business/professional'),
('Sahara Reporters',  'newspaper',  30000, 3.5, 'youth'),
('Channels TV Online','newspaper',  28000, 3.0, 'mass market'),
('Leadership',        'newspaper',  38000, 4.0, 'mass market'),
('Daily Independent', 'newspaper',  25000, 4.0, 'mass market'),
-- Magazines
('Genevieve',         'magazine',  30000, 3.0, 'youth'),
('TheNEWS',           'magazine',  25000, 3.0, 'business/professional'),
('TW Magazine',       'magazine',  18000, 3.0, 'youth'),
('Encomium',          'magazine',  20000, 3.0, 'mass market'),
('City People',       'magazine',  22000, 3.0, 'mass market'),
-- Online Native
('TechCabal',         'online_native', 200000, 2.5, 'youth'),
('Nairametrics',      'online_native', 500000, 2.5, 'business/professional'),
('Techpoint.africa',  'online_native', 150000, 2.5, 'youth'),
('Stears Business',   'online_native', 120000, 2.5, 'business/professional'),
('Business Insider Africa','online_native',180000, 2.5, 'business/professional'),
('Zikoko',            'online_native', 250000, 2.5, 'youth'),
('Pulse Nigeria',     'online_native', 800000, 2.5, 'youth')
on conflict do nothing;
