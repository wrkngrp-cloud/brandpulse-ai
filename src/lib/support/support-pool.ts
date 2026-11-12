/**
 * The shared support addresses — support@ and hello@ — both routed into the
 * one Desk inbox. Anything else in `support_conversations.inbound_address`
 * is a personal mailbox (`staff_mailboxes`), which is a different kind of
 * conversation and must never surface in the shared queue. Shared between
 * the inbound webhook that assigns `inbound_address` and the Desk's own
 * data layer that reads it back, so the two can never drift apart.
 */
export const SUPPORT_POOL = ['support@brandgauge.app', 'hello@brandgauge.app']
