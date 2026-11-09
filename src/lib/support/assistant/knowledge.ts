import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * The build pack, split into what the assistant is told and what it knows.
 *
 * docs/support-assistant/build-pack.md is the source, exported from the Claude
 * Docs build pack and kept in git so a cloud session and a reviewer can read
 * it. Sections 1, 11 and 12 are the instructions and macros; sections 2 to 10
 * are the knowledge; section 13 is the build prompt and is never loaded.
 *
 * Read from disk at runtime and cached per instance. next.config.ts adds the
 * file to the /api/inngest trace so it ships with the function.
 */

const FILE = path.join(process.cwd(), 'docs', 'support-assistant', 'build-pack.md')

export interface BuildPack {
  instructions: string
  knowledge: string
  /** Macro id → reply text, from section 12. */
  macros: Record<string, string>
}

let cached: BuildPack | null = null

export function splitSections(markdown: string): Map<number, string> {
  const out = new Map<number, string>()
  const re = /^## (\d+)\. .*$/gm
  const marks: { n: number; at: number }[] = []
  for (const m of markdown.matchAll(re)) marks.push({ n: Number(m[1]), at: m.index ?? 0 })
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].at : markdown.length
    out.set(mark.n, markdown.slice(mark.at, end).trim())
  })
  return out
}

export function parseMacros(section12: string): Record<string, string> {
  const macros: Record<string, string> = {}
  for (const line of section12.split('\n')) {
    const cells = line.split('|').map(c => c.trim())
    // | ID | When | Reply | Action |
    if (cells.length >= 5 && /^[A-Z]{3}-\d{2}$/.test(cells[1])) macros[cells[1]] = cells[3]
  }
  return macros
}

export function buildPackFrom(markdown: string): BuildPack {
  const sections = splitSections(markdown)
  const pick = (ns: number[]) => ns.map(n => sections.get(n)).filter(Boolean).join('\n\n')
  const pack: BuildPack = {
    instructions: pick([1, 11, 12]),
    knowledge:    pick([2, 3, 4, 5, 6, 7, 8, 9, 10]),
    macros:       parseMacros(sections.get(12) ?? ''),
  }
  if (!pack.instructions || !pack.knowledge || !pack.macros['HND-01'] || !pack.macros['HUM-01']) {
    throw new Error('Support build pack is missing sections 1, 2 to 10, 11 or 12')
  }
  return pack
}

export function loadBuildPack(): BuildPack {
  if (cached) return cached
  cached = buildPackFrom(readFileSync(FILE, 'utf8'))
  return cached
}
