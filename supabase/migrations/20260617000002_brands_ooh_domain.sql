-- Store the brand's custom OOH redirect domain (e.g. go.kuda.com)
alter table brands add column if not exists ooh_redirect_domain text;
alter table brands add column if not exists ooh_redirect_domain_verified boolean default false;
