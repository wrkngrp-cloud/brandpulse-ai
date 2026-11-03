-- The Competitor Move Tracker now reads competitors' own posts on X and their
-- App Store release notes, where a new campaign shows up before any outlet
-- writes it up. A campaign is its own kind of move, so the category check
-- gains 'campaign'. No new table, so no new policy; RLS on competitor_moves
-- is unchanged.

alter table competitor_moves drop constraint if exists competitor_moves_category_check;
alter table competitor_moves add constraint competitor_moves_category_check
  check (category in ('product_launch','product_change','pricing','campaign',
                      'partnership','expansion','positioning','company'));
