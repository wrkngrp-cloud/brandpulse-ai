import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'brandgauge',
  eventKey: process.env.INNGEST_EVENT_KEY,
})
