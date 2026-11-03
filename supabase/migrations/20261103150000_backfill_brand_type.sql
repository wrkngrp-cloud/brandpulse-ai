-- Every brand onboarded before 3 November 2026 was scored as FMCG.
--
-- Onboarding saved the industry the marketer picked and never brand_type,
-- which defaults to 'fmcg'. So a fintech brand got FMCG weights in its BHI,
-- FMCG funnel signals and FMCG nav. Onboarding now sets it (see
-- brandTypeForIndustry in src/lib/bhi.ts); this corrects the brands already
-- saved, with the same mapping.
--
-- Only rows still on the 'fmcg' default whose industry clearly says
-- otherwise are touched. A brand someone set by hand in Settings to another
-- vertical is not 'fmcg' and is left alone. No table or policy changes.

update brands set brand_type = case industry
    when 'fintech'   then 'fintech'
    when 'insurance' then 'fintech'
    when 'b2b_saas'  then 'b2b_saas'
    when 'agency'    then 'agency'
    when 'qsr'       then 'venue'
  end
where brand_type = 'fmcg'
  and industry in ('fintech', 'insurance', 'b2b_saas', 'agency', 'qsr');
