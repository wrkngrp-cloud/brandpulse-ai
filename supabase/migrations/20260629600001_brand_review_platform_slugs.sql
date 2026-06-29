alter table brands add column if not exists g2_slug text;
comment on column brands.g2_slug is 'G2 product slug from g2.com/products/[slug]/reviews';

alter table brands add column if not exists capterra_slug text;
comment on column brands.capterra_slug is 'Capterra software slug from capterra.com/p/[number]/[slug]/';
