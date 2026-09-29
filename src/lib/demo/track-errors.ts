/**
 * Error tracking for the demo seed routes.
 *
 * The seeds make several hundred inserts and almost all of them are written as
 * `const { data } = await sb.from(...).insert(...)`, which throws the error
 * away. A seed could therefore drop half its rows and still answer 200 with
 * "success", which is how the fintech and agency demos ended up shipping with
 * no event ambassadors and no interactions for months.
 *
 * `trackErrors` wraps the Supabase client so every failed insert or upsert is
 * recorded without changing a single call site. Report `errors` in the seed's
 * response and a silent failure becomes a visible one.
 */

type AnyClient = {
  from: (table: string) => unknown
}

export interface SeedError {
  table:   string
  op:      string
  message: string
  code?:   string
}

/** Methods that return another query builder and so need wrapping too. */
const CHAINABLE = new Set([
  'select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'gt', 'gte',
  'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'order', 'limit',
  'range', 'single', 'maybeSingle', 'match', 'filter', 'not', 'or',
])

export function trackErrors<T extends AnyClient>(client: T): { sb: T; errors: SeedError[] } {
  const errors: SeedError[] = []

  function wrapBuilder(builder: unknown, table: string, op: string): unknown {
    if (builder === null || typeof builder !== 'object') return builder

    return new Proxy(builder as object, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)

        // Awaiting the builder is where the result (and its error) appears.
        if (prop === 'then' && typeof value === 'function') {
          return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            (value as (...a: unknown[]) => unknown).call(
              target,
              (result: unknown) => {
                const r = result as { error?: { message?: string; code?: string } | null }
                if (r && r.error) {
                  errors.push({
                    table,
                    op,
                    message: r.error.message ?? 'unknown error',
                    ...(r.error.code ? { code: r.error.code } : {}),
                  })
                }
                return onFulfilled ? onFulfilled(result) : result
              },
              onRejected,
            )
        }

        if (typeof value === 'function' && typeof prop === 'string' && CHAINABLE.has(prop)) {
          return (...args: unknown[]) => {
            const next = (value as (...a: unknown[]) => unknown).apply(target, args)
            const nextOp = prop === 'insert' || prop === 'upsert' ? prop : op
            return wrapBuilder(next, table, nextOp)
          }
        }

        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
      },
    })
  }

  const sb = new Proxy(client as object, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (prop === 'from' && typeof value === 'function') {
        return (table: string) =>
          wrapBuilder((value as (t: string) => unknown).call(target, table), table, 'query')
      }
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  }) as T

  return { sb, errors }
}

/** Compact summary for the seed's JSON response. */
export function summariseErrors(errors: SeedError[]) {
  if (errors.length === 0) return { failedWrites: 0 }
  const byTable: Record<string, number> = {}
  for (const e of errors) byTable[`${e.table}.${e.op}`] = (byTable[`${e.table}.${e.op}`] ?? 0) + 1
  return {
    failedWrites: errors.length,
    byTable,
    // first few messages are usually enough to name the cause
    sample: errors.slice(0, 5).map(e => `${e.table}: ${e.message}`),
  }
}
