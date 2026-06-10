// Phase 0 validation — runs 48 Kuda comments through the B.2 sentiment prompt
// Gate: ≥85% correct (hand-grade the output). PRD Document 3, Phase 0.

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load .env.local
const envPath = join(dirname(fileURLToPath(import.meta.url)), '../.env.local')
const envVars = readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#'))
for (const line of envVars) {
  const [k, ...rest] = line.split('=')
  if (k && !process.env[k.trim()]) process.env[k.trim()] = rest.join('=').trim()
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Cultural block (mandatory) ───────────────────────────────────────────────
const CULTURAL_BLOCK = `
CULTURAL CONTEXT — Nigerian and West African interpretation:
Apply the real local meaning of each expression; never use literal translation.
State confidence as High (expression is explicit), Medium (contextual reading),
or Low (inference from tone alone). Never invent data.

Expression reference:
| Expression               | Language       | Correct brand reading                           |
| E don burst / e don die  | Pidgin         | Excellent, very impressive (positive)            |
| Dem no born dem well     | Pidgin         | Bold, daring, impressive — admiration (positive) |
| This brand no try /      |                |                                                  |
|   Una no try             | Pidgin         | Strong condemnation — "you have failed us"       |
| Na wa o                  | Pidgin         | Surprise — direction set by full sentence        |
| Omo, e sweet die         | Pidgin         | Extremely enjoyable (positive)                   |
| Wahala dey               | Pidgin         | A problem is occurring (negative)                |
| Ó ti ṣe tán              | Yoruba         | Approval — it is well done (positive)            |
| Ó ga o                   | Yoruba/Pidgin  | Remarkable — direction from context              |
| I hail                   | Pidgin         | Respect and acknowledgment (positive)            |
| Ogun kill / God punish   | Pidgin curse   | Severe anger, condemnation (negative)            |
| Una no go lack /         |                |                                                  |
|   no go kpeme            | Pidgin         | Blessing — "won't die, won't lack" (positive)    |
| Ori ti daru              | Yoruba         | Your head is confused — "what is wrong with you" |
| Onye nzuzu / iberibe     | Igbo           | Fool, idiot (negative — direct insult)           |
| Agbako                   | Yoruba         | Fool, useless (negative — direct insult)         |
| Oshey / Ope / Jaiye lo   | Yoruba         | Well done / thank you / go and enjoy (positive)  |
| Na ewu / ewu             | Igbo/Yoruba    | You are a goat — taunt calling someone a fool    |
| Akudaya                  | Igbo/Yoruba    | Ghost, undead — "has become a ghost" (negative)  |
| Wash plate               | Pidgin         | Be publicly broke/humiliated after spending      |
| Facecard never declines  | Nigerian slang | "Not [brand]" = brand's cards decline instead    |

Code-switching is normal. Classify overall intent, not word-by-word.

─── SARCASM DETECTION ──────────────────────────────────────────────────────────
Nigerian sarcasm uses ironic positive framing to express contempt or disappointment.
Do not classify sarcasm as surprise or anticipation.
Markers: absurdist exaggeration ("see kuda ad in your fridge"), 😭 with a complaint,
reversal framing ("collect una shackles back", "who kuda've thought"), exaggerated
blessings used to mock.
When sarcasm is the primary register → emotion: disgust (contempt).

─── GIVEAWAY / ACCOUNT-SHARE NEUTRALITY ────────────────────────────────────────
Posts with a 10-digit account number + generic gratitude ("my leader", "God bless you
sir", "Grateful always", "Modupe", "kunfayakun") are thanking a third-party giver, NOT
the brand. Brand sentiment: neutral.
Posts sharing an account number to beg for emergency help express personal distress,
not brand dissatisfaction. Brand sentiment: neutral.

─── SCAM / SECURITY WARNINGS ───────────────────────────────────────────────────
Posts alerting the brand about scammers claiming to be the brand are inquiries/warnings,
not brand complaints. Brand sentiment: neutral. Emotion: fear.

─── DISMISSIVE REJECTION ───────────────────────────────────────────────────────
"I no get [brand]" in a standalone or dismissive context = negative (active rejection).
Emotion: disgust.

─── "NA EWU" TAUNTING DIRECTION ────────────────────────────────────────────────
"na ewu" as a closing taunt = calling the subject foolish or fake. Negative. Emotion: disgust.

─── EMOTION CALIBRATION ────────────────────────────────────────────────────────
- Prolonged service failure + exhaustion ("I feel terrible", "10 days", "nobody picks
  calls") → sadness, not fear.
- Fear = immediate threat, scam risk, account security, imminent financial loss.
- When anger and disgust both appear explicitly → use disgust (contempt is more precise).
- Gratitude to a third-party giver (not the brand) → emotion: neutral.
`.trim()

// ── Layer 2: task + schema ───────────────────────────────────────────────────
const TASK_BLOCK = `
Classify the sentiment of each Nigerian/West African social media comment toward the brand.

For each item return:
- sentiment: positive | neutral | negative | mixed
- emotion: joy | trust | anger | surprise | disgust | fear | anticipation | sadness | neutral (Plutchik)
- confidence: 0.0–1.0

Respond in JSON only — no prose, no markdown fences, preserving input order:
[{"id":"","sentiment":"","emotion":"","confidence":0.0}]
`.trim()

const SYSTEM = [
  'You classify sentiment of Nigerian and West African social media content about fintech brands.',
  '',
  CULTURAL_BLOCK,
  '',
  TASK_BLOCK,
].join('\n')

// ── 48 test comments ─────────────────────────────────────────────────────────
const COMMENTS = [
  { id: '01', text: "Let's start from the worst first, Kuda can make you wash plate after eating at a restaurant" },
  { id: '02', text: "@Kuda I am highly disappointed with the delay in responding to my request. I have been trying to reset my transaction PIN since yesterday, and I was instructed to contact customer service. Unfortunately, despite reaching out, I have not received any response or assistance." },
  { id: '03', text: "Na Kuda… and that's the only fintech I am using. Aside commercial banks." },
  { id: '04', text: "My kuda don turn Akudaya😭" },
  { id: '05', text: "Haaaa! Omo" },
  { id: '06', text: "Kuda switched from \"Bank of the free\" to \"The Money App for Africans\". Dem say make una come collect una shackles back, na only Jesus dey give freedom. 😭" },
  { id: '07', text: "Yet again, kuda fucks me up. Maso i enter supermart yesterday, immediately i showed my kuda card, the babe just went \"ah! This card no dey work\"" },
  { id: '08', text: "Urgent 100k needed to handle an emergency for something important for a new born baby. 2086990729 Kuda. Treat as Urgent" },
  { id: '09', text: "Not trays of fan yogo at the Kuda end of year party" },
  { id: '10', text: "Opay and Moniepoint seem to have moved well past Kuda." },
  { id: '11', text: "Face card...not Kuda 💀" },
  { id: '12', text: "At this point you fit wake up one morning open your fridge see kuda advertisement." },
  { id: '13', text: "2005653201 Kuda. I will engage always Thank you so much my leader, God bless you" },
  { id: '14', text: "One day Kuda will make me wash plate." },
  { id: '15', text: "Renew my blue tick 2014668595 kuda Bank Thank you" },
  { id: '16', text: "What the f is going on with Kuda bank @joinkuda ???" },
  { id: '17', text: "God bless you sir 2002639679 Kuda Modupe Omolara" },
  { id: '18', text: "Open your kuda app now make you take screenshot na ewu" },
  { id: '19', text: "You can't take this screenshot in kuda it's fake" },
  { id: '20', text: "@joinkuda. please some peeps are calling claiming they are from kuda they want to confirm house address abeg oooo" },
  { id: '21', text: "Currently owing kuda 40k+ I pray God send help" },
  { id: '22', text: "I wan pay for blue tick now my Kuda card no work, any other way??" },
  { id: '23', text: "Olorun joor…which kain agbako be this Kuda like this?" },
  { id: '24', text: "Kuda bụ onye nzuzu , iberibe" },
  { id: '25', text: "U no go lack" },
  { id: '26', text: "Grateful always Kuda bank 1101194531" },
  { id: '27', text: "Una wey dey Kuda, una no go kpeme, una no go lack, like like Lola kunfayakun" },
  { id: '28', text: "Kuda has finally added bank charges.....who kuda've thought." },
  { id: '29', text: "I no get kuda" },
  { id: '30', text: "Pls reconsider the referral campaign requirements  no be for this kind economy Btw  I've been a consistent amb or marketer for your bank and I've been preaching kuda bank to my friends, colleagues and families. Would love to hear a feedback fix on the referral criteria" },
  { id: '31', text: "Omo. Shey ori yin ti daru ni? Everywhere just dey blur. Kuda wetin dey sup?" },
  { id: '32', text: "Omo ope! Oshey! Jaiye lo" },
  { id: '33', text: "As u are making me suffer ur company will suffer" },
  { id: '34', text: "Omor after this month, no more. I thought you guys were reliable. Please just reverse my money." },
  { id: '35', text: "God forbid for me to have kuda in my phone. They blocked  my account,  I tried logging in, but it's  not working.  I just deleted the app. I'll  never have it in my phone or encourage anyone around me to have it" },
  { id: '36', text: "Kuda. Una no try oo. I put money inside my account. I wan transfer am comot . Una dey ask for OTP. me don lose my SIM since. Una no try for verification matter. Na so una do one certain time wey una go send OTP to only SIM instead of e-mail. Abeg how I go take comot my funds." },
  { id: '37', text: "All the Kuda staff ogun kill all of you guys .. I chat you guys.  respond, I call no respond why nah." },
  { id: '38', text: "It's more than 10days now the money I sent  is on pending.. you people want me to loose my job or what . Nobody is picking your calls .i feel very terrible" },
  { id: '39', text: "Why una put people money for air?" },
  { id: '40', text: "@joinkuda una customer worst" },
  { id: '41', text: "Ogun kill your family's kuda. You will never know peace in your life." },
  { id: '42', text: "Kuda di you want me to respectfully call you out or you message me because what just happened now to my Kuda mobile account was just a total fraud" },
  { id: '43', text: "I don download this Bank App twice the sign up process stressful i vex delete the App una no serious at all. Without NIN you don't let new customers open account why?  Why To open mobile bank stressfull like this ?  No wonder una no popular" },
  { id: '44', text: "Na God Go punish Una Money oo let under refund Money way I see the alert then use am enter the all Ogoname go drown your papa" },
  { id: '45', text: "See costumer care service, Na 11 hours ago nai the one de active, smh Omo it been 24k house now Una still no wan return the money ???" },
  { id: '46', text: "Omoor. Kudaz I no Sabi Una to dey like this oo. I removed money from my spend and save, and it's just gone... It's not letting me transfer anything, just popping error messages" },
  { id: '47', text: "@joinkuda Wetin naaaa Reply me now I did not waste time when I was creating this account" },
  { id: '48', text: "Gwanintar da na yi da Kuda Microfinance Bank ta yi matukar burge ni. Suna responding a kan lokaci, kuma network dinsu yana da matukar speed.Sun sanya banking ya zama easy sosai!" },
]

async function run() {
  console.log(`Running Phase 0 validation — ${COMMENTS.length} comments via claude-haiku-4-5-20251001\n`)

  const userMsg = `Items:\n${JSON.stringify(COMMENTS, null, 2)}`

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  const block = resp.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')

  const cleaned = block.text.replace(/```json|```/g, '').trim()
  const results = JSON.parse(cleaned)

  // Pretty-print results with the original text for hand-grading
  const rows = results.map((r, i) => ({
    id: r.id,
    sentiment: r.sentiment,
    emotion: r.emotion,
    confidence: r.confidence.toFixed(2),
    text: COMMENTS[i].text.slice(0, 80),
  }))

  // Summary counts
  const counts = { positive: 0, neutral: 0, negative: 0, mixed: 0 }
  for (const r of results) counts[r.sentiment] = (counts[r.sentiment] ?? 0) + 1

  console.log('─'.repeat(120))
  console.log(
    'ID'.padEnd(4),
    'SENTIMENT'.padEnd(10),
    'EMOTION'.padEnd(14),
    'CONF'.padEnd(6),
    'TEXT'
  )
  console.log('─'.repeat(120))
  for (const r of rows) {
    console.log(
      r.id.padEnd(4),
      r.sentiment.padEnd(10),
      r.emotion.padEnd(14),
      r.confidence.padEnd(6),
      r.text
    )
  }
  console.log('─'.repeat(120))
  console.log('\nSentiment distribution:')
  for (const [k, v] of Object.entries(counts)) {
    const pct = ((v / results.length) * 100).toFixed(0)
    console.log(`  ${k.padEnd(10)} ${v} (${pct}%)`)
  }
  console.log(`\nTokens used — input: ${resp.usage.input_tokens}, output: ${resp.usage.output_tokens}`)
  console.log('\nHand-grade the SENTIMENT column against your own read. Gate = 85% correct.')
  console.log('\nFull JSON (for programmatic grading):')
  console.log(JSON.stringify(results, null, 2))
}

run().catch(err => { console.error(err); process.exit(1) })
