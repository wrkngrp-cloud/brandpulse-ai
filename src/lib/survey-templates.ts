export type SurveyType =
  | 'b2_intercept'
  | 'quick_pulse'
  | 'awareness_check'
  | 'post_event'
  | 'perception_audit'
  | 'post_purchase_nps'

export interface SurveyQuestion {
  id:       string
  type:     'single_choice' | 'nps' | 'rating' | 'text'
  text:     string          // {brand} is replaced at render time
  required: boolean
  options?: string[]        // for single_choice
  scale?:   { min: number; max: number; minLabel: string; maxLabel: string }  // for rating
}

export interface SurveyTemplateDefinition {
  id:            SurveyType
  label:         string
  tagline:       string
  questionCount: number
  timeEstimate:  string
  iconName:      string    // lucide icon name
  questions:     SurveyQuestion[]
}

export const SURVEY_TEMPLATES: SurveyTemplateDefinition[] = [
  // ── B2 Awareness Intercept (existing, kept for compatibility)
  {
    id:            'b2_intercept',
    label:         'Awareness Intercept',
    tagline:       'Quick 2-question check on how people discovered your brand and their NPS.',
    questionCount: 2,
    timeEstimate:  '15 sec',
    iconName:      'Zap',
    questions: [
      {
        id:       'q1',
        type:     'single_choice',
        text:     'How did you first hear about {brand}?',
        required: true,
        options:  [
          'Social media (Instagram, X or TikTok)',
          'Friend or family',
          'Online search',
          'TV, radio or billboard',
          'Event or activation',
          'Other',
        ],
      },
      {
        id:       'q2',
        type:     'nps',
        text:     'How likely are you to recommend {brand} to a friend or colleague?',
        required: true,
      },
    ],
  },

  // ── S1 Quick Pulse
  {
    id:            'quick_pulse',
    label:         'Quick Pulse',
    tagline:       'Three fast questions on recent recall, brand association, and purchase intent.',
    questionCount: 3,
    timeEstimate:  '45 sec',
    iconName:      'Activity',
    questions: [
      {
        id:       'q1',
        type:     'single_choice',
        text:     'Have you seen or heard any {brand} advertising or promotions recently?',
        required: true,
        options:  ['Yes — I remember it clearly', 'Yes — vaguely', 'No', 'Not sure'],
      },
      {
        id:       'q2',
        type:     'single_choice',
        text:     'What is the first word or phrase that comes to mind when you think of {brand}?',
        required: true,
        options:  [
          'Quality and reliability',
          'Good value for money',
          'Trustworthy',
          'A brand that understands Nigerians',
          'Modern and innovative',
          'Nothing specific yet',
        ],
      },
      {
        id:       'q3',
        type:     'single_choice',
        text:     'How likely are you to buy from {brand} in the next 30 days?',
        required: true,
        options:  ['Very likely', 'Likely', 'Not sure', 'Unlikely', 'Very unlikely'],
      },
    ],
  },

  // ── Awareness Check (5Q)
  {
    id:            'awareness_check',
    label:         'Awareness Check',
    tagline:       'Five questions that map unaided recall, awareness source, clarity, and NPS.',
    questionCount: 5,
    timeEstimate:  '90 sec',
    iconName:      'Globe',
    questions: [
      {
        id:       'q1',
        type:     'single_choice',
        text:     'Before today, had you heard of {brand}?',
        required: true,
        options:  ['Yes — I know them well', 'Yes — I have heard of them', 'No, this is the first I am hearing of them'],
      },
      {
        id:       'q2',
        type:     'single_choice',
        text:     'Where did you first come across {brand}?',
        required: true,
        options:  [
          'Social media',
          'A friend or family member',
          'TV or radio',
          'Billboard or print ad',
          'Online search',
          'Event or activation',
          'I cannot remember',
        ],
      },
      {
        id:       'q3',
        type:     'single_choice',
        text:     'Which of these best describes what {brand} does?',
        required: true,
        options:  [
          'I know exactly what they do',
          'I have a general idea',
          'I am not quite sure',
          'I have no idea',
        ],
      },
      {
        id:       'q4',
        type:     'rating',
        text:     'How would you rate your overall impression of {brand} right now?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Very poor', maxLabel: 'Excellent' },
      },
      {
        id:       'q5',
        type:     'nps',
        text:     'How likely are you to recommend {brand} to a friend or colleague?',
        required: true,
      },
    ],
  },

  // ── Post-Event (8Q)
  {
    id:            'post_event',
    label:         'Post-Event',
    tagline:       'Eight questions capturing event experience, brand perception shift, and advocacy.',
    questionCount: 8,
    timeEstimate:  '2 min',
    iconName:      'CalendarDays',
    questions: [
      {
        id:       'q1',
        type:     'single_choice',
        text:     'How did you hear about this event?',
        required: true,
        options:  ['Social media', 'Friend or family', 'SMS or WhatsApp message', 'Poster or flyer', 'I was invited by a staff member', 'Other'],
      },
      {
        id:       'q2',
        type:     'single_choice',
        text:     'What was the main reason you attended today?',
        required: true,
        options:  ['To learn more about {brand}', 'Free gifts or offers', 'Entertainment', 'I was brought by someone', 'Other'],
      },
      {
        id:       'q3',
        type:     'rating',
        text:     'How would you rate the overall event experience?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Very poor', maxLabel: 'Excellent' },
      },
      {
        id:       'q4',
        type:     'text',
        text:     'What part of the event stood out most for you?',
        required: false,
      },
      {
        id:       'q5',
        type:     'single_choice',
        text:     'Did attending this event change how you feel about {brand}?',
        required: true,
        options:  [
          'Yes — I feel more positive about them',
          'Yes — I feel less positive about them',
          'No change in how I feel',
          'I was not aware of {brand} before today',
        ],
      },
      {
        id:       'q6',
        type:     'rating',
        text:     'How likely are you to attend another {brand} event?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Very unlikely', maxLabel: 'Very likely' },
      },
      {
        id:       'q7',
        type:     'single_choice',
        text:     'Would you tell a friend about {brand} after this event?',
        required: true,
        options:  ['Yes, definitely', 'Probably', 'Not sure', 'No'],
      },
      {
        id:       'q8',
        type:     'nps',
        text:     'How likely are you to recommend {brand} to a friend or colleague?',
        required: true,
      },
    ],
  },

  // ── Brand Perception Audit (12Q)
  {
    id:            'perception_audit',
    label:         'Perception Audit',
    tagline:       'Twelve questions scoring your brand across eight perception dimensions.',
    questionCount: 12,
    timeEstimate:  '3 min',
    iconName:      'BarChart2',
    questions: [
      {
        id:       'q1',
        type:     'rating',
        text:     'How familiar are you with {brand}?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Not at all familiar', maxLabel: 'Very familiar' },
      },
      {
        id:       'q2',
        type:     'rating',
        text:     'How would you rate the quality of {brand}\'s products or services?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Very poor', maxLabel: 'Excellent' },
      },
      {
        id:       'q3',
        type:     'rating',
        text:     'How trustworthy do you find {brand}?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Extremely' },
      },
      {
        id:       'q4',
        type:     'rating',
        text:     'How innovative do you think {brand} is compared to alternatives?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Not innovative', maxLabel: 'Very innovative' },
      },
      {
        id:       'q5',
        type:     'rating',
        text:     'Does {brand} offer good value for money?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Poor value', maxLabel: 'Excellent value' },
      },
      {
        id:       'q6',
        type:     'rating',
        text:     'How culturally relevant is {brand} to you and your community?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Not relevant', maxLabel: 'Very relevant' },
      },
      {
        id:       'q7',
        type:     'rating',
        text:     'How easy is it to access {brand} — to buy from, find in stores, or reach their team?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Very difficult', maxLabel: 'Very easy' },
      },
      {
        id:       'q8',
        type:     'rating',
        text:     'How reliably does {brand} deliver what they promise?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Never', maxLabel: 'Always' },
      },
      {
        id:       'q9',
        type:     'rating',
        text:     'How emotionally connected do you feel to {brand}?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'No connection', maxLabel: 'Very connected' },
      },
      {
        id:       'q10',
        type:     'single_choice',
        text:     'Compared to alternatives in the market, {brand} is:',
        required: true,
        options:  ['Much better', 'Somewhat better', 'About the same', 'Somewhat worse', 'Much worse'],
      },
      {
        id:       'q11',
        type:     'single_choice',
        text:     'Which word best describes {brand} to you?',
        required: true,
        options:  ['Trusted', 'Premium', 'Affordable', 'Modern', 'Traditional', 'Local', 'Global', 'Other'],
      },
      {
        id:       'q12',
        type:     'nps',
        text:     'How likely are you to recommend {brand} to a friend or colleague?',
        required: true,
      },
    ],
  },

  // ── Post-Purchase NPS (5Q)
  {
    id:            'post_purchase_nps',
    label:         'Post-Purchase NPS',
    tagline:       'Five questions tying purchase satisfaction to advocacy intent.',
    questionCount: 5,
    timeEstimate:  '60 sec',
    iconName:      'ShoppingBag',
    questions: [
      {
        id:       'q1',
        type:     'single_choice',
        text:     'How did you hear about {brand} before making this purchase?',
        required: true,
        options:  ['Social media', 'Recommended by someone', 'Searched online', 'Saw an ad', 'Already knew the brand', 'Other'],
      },
      {
        id:       'q2',
        type:     'rating',
        text:     'How satisfied are you with your recent purchase from {brand}?',
        required: true,
        scale:    { min: 1, max: 5, minLabel: 'Very unsatisfied', maxLabel: 'Very satisfied' },
      },
      {
        id:       'q3',
        type:     'single_choice',
        text:     'Did the product or service match what you expected?',
        required: true,
        options:  ['Yes — it exceeded my expectations', 'Yes — it met my expectations', 'Mostly, with a few issues', 'No — it fell short'],
      },
      {
        id:       'q4',
        type:     'single_choice',
        text:     'Would you buy from {brand} again?',
        required: true,
        options:  ['Definitely', 'Probably', 'Not sure', 'No'],
      },
      {
        id:       'q5',
        type:     'nps',
        text:     'How likely are you to recommend {brand} to a friend or colleague?',
        required: true,
      },
    ],
  },
]

export const TEMPLATE_MAP = Object.fromEntries(
  SURVEY_TEMPLATES.map(t => [t.id, t])
) as Record<SurveyType, SurveyTemplateDefinition>

export function getTemplateLabel(type: string): string {
  const known = TEMPLATE_MAP[type as SurveyType]?.label
  if (known) return known
  // Humanise unknown types (e.g. legacy 'brand_recall' → 'Brand Recall', 'nps' → 'NPS')
  return type
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, c => c.toUpperCase())
    .replace(/\bNps\b/g, 'NPS')
}
