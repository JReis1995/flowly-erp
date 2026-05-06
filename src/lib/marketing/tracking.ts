'use client'

export type MarketingEventName =
  | 'landing_view'
  | 'cta_click_primary'
  | 'lead_form_start'
  | 'lead_form_submit_success'
  | 'lead_form_submit_error'

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

export function trackMarketingEvent(eventName: MarketingEventName, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return

  const eventPayload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(eventPayload)
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[marketing-event]', eventPayload)
  }
}

