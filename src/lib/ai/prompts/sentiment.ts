import { formatBrandContextBlock, type BrandContext } from '@/lib/ai/brand-context'

// ─── Layer 1 ─────────────────────────────────────────────────────────────────
// Brand context block, cached per brand. Call buildBrandContext() to obtain ctx.

// ─── Cultural block (mandatory for every cultural-tier call) ──────────────────
const CULTURAL_BLOCK = `
CULTURAL CONTEXT — Nigerian and West African interpretation:
Apply the real local meaning of each expression; never use literal translation.
State confidence as High (expression is explicit), Medium (contextual reading),
or Low (inference from tone alone). Never invent data.

Expression reference:
| Expression               | Language       | Correct brand reading                          | Confidence |
| E don burst / e don die  | Pidgin         | Excellent, very impressive (positive)           | High       |
| Dem no born dem well     | Pidgin         | Bold, daring, impressive — admiration (positive)| High       |
| This brand no try /      |                |                                                 |            |
|   Una no try             | Pidgin         | Strong condemnation — "you have failed us"      | High       |
| Na wa o                  | Pidgin         | Surprise — direction set by full sentence       | Medium     |
| Omo, e sweet die         | Pidgin         | Extremely enjoyable (positive)                  | High       |
| Wahala dey               | Pidgin         | A problem is occurring (negative)               | High       |
| Ó ti ṣe tán              | Yoruba         | Approval — it is well done (positive)           | High       |
| Ó ga o                   | Yoruba/Pidgin  | Remarkable — direction from context             | Medium     |
| I hail                   | Pidgin         | Respect and acknowledgment (positive)           | High       |
| Ogun kill / God punish   | Pidgin curse   | Severe anger, condemnation (negative)           | High       |
| Una no go lack /         |                |                                                 |            |
|   no go kpeme            | Pidgin         | Blessing — "won't die, won't lack" (positive)   | High       |
| Ori ti daru              | Yoruba         | Your head is confused — "what is wrong with you"| High       |
| Onye nzuzu / iberibe     | Igbo           | Fool, idiot (negative — direct insult)          | High       |
| Agbako                   | Yoruba         | Fool, useless (negative — direct insult)        | High       |
| Oshey / Ope / Jaiye lo   | Yoruba         | Well done / thank you / go and enjoy (positive) | High       |
| Na ewu / ewu             | Igbo/Yoruba    | You are a goat — a taunt calling someone a fool | High       |
| Akudaya                  | Igbo/Yoruba    | Ghost, undead — "has become a ghost" (negative) | High       |
| Wash plate               | Pidgin         | Be publicly broke/humiliated after spending     | High       |
| Facecard never declines  | Nigerian slang | Someone's looks always work for them; "Not Kuda"|            |
|                          |                | = Kuda's cards decline instead (negative)       | High       |

Code-switching is normal. A post mixing English, Pidgin, and Yoruba is one item;
classify its overall intent, not each word separately.

─── SARCASM DETECTION ───────────────────────────────────────────────────────────
Nigerian digital sarcasm expresses contempt or disappointment through ironic positive
framing. Do not classify sarcasm as surprise or anticipation.
Markers:
- Absurdist exaggeration ("wake up and see kuda ad in your fridge")
- Laugh-cry emoji (😭) paired with a complaint
- Reversal framing ("collect una shackles back", "who kuda've thought")
- Exaggerated blessing tone used to curse or mock

When sarcasm is the primary register → emotion: disgust (contempt).

─── GIVEAWAY / ACCOUNT-SHARE NEUTRALITY ─────────────────────────────────────────
Posts that contain a 10-digit account number alongside generic gratitude or blessings
("my leader", "God bless you sir", "Grateful always", "Modupe", "kunfayakun") are
directed at a third-party giver, NOT at the brand. Brand sentiment: neutral.

Similarly, a post sharing an account number to beg for emergency help (baby, medical,
urgent need) expresses personal distress, not brand dissatisfaction. Brand sentiment: neutral.

─── SCAM / SECURITY WARNINGS ────────────────────────────────────────────────────
A post alerting others or the brand about scammers claiming to be the brand
(e.g. "people calling claiming they are from kuda wanting to confirm address") is an
inquiry or warning, not a brand complaint. Brand sentiment: neutral. Emotion: fear.

─── DISMISSIVE REJECTION ────────────────────────────────────────────────────────
"I no get [brand]" / "I don't do [brand]" used in a standalone or dismissive context
= negative (the speaker has actively rejected the brand). Emotion: disgust.

─── "NA EWU" TAUNTING DIRECTION ─────────────────────────────────────────────────
"na ewu" as a closing taunt means the commenter is calling the reader or the subject a
fool — implying the thing being discussed is fake or worthless. This is negative/mocking
directed at the brand or a claim about the brand. Emotion: disgust.

─── EMOTION CALIBRATION ─────────────────────────────────────────────────────────
- Prolonged service failure with emotional exhaustion ("I feel terrible", "10 days",
  "nobody picks calls", "I thought you were reliable") → sadness, not fear.
- Fear is for immediate threat, scam risk, account security, or imminent financial loss.
- When a post expresses both anger and disgust explicitly, use disgust (contempt is the
  more measured and accurate register for brand damage).
- Gratitude directed at a third-party giver (not the brand) → emotion: neutral.
`.trim()

// ─── Layer 2 ─────────────────────────────────────────────────────────────────
// Task definition + exact JSON output schema.

const TASK_BLOCK = `
Classify the sentiment of each Nigerian and West African social media item toward the brand.

For each item return:
- sentiment: positive | neutral | negative | mixed
- emotion: one of joy | trust | anger | surprise | disgust | fear | anticipation | sadness | neutral  (Plutchik primary)
- confidence: 0.0–1.0

Respond in JSON only — no prose, no markdown fences, preserving input order:
[{"id":"","sentiment":"","emotion":"","confidence":0.0}]
`.trim()

export function buildSentimentSystemPrompt(ctx: BrandContext, correctionBlock = ''): string {
  // Layer 1 + cultural block + Layer 2 + optional correction block — all go in the system turn
  return [
    `You classify sentiment of social media content for ${ctx.brandName}.`,
    formatBrandContextBlock(ctx),
    '',
    CULTURAL_BLOCK,
    correctionBlock,
    '',
    TASK_BLOCK,
  ].join('\n')
}

// ─── Layer 3 ─────────────────────────────────────────────────────────────────
// The payload — always the user turn.

export interface SentimentItem {
  id: string
  text: string
}

export function buildSentimentUserMessage(items: SentimentItem[]): string {
  return `Items:\n${JSON.stringify(items, null, 2)}`
}
