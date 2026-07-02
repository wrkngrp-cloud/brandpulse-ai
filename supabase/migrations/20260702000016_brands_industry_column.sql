-- 'industry' was added to the brands CREATE TABLE in the initial schema file
-- after that migration had already been applied to production, so the column
-- was never actually created there. Add it now.
alter table brands add column if not exists industry text;
