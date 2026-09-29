# PRD set worklog

One entry per session that touches `docs/prd/`. Newest first. The point is that the next
session can see what the last one decided without reading five documents to find out.

---

## 14 September 2026: v6 to v8, five documents, status marks, first decisions register

**Mode:** revision, and a restructure.

**What was asked.** Bring the PRD set up to date with everything built, so the documents and
the product agree. Report on the state of the old set first.

**What was found.**

- **No readable v7 exists.** Two Google Docs were created in Drive on 14 September, one named
  `BrandPulse_AI_PRD_v7_Document_1_Foundations` and one named `# BrandPulse AI -- Master PRD
  v5`. Both are empty 1,024-byte shells; reading either returns nothing. The second one's
  title beginning with `# ` is the signature of a markdown paste where only the first line
  became the title. There is no v7 Document 2, 3 or 4 anywhere.
- **The newest complete set is v6, May 2026**, in the Drive folder "BrandPulse AI 2 Files":
  Part 1 Foundations v6.0, Part 2 Modules & Data v6.1, Part 3 Roadmap/Prompts/Risk v6.1,
  Document 4 Build Guide v6.0. All four were read in full and are the base for v8.
- The v6 set was never in git and lived one level above the repository root, so no cloud
  session could ever read it. Fixed by moving the set into `docs/prd/`.

**Decisions taken this session** (all four confirmed by Emmanuel before any writing):

1. Rebuild from v6, and reconcile against v7 later if it ever surfaces.
2. Name and version: **BrandGauge v8**.
3. Status marking: four states (Built / Inert / Deferred / Dropped) plus a decisions register,
   rather than a simple tick.
4. Structure: five documents, not four. The fifth carries the design system and the register.

**What was produced.** Five documents plus this log and a README index. Status marks were
derived by reading the repository (85 migrations, the route tree, the Inngest function list,
`ai/client.ts`, `bhi.ts`, `industry-config.ts`, `package.json`, and the environment variables
each connector reads), not from memory.

**Nineteen locked decisions recorded** for the first time, in Document 5 Part B, each with a
watch-for field. Three are currently violated by shipped code.

**Defects found while writing, all listed in Doc 3 section A.4.** Writing the spec against the
code is what surfaced these; none was known at the start of the session:

1. Two live WhatsApp send paths still use Africa's Talking, violating locked decision 3.
2. A hardcoded model ID in the vision branch of `api/ai/pre-post`, violating locked decision 7.
3. The priority feature parses AI output with `JSON.parse` on a fence-stripped string.
4. The pre and post route runs on the `chat` tier when it should be `cultural`.
5. `callAi` is text-only, which is the root cause of 2 and 3.
6. The pre and post system prompt contains a literal placeholder, "No live events loaded yet",
   so the highest-traffic AI surface scores cultural timing from the model's general knowledge
   rather than from `cultural_events`.
7. `is_workspace_member()` does not pin `search_path`, unlike its sibling `is_lead_desk()`.
8. `lucide-react` is a dependency imported nowhere, next to a rule forbidding icon libraries.
9. `CLAUDE.md` claims D3 is used (not installed), says 107 glyphs (there are 113), and points
   the tour definitions at the wrong path.

**Open questions raised, not answered.** Two vertical taxonomies exist (`brand_type` with 8
values, `IndustryId` with 12) and they overlap on only three entries, so telco, insurance and
healthcare currently score on FMCG weights. Doc 1 action 1 carries it.

**Withdrawn rather than updated.** The v6 per-phase cost ladder. Every figure in it was an
estimate presented as a number, and a cost table that looks precise and is not gets quoted in
a business case. Doc 3 section E says what replaces it.

**Not done.** The v6 set was not deleted or archived in Drive. Nothing was changed in the
application code; every defect above is recorded with an owner and a date, not fixed.
