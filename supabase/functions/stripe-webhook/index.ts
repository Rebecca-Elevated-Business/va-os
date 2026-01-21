import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.15.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const mailerLiteApiKey = Deno.env.get("MAILERLITE_API_KEY");
const mailerLiteGroupId = Deno.env.get("MAILERLITE_GROUP_ID");
const mailerLiteStatus = Deno.env.get("MAILERLITE_STATUS") ?? "active";

if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing required environment variables.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertSubscription(input: {
  email: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string | null;
  currentPeriodEnd: number | null;
}) {
  const { error } = await supabaseAdmin.from("customer_subscriptions").upsert(
    {
      email: input.email,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      status: input.status,
      current_period_end: input.currentPeriodEnd
        ? new Date(input.currentPeriodEnd * 1000).toISOString()
        : null,
    },
    { onConflict: "email" },
  );

  if (error) {
    console.error("Upsert failed", error);
  }
}

async function ensureUserInvite(email: string) {
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
  if (error && !error.message.toLowerCase().includes("already registered")) {
    console.error("Invite failed", error);
  }
}

async function addToMailerLite(email: string) {
  if (!mailerLiteApiKey || !mailerLiteGroupId) {
    return;
  }

  const payload = {
    email,
    status: mailerLiteStatus,
    groups: [mailerLiteGroupId],
  };

  const res = await fetch("https://api.mailerlite.com/api/v2/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MailerLite-ApiKey": mailerLiteApiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("MailerLite add subscriber failed", res.status, errorText);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email || session.customer_email;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

        if (email) {
          await upsertSubscription({
            email,
            stripeCustomerId: customerId,
            stripeSubscriptionId: typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id ?? null,
            status: "active",
            currentPeriodEnd: null,
          });
          await ensureUserInvite(email);
          await addToMailerLite(email);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

        const customer = await stripe.customers.retrieve(customerId);
        const email =
          typeof customer !== "string" && customer.email ? customer.email : null;

        if (email) {
          await upsertSubscription({
            email,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end ?? null,
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler error", err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
