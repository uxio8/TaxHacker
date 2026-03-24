import { NextResponse } from "next/server.js"

type StripeWebhookEvent = {
  id: string
  type: string
  data: {
    object: {
      subscription?: string | { id: string } | null
      client_reference_id?: string | null
      metadata?: {
        organizationId?: string | null
      }
    }
  }
}

type StripeWebhookRouteDependencies = {
  webhookSecret?: string | null
  stripeClient?: {
    webhooks: {
      constructEvent: (body: string, signature: string, secret: string) => unknown
    }
    subscriptions: {
      retrieve: (subscriptionId: string) => Promise<unknown>
    }
  } | null
  recordBillingEvent?: (input: {
    organizationId: string
    provider: "stripe"
    eventType: string
    externalEventId: string
    payload: unknown
    processedAt: Date
  }) => Promise<void>
  syncOrganizationSubscriptionFromStripeSubscription?: (
    subscription: unknown,
    options?: {
      fallbackOrganizationId?: string | null
      stripeEventId?: string | null
      stripeEventCreatedAt?: Date | null
    }
  ) => Promise<{
    organizationId: string
  }>
  consoleError?: (message: string, error: unknown) => void
}

async function resolveDependencies(dependencies: StripeWebhookRouteDependencies = {}) {
  const [configModule, stripeModule, eventsModule, syncModule] = await Promise.all([
    dependencies.webhookSecret ? null : import("../../../../lib/config.ts"),
    dependencies.stripeClient ? null : import("../../../../lib/stripe.ts"),
    dependencies.recordBillingEvent ? null : import("../../../../models/billing/events.ts"),
    dependencies.syncOrganizationSubscriptionFromStripeSubscription
      ? null
      : import("../../../../models/billing/stripe-sync.ts"),
  ])

  return {
    webhookSecret: dependencies.webhookSecret ?? configModule!.default.stripe.webhookSecret,
    stripeClient: dependencies.stripeClient ?? stripeModule!.stripeClient,
    recordBillingEvent: dependencies.recordBillingEvent ?? eventsModule!.recordBillingEvent,
    syncOrganizationSubscriptionFromStripeSubscription:
      dependencies.syncOrganizationSubscriptionFromStripeSubscription ??
      (syncModule!.syncOrganizationSubscriptionFromStripeSubscription as Required<
        StripeWebhookRouteDependencies
      >["syncOrganizationSubscriptionFromStripeSubscription"]),
    consoleError: dependencies.consoleError ?? console.error,
  }
}

export function createStripeWebhookRoute(dependencies: StripeWebhookRouteDependencies = {}) {
  return async function POST(request: Request) {
    const deps = await resolveDependencies(dependencies)
    const signature = request.headers.get("stripe-signature")
    const body = await request.text()

    if (!signature || !deps.webhookSecret) {
      return new NextResponse("Webhook signature or secret missing", { status: 400 })
    }

    if (!deps.stripeClient) {
      return new NextResponse("Stripe client is not initialized", { status: 500 })
    }

    let event: StripeWebhookEvent

    try {
      event = deps.stripeClient.webhooks.constructEvent(body, signature, deps.webhookSecret) as StripeWebhookEvent
    } catch (error) {
      deps.consoleError("Webhook signature verification failed:", error)
      return new NextResponse("Webhook signature verification failed", { status: 400 })
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : null

          if (!subscriptionId) {
            return new NextResponse("Checkout session without subscription", { status: 400 })
          }

          const subscription = await deps.stripeClient.subscriptions.retrieve(subscriptionId)
          const contract = await deps.syncOrganizationSubscriptionFromStripeSubscription(subscription, {
            fallbackOrganizationId: session.metadata?.organizationId || session.client_reference_id || null,
            stripeEventId: event.id,
            stripeEventCreatedAt: "created" in event && typeof event.created === "number"
              ? new Date(event.created * 1000)
              : null,
          })
          await deps.recordBillingEvent({
            organizationId: contract.organizationId,
            provider: "stripe",
            eventType: event.type,
            externalEventId: event.id,
            payload: event,
            processedAt: new Date(),
          })
          break
        }

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object
          const contract = await deps.syncOrganizationSubscriptionFromStripeSubscription(subscription, {
            stripeEventId: event.id,
            stripeEventCreatedAt: "created" in event && typeof event.created === "number"
              ? new Date(event.created * 1000)
              : null,
          })
          await deps.recordBillingEvent({
            organizationId: contract.organizationId,
            provider: "stripe",
            eventType: event.type,
            externalEventId: event.id,
            payload: event,
            processedAt: new Date(),
          })
          break
        }

        default:
          return new NextResponse("No handler for event type", { status: 200 })
      }

      return new NextResponse("Webhook processed successfully", { status: 200 })
    } catch (error) {
      deps.consoleError("Error processing webhook:", error)
      return new NextResponse("Webhook processing failed", { status: 500 })
    }
  }
}
