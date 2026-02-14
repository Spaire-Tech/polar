export interface Integration {
  slug: string
  name: string
  tagline: string
  description: string
  category: 'ai-builder' | 'backend' | 'framework'
  categoryLabel: string
  howItWorks: { title: string; description: string }[]
  prompt: string
  promptFileName: string
  footerNote: string
}

export const LOVABLE_INTEGRATION: Integration = {
  slug: 'lovable',
  name: 'Lovable',
  tagline: 'Build with Lovable. Monetize with Spaire.',
  description:
    'Spaire partners with Lovable to bring billing directly into your app. Just copy the prompt below, paste it into Lovable, and you\u2019ll have a fully working checkout page.',
  category: 'ai-builder',
  categoryLabel: 'AI App Builder',
  howItWorks: [
    { title: 'Copy prompt', description: 'Grab the ready-made prompt below' },
    {
      title: 'Paste in Lovable',
      description: 'Lovable builds your pricing page',
    },
    {
      title: 'Add checkout links',
      description: 'Drop in your Spaire URLs after creating products',
    },
  ],
  prompt: `Add Spaire payment checkout to my app. Spaire is my billing provider — it handles payments through a hosted checkout overlay. No API keys or environment variables needed in the frontend.

Here's how it works:
- Spaire uses checkout links (simple URLs) that open a secure payment overlay on top of your app
- No backend code, no API keys, no .env variables — just a script tag and links

Please do the following:

1. Add this script tag to index.html, right before the closing </body> tag:

<script defer data-auto-init src="https://cdn.spairehq.com/checkout/embed.js"></script>

2. Create a /pricing page with a clean layout showing plan cards. For each plan's call-to-action button, use an anchor tag like this:

<a href="CHECKOUT_LINK_URL" data-spaire-checkout data-spaire-checkout-theme="light">
  Get Started
</a>

Use "CHECKOUT_LINK_URL" as a placeholder — I'll replace it with my actual checkout link from the Spaire dashboard after I create my products there.

3. When a user clicks the button, Spaire's checkout overlay will open automatically (handled by the script). No onClick handler needed.

4. Create a /checkout/success page that displays a confirmation message after a successful purchase.

5. Style the pricing page and success page to match the rest of the app's design.`,
  promptFileName: 'lovable-prompt.txt',
  footerNote:
    'After creating your product in the Spaire dashboard, you\u2019ll get a checkout link URL to replace the CHECKOUT_LINK_URL placeholder above.',
}

export const SUPABASE_INTEGRATION: Integration = {
  slug: 'supabase',
  name: 'Supabase',
  tagline: 'Build with Supabase. Monetize with Spaire.',
  description:
    'Add billing to any Supabase-powered app. Copy this prompt into your AI builder — it sets up Spaire checkout with a Supabase Edge Function for webhook handling and a table to track subscriptions.',
  category: 'backend',
  categoryLabel: 'Backend Platform',
  howItWorks: [
    { title: 'Copy prompt', description: 'Grab the ready-made prompt below' },
    {
      title: 'Paste in your AI builder',
      description: 'It builds checkout + webhook handler',
    },
    {
      title: 'Add checkout links',
      description: 'Drop in your Spaire URLs after creating products',
    },
  ],
  prompt: `Add Spaire payment checkout to my app with Supabase as the backend. Spaire is my billing provider — it handles payments through a hosted checkout overlay. Supabase stores subscription data and handles webhooks.

Here's how it works:
- Spaire uses checkout links (simple URLs) that open a secure payment overlay
- A Supabase Edge Function receives webhook events when a purchase completes
- Subscription status is stored in your Supabase database

Please do the following:

1. Add this script tag to index.html, right before the closing </body> tag:

<script defer data-auto-init src="https://cdn.spairehq.com/checkout/embed.js"></script>

2. Create a Supabase table for storing subscription data. Run this in the SQL editor:

CREATE TABLE customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  spaire_customer_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  product_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON customer_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

3. Create a /pricing page with plan cards. For each plan's call-to-action button:

<a href="CHECKOUT_LINK_URL" data-spaire-checkout data-spaire-checkout-theme="light">
  Get Started
</a>

Use "CHECKOUT_LINK_URL" as a placeholder — I'll replace it with my actual checkout link from the Spaire dashboard.

4. Create a Supabase Edge Function to handle Spaire webhooks at supabase/functions/spaire-webhook/index.ts:

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const payload = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (payload.type === "checkout.completed") {
    await supabase.from("customer_subscriptions").upsert({
      user_id: payload.data.metadata?.user_id,
      spaire_customer_id: payload.data.customer_id,
      subscription_status: "active",
      product_name: payload.data.product?.name,
      updated_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

5. Create a /checkout/success page that confirms the purchase and shows the user's new subscription status by querying the customer_subscriptions table.

6. Add a helper to check subscription status anywhere in the app:

const { data } = await supabase
  .from("customer_subscriptions")
  .select("subscription_status")
  .eq("user_id", user.id)
  .single();

const isActive = data?.subscription_status === "active";

7. Style everything to match the rest of the app's design.`,
  promptFileName: 'supabase-spaire-prompt.txt',
  footerNote:
    'After creating your product in the Spaire dashboard, you\u2019ll get a checkout link URL to replace the CHECKOUT_LINK_URL placeholder. Set the webhook URL in Spaire to your Supabase Edge Function URL.',
}

