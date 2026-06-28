-- Fix creative_assets RLS: brand_id was passed directly to is_workspace_member()
-- which expects a workspace_id. The function would always return false, blocking all reads.
DROP POLICY IF EXISTS "workspace members can manage creative assets" ON creative_assets;

CREATE POLICY "creative_assets_workspace"
  ON creative_assets
  FOR ALL
  USING  (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)))
  WITH CHECK (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));
