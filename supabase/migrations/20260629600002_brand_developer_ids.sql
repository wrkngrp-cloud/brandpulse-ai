alter table brands add column if not exists github_repo text;
comment on column brands.github_repo is 'GitHub repo in owner/repo format, e.g. "paystack/paystack-php"';

alter table brands add column if not exists npm_package_name text;
comment on column brands.npm_package_name is 'npm package name, e.g. "@paystack/inline-js"';

alter table brands add column if not exists stackoverflow_tag text;
comment on column brands.stackoverflow_tag is 'Stack Overflow tag, e.g. "paystack"';
