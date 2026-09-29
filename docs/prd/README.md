# BrandGauge PRD set, v8

Five documents, one product. This is the spec. It supersedes the BrandPulse AI v6 set
(May 2026), which lived outside this repository and was therefore invisible to every cloud
session. That is why it now lives here.

| Read | Document | Answers |
|---|---|---|
| 1st | [`01-foundations.md`](01-foundations.md) | What are we building, for whom, on what architecture? Identity, vision, the verticals, personas, theory, the Unified Brand Funnel, the module map. |
| 2nd | [`02-modules-and-data.md`](02-modules-and-data.md) | What is in each module, what state is it in, what is the data model, and what are the data-access rules? |
| 3rd | [`03-roadmap-prompts-metrics-risk.md`](03-roadmap-prompts-metrics-risk.md) | Where is the build, what is next, what are the runtime prompts, every metric formula, the risk register, the exclusions log. |
| 4th | [`04-build-guide.md`](04-build-guide.md) | Stack and versions, every environment variable and what it gates, conventions, definition of done. |
| Always | [`05-design-system-and-decisions.md`](05-design-system-and-decisions.md) | What it looks like, and **the locked decisions register**. |

## Two things to do before touching anything

**1. Read the locked decisions register** in Document 5, Part B. Nineteen decisions, each with
a **watch for** field naming the way it typically gets reversed without anyone noticing. Three
of them are being violated by shipped code right now, and they are listed in Document 3
section A.4. The check is explicit, never assumed.

**2. Check the status mark** before promising anything works.

| Mark | Means |
|---|---|
| **Built** | The code exists and the flow has been driven. |
| **Inert** | The code is complete and a named credential is missing. The document names the variable. |
| **Deferred** | Specified, not built, and the wait was deliberate. |
| **Dropped** | Specified once, deliberately removed. Document 5 records the date and the reason. |

## Which document wins

Feature behaviour goes to Doc 2. Build order goes to Doc 3. Stack and tooling go to Doc 4.
Anything visual goes to Doc 5 and behind it to `brand/DESIGN-SYSTEM.md`. A decision already
made goes to Doc 5's register, which beats every other document. Market reality goes to
Emmanuel, which beats the register. And where the code and any document disagree, **the code
wins and the document is wrong.** Fix the document.

## Version history

| Version | Date | Name | Note |
|---|---|---|---|
| v5 | May 2026 | BrandPulse AI | A single master PRD plus parts. Archived. |
| v6 | May 2026 | BrandPulse AI | Four documents. The last version written as a plan rather than a record. Superseded. |
| v7 | September 2026 | BrandPulse AI | Never completed. Only an empty Document 1 shell exists. |
| **v8** | **14 September 2026** | **BrandGauge** | Five documents, written against the running codebase. Every item carries a build status. First version with a locked decisions register. |

Versions are recorded here and in each document's header table rather than in filenames, so
the paths stay stable and the history lives in git.
