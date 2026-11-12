-- Deleting a closed conversation, so the inbox does not become a permanent
-- stockpile. Restricted to admin and super_admin: the support and bizdev
-- roles can close a case but not erase it.
--
-- No table or column change. support_messages already cascades on
-- support_conversations (20261014122000), and the one other reference
-- (impersonation.conversation_id) is on delete set null, so deleting the
-- conversation row is safe as-is.

insert into role_permissions (role, permission) values
  ('super_admin', 'support.delete'),
  ('admin',       'support.delete')
on conflict (role, permission) do nothing;