export const V0_INTEGRATION: Integration = {
  slug: 'v0',
  name: 'v0',
  tagline: 'Build with v0. Monetize with Spaire.',
  description:
    'Spaire works natively with v0-generated Next.js apps. Copy this prompt into v0 to generate a complete pricing page with Spaire\u2019s checkout overlay — no backend setup required.',
  category: 'ai-builder',
  categoryLabel: 'AI App Builder',
  howItWorks: [
    { title: 'Copy prompt', description: 'Grab the ready-made prompt below' },
    {
      title: 'Paste in v0',
      description: 'v0 generates your pricing page',
    },
    {
      title: 'Add checkout links',
      description: 'Drop in your Spaire URLs after creating products',
    },
  ],
  prompt: `Add Spaire payment checkout to my Next.js app. Spaire is my billing provider — it handles payments through a hosted checkout overlay. No API keys or environment variables needed in the frontend.

Here's how it works:
- Spaire uses checkout links (simple URLs) that open a secure payment overlay on top of your app
- No backend code, no API keys, no .env variables — just a Script tag and links
- Works natively with Next.js

Please do the following:

1. Add the Spaire checkout embed script in the root layout (app/layout.tsx), right before the closing </body> tag:

import Script from "next/script";

<Script
  defer
  data-auto-init
  src="https://cdn.spairehq.com/checkout/embed.js"
  strategy="afterInteractive"
/>

2. Create a /pricing page with a modern pricing card layout using Tailwind CSS and shadcn/ui. For each plan's call-to-action button, use an anchor tag:

<a
  href="CHECKOUT_LINK_URL"
  data-spaire-checkout
  data-spaire-checkout-theme="light"
  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
>
  Get Started
</a>

Use "CHECKOUT_LINK_URL" as a placeholder — I'll replace it with my actual checkout link from the Spaire dashboard after I create my products there.

3. When a user clicks the button, Spaire's checkout overlay opens automatically (handled by the script). No onClick handler needed.

4. Create a /checkout/success page that displays a clean confirmation message after a successful purchase, with a button to return to the dashboard.

5. Style the pricing page with:
   - A header section with a title and subtitle
   - 2-3 pricing cards in a responsive grid
   - Each card showing the plan name, price, feature list, and CTA button
   - A "Most Popular" badge on the recommended plan
   - Light/dark mode support using Tailwind's dark: variants`,
  promptFileName: 'v0-spaire-prompt.txt',
  footerNote:
    'After creating your product in the Spaire dashboard, you\u2019ll get a checkout link URL to replace the CHECKOUT_LINK_URL placeholder above.',
}

export const ALL_INTEGRATIONS = [
  LOVABLE_INTEGRATION,
  SUPABASE_INTEGRATION,
  V0_INTEGRATION,
]

export const getIntegrationBySlug = (
  slug: string,
): Integration | undefined => {
  return ALL_INTEGRATIONS.find((i) => i.slug === slug)
}
