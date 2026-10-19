import { requireStaff } from '@/lib/desk/auth'
import { createClient } from '@/lib/supabase/server'
import { DeskShell } from '@/components/desk/desk-shell'

export const dynamic = 'force-dynamic'

/**
 * Everything inside this group needs an active staff row.
 *
 * The check is here rather than in each page so no page can forget it, and the
 * middleware already turned away anyone with no session at all. Pages still
 * call requireStaff with their own permission, because being staff and being
 * allowed to open the revenue screen are different questions.
 */
export default async function DeskAuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff()

  const supabase = await createClient()
  const { data: role } = await supabase
    .from('staff_roles').select('label').eq('name', session.role).maybeSingle()

  return (
    <DeskShell
      fullName={session.fullName}
      roleLabel={role?.label ?? session.role}
      permissions={[...session.permissions]}
      isSuperAdmin={session.isSuperAdmin}
    >
      {children}
    </DeskShell>
  )
}
