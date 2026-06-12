import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'brandpulse-ai',
  eventKey: process.env.INNGEST_EVENT_KEY,
})
