import Stripe from 'stripe'

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' })
  : null

// Stripe Price IDs (set in env: STRIPE_PRICE_GROWTH, STRIPE_PRICE_PRO, STRIPE_PRICE_AGENCY)
export const STRIPE_PRICES: Record<string, string | undefined> = {
  growth:    process.env.STRIPE_PRICE_GROWTH,
  pro:       process.env.STRIPE_PRICE_PRO,
  agency:    process.env.STRIPE_PRICE_AGENCY,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
}

export const PLAN_DISPLAY: Record<string, { name: string; priceNGN: number; highlight: string }> = {
  starter:    { name: 'Starter',    priceNGN: 0,       highlight: '1 brand · 3 users · 500 survey responses/mo' },
  growth:     { name: 'Growth',     priceNGN: 299000,  highlight: '3 brands · 10 users · 2,500 responses/mo · 3 portal links' },
  pro:        { name: 'Pro',        priceNGN: 699000,  highlight: '5 brands · 25 users · 10k responses/mo · 10 portal links' },
  agency:     { name: 'Agency',     priceNGN: 1999000, highlight: '20 brands · 100 users · 50k responses/mo · white-label' },
  enterprise: { name: 'Enterprise', priceNGN: 0,       highlight: 'Unlimited · Custom SLA · Dedicated support' },
}
