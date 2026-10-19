/**
 * The Desk's permission vocabulary.
 *
 * Two groups in one namespace. Action keys say what a person may do; `data.*`
 * keys say which datasets a screen may render for them. They are separate
 * axes on purpose: a support agent needs the whole account timeline with the
 * money redacted, and a finance person needs the revenue without reading a
 * customer's survey responses.
 *
 * The database is the authority on who holds what (`staff_can`,
 * `staff_permissions`). This file is the list of keys those functions compare
 * against, so the editor in the Desk and the checks in the code cannot drift
 * apart.
 */

export const PERMISSION_GROUPS = [
  {
    module: 'Accounts',
    keys: [
      ['accounts.view',        'See the account list and detail'],
      ['accounts.note',        'Add notes to an account'],
      ['accounts.message',     'Send an email or in-app message'],
      ['accounts.plan_change', 'Change a workspace plan'],
      ['accounts.impersonate', 'Request a read-only consented session'],
    ],
  },
  {
    module: 'Support',
    keys: [
      ['support.view',   'Open the inbox and read threads'],
      ['support.reply',  'Reply to a customer'],
      ['support.assign', 'Assign a thread'],
      ['support.close',  'Close a thread'],
    ],
  },
  {
    module: 'Leads',
    keys: [
      ['leads.view',   'See captured leads'],
      ['leads.edit',   'Work the pipeline: status, notes'],
      ['leads.export', 'Export the lead list'],
    ],
  },
  {
    module: 'Usage',
    keys: [['usage.view', 'See usage against plan limits']],
  },
  {
    module: 'Revenue',
    keys: [
      ['revenue.view',   'See subscriptions and invoices'],
      ['revenue.edit',   'Enter or correct a subscription or invoice'],
      ['revenue.export', 'Export revenue data'],
    ],
  },
  {
    module: 'Adoption',
    keys: [['adoption.view', 'See what an account uses and should be using']],
  },
  {
    module: 'Ops',
    keys: [
      ['ops.view',    'See connector and job health'],
      ['ops.run_job', 'Re-run a background job'],
      ['ops.reseed',  'Rebuild the demo accounts'],
    ],
  },
  {
    module: 'Staff',
    keys: [
      ['staff.view',        'See the staff roster'],
      ['staff.invite',      'Invite someone to the Desk'],
      ['staff.revoke',      'Suspend or remove a staff account'],
      ['staff.permissions', 'Change roles and permissions'],
      ['staff.activity',    'See what other people did'],
    ],
  },
] as const

export const DATASET_KEYS = [
  ['data.customer_email',   'Member and lead email addresses. Without it, addresses render masked.'],
  ['data.customer_phone',   'Phone numbers. Hashed values stay hashed regardless.'],
  ['data.customer_content', 'Survey responses, mentions, uploaded creative, AI output.'],
  ['data.ai_cost',          'What an account costs us to run.'],
  ['data.revenue_figures',  'Amounts on subscriptions and invoices.'],
  ['data.audit_all',        "Other people's activity, not only your own."],
] as const

export const ALL_PERMISSIONS: string[] = [
  ...PERMISSION_GROUPS.flatMap(g => g.keys.map(([key]) => key as string)),
  ...DATASET_KEYS.map(([key]) => key as string),
]

export type Permission = string

/** Roles seeded by migration. The Desk can add more; these cannot be deleted. */
export const SYSTEM_ROLES = ['support', 'bizdev', 'finance', 'engineer', 'admin', 'super_admin'] as const
export type SystemRole = typeof SYSTEM_ROLES[number]

export function permissionLabel(key: string): string {
  for (const group of PERMISSION_GROUPS) {
    for (const [k, label] of group.keys) if (k === key) return label as string
  }
  for (const [k, label] of DATASET_KEYS) if (k === key) return label as string
  return key
}
