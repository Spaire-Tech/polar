export interface BaseIntegration {
  slug: string
  name: string
  tagline: string
  description: string
  category: 'ai-builder' | 'backend' | 'framework' | 'auth'
  categoryLabel: string
  howItWorks: { title: string; description: string }[]
}

export interface PromptIntegration extends BaseIntegration {
  type: 'prompt'
  prompt: string
  promptFileName: string
  footerNote: string
}

export interface SdkIntegration extends BaseIntegration {
  type: 'sdk'
  packages: string
  pythonInstall?: string
  docsLink: string
  code: string
  codeLang: 'typescript' | 'python' | 'bash'
  envVars: string
}

export type Integration = PromptIntegration | SdkIntegration

export const NEXTJS_INTEGRATION: SdkIntegration = {
  type: 'sdk',
  slug: 'nextjs',
  name: 'Next.js',
  tagline: 'Build with Next.js. Monetize with Spaire.',
  description:
    'The official @spaire/nextjs adapter gives you checkout, customer portal, and webhooks out of the box \u2014 the full billing loop in a single package.',
  category: 'framework',
  categoryLabel: 'Framework',
  howItWorks: [
    {
      title: 'Install adapter',
      description: 'Add @spaire/nextjs to your project',
    },
    {
      title: 'Add route handler',
      description: 'One-line checkout API route',
    },
    {
      title: 'Go live',
      description: 'Checkout, portal, and webhooks ready',
    },
  ],
  packages: '@spaire/nextjs',
  docsLink: 'https://docs.spairehq.com/integrate/sdk/adapters/nextjs',
  codeLang: 'typescript',
  envVars: `SPAIRE_ACCESS_TOKEN=your_access_token
SPAIRE_SUCCESS_URL=https://example.com/success?checkout_id={CHECKOUT_ID}`,
  code: `import { Checkout } from "@spaire/nextjs";

// app/api/checkout/route.ts
export const GET = Checkout({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN,
  successUrl: process.env.SPAIRE_SUCCESS_URL,
});`,
}

export const LOVABLE_INTEGRATION: PromptIntegration = {
  type: 'prompt',
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

export const SUPABASE_INTEGRATION: SdkIntegration = {
  type: 'sdk',
  slug: 'supabase',
  name: 'Supabase',
  tagline: 'Build with Supabase. Monetize with Spaire.',
  description:
    'Use the Spaire SDK inside Supabase Edge Functions to create checkouts, handle webhooks, and manage subscriptions \u2014 all serverless.',
  category: 'backend',
  categoryLabel: 'Backend Platform',
  howItWorks: [
    {
      title: 'Install SDK',
      description: 'Add @spaire/sdk to your Supabase project',
    },
    {
      title: 'Create Edge Function',
      description: 'Handle checkouts and webhooks serverless',
    },
    {
      title: 'Go live',
      description: 'Deploy and start accepting payments',
    },
  ],
  packages: '@spaire/sdk',
  docsLink: 'https://docs.spairehq.com/integrate/sdk/adapters/supabase',
  codeLang: 'typescript',
  envVars: `SPAIRE_ACCESS_TOKEN=your_access_token
SPAIRE_SUCCESS_URL=https://example.com/success?checkout_id={CHECKOUT_ID}`,
  code: `import { Spaire } from "@spaire/sdk";

const spaire = new Spaire({
  accessToken: Deno.env.get("SPAIRE_ACCESS_TOKEN")!,
});

Deno.serve(async (req) => {
  const { productId } = await req.json();

  const checkout = await spaire.checkouts.create({
    products: [productId],
    successUrl: Deno.env.get("SPAIRE_SUCCESS_URL")!,
  });

  return new Response(
    JSON.stringify({ url: checkout.url }),
    { headers: { "Content-Type": "application/json" } }
  );
});`,
}

export const V0_INTEGRATION: PromptIntegration = {
  type: 'prompt',
  slug: 'v0',
  name: 'v0',
  tagline: 'Build with v0. Monetize with Spaire.',
  description:
    'Spaire works natively with v0-generated Next.js apps. Copy this prompt into v0 to generate a complete pricing page with Spaire\u2019s checkout overlay \u2014 no backend setup required.',
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
  prompt: `Add Spaire payment checkout to my Next.js app. Spaire is my billing provider \u2014 it handles payments through a hosted checkout overlay. No API keys or environment variables needed in the frontend.

Here's how it works:
- Spaire uses checkout links (simple URLs) that open a secure payment overlay on top of your app
- No backend code, no API keys, no .env variables \u2014 just a Script tag and links
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

Use "CHECKOUT_LINK_URL" as a placeholder \u2014 I'll replace it with my actual checkout link from the Spaire dashboard after I create my products there.

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

export const REPLIT_INTEGRATION: PromptIntegration = {
  type: 'prompt',
  slug: 'replit',
  name: 'Replit',
  tagline: 'Build with Replit. Monetize with Spaire.',
  description:
    'Add billing to any Replit app in seconds. Copy this prompt, paste it into Replit Agent, and it builds a complete checkout flow with Spaire\u2019s payment overlay.',
  category: 'ai-builder',
  categoryLabel: 'AI App Builder',
  howItWorks: [
    { title: 'Copy prompt', description: 'Grab the ready-made prompt below' },
    {
      title: 'Paste in Replit Agent',
      description: 'The Agent builds your pricing page',
    },
    {
      title: 'Add checkout links',
      description: 'Drop in your Spaire URLs after creating products',
    },
  ],
  prompt: `Add Spaire payment checkout to my app. Spaire is my billing provider \u2014 it handles payments through a hosted checkout overlay. No API keys or environment variables needed in the frontend.

Here's how it works:
- Spaire uses checkout links (simple URLs) that open a secure payment overlay on top of your app
- No backend code, no API keys, no .env variables \u2014 just a script tag and links

Please do the following:

1. Add this script tag to the main HTML file (index.html or equivalent), right before the closing </body> tag:

<script defer data-auto-init src="https://cdn.spairehq.com/checkout/embed.js"></script>

2. Create a /pricing page with a clean layout showing plan cards. For each plan's call-to-action button, use an anchor tag like this:

<a href="CHECKOUT_LINK_URL" data-spaire-checkout data-spaire-checkout-theme="light">
  Get Started
</a>

Use "CHECKOUT_LINK_URL" as a placeholder \u2014 I'll replace it with my actual checkout link from the Spaire dashboard after I create my products there.

3. When a user clicks the button, Spaire's checkout overlay will open automatically (handled by the script). No onClick handler needed.

4. Create a /checkout/success page that displays a confirmation message after a successful purchase.

5. Style the pricing page and success page to match the rest of the app's design. Use clean, modern styling.`,
  promptFileName: 'replit-prompt.txt',
  footerNote:
    'After creating your product in the Spaire dashboard, you\u2019ll get a checkout link URL to replace the CHECKOUT_LINK_URL placeholder above.',
}

export const BOLT_INTEGRATION: PromptIntegration = {
  type: 'prompt',
  slug: 'bolt',
  name: 'Bolt',
  tagline: 'Build with Bolt. Monetize with Spaire.',
  description:
    'Spaire works seamlessly with Bolt-generated apps. Copy this prompt into Bolt to scaffold a complete pricing page with Spaire\u2019s checkout overlay \u2014 zero config required.',
  category: 'ai-builder',
  categoryLabel: 'AI App Builder',
  howItWorks: [
    { title: 'Copy prompt', description: 'Grab the ready-made prompt below' },
    {
      title: 'Paste in Bolt',
      description: 'Bolt builds your pricing page',
    },
    {
      title: 'Add checkout links',
      description: 'Drop in your Spaire URLs after creating products',
    },
  ],
  prompt: `Add Spaire payment checkout to my app. Spaire is my billing provider \u2014 it handles payments through a hosted checkout overlay. No API keys or environment variables needed in the frontend.

Here's how it works:
- Spaire uses checkout links (simple URLs) that open a secure payment overlay on top of your app
- No backend code, no API keys, no .env variables \u2014 just a script tag and links

Please do the following:

1. Add this script tag to index.html, right before the closing </body> tag:

<script defer data-auto-init src="https://cdn.spairehq.com/checkout/embed.js"></script>

2. Create a /pricing page with a clean layout showing plan cards. For each plan's call-to-action button, use an anchor tag like this:

<a href="CHECKOUT_LINK_URL" data-spaire-checkout data-spaire-checkout-theme="light">
  Get Started
</a>

Use "CHECKOUT_LINK_URL" as a placeholder \u2014 I'll replace it with my actual checkout link from the Spaire dashboard after I create my products there.

3. When a user clicks the button, Spaire's checkout overlay will open automatically (handled by the script). No onClick handler needed.

4. Create a /checkout/success page that displays a confirmation message after a successful purchase.

5. Style the pricing page and success page to match the rest of the app's design.`,
  promptFileName: 'bolt-prompt.txt',
  footerNote:
    'After creating your product in the Spaire dashboard, you\u2019ll get a checkout link URL to replace the CHECKOUT_LINK_URL placeholder above.',
}

export const BETTERAUTH_INTEGRATION: SdkIntegration = {
  type: 'sdk',
  slug: 'better-auth',
  name: 'BetterAuth',
  tagline: 'Authenticate with BetterAuth. Monetize with Spaire.',
  description:
    'The official Spaire plugin for BetterAuth gives you checkout, customer portal, usage-based billing, and webhooks \u2014 all wired into your auth layer.',
  category: 'auth',
  categoryLabel: 'Auth Framework',
  howItWorks: [
    {
      title: 'Install plugin',
      description: 'Add @spaire/better-auth to your project',
    },
    {
      title: 'Configure auth',
      description: 'Add the Spaire plugin to your BetterAuth config',
    },
    {
      title: 'Go live',
      description: 'Users get checkout, portal, and billing out of the box',
    },
  ],
  packages: 'better-auth @spaire/better-auth @spaire/sdk',
  docsLink: 'https://docs.spairehq.com/integrate/sdk/adapters/better-auth',
  codeLang: 'typescript',
  envVars: `SPAIRE_ACCESS_TOKEN=your_access_token
SPAIRE_SUCCESS_URL=https://example.com/success?checkout_id={CHECKOUT_ID}`,
  code: `import { betterAuth } from "better-auth";
import { spaire, checkout, portal, usage, webhooks } from "@spaire/better-auth";
import { Spaire } from "@spaire/sdk";

const spaireClient = new Spaire({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN,
});

const auth = betterAuth({
  // ... your Better Auth config
  plugins: [
    spaire({
      client: spaireClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: "YOUR_PRODUCT_ID", slug: "pro" },
          ],
          successUrl: process.env.SPAIRE_SUCCESS_URL,
          authenticatedUsersOnly: true,
        }),
      ],
    }),
  ],
});`,
}

export const EXPRESS_INTEGRATION: SdkIntegration = {
  type: 'sdk',
  slug: 'express',
  name: 'Express',
  tagline: 'Build with Express. Monetize with Spaire.',
  description:
    'Use the Spaire SDK in any Express or Node.js backend. Create checkouts, handle webhooks, and manage the full billing lifecycle with a few lines of code.',
  category: 'framework',
  categoryLabel: 'Framework',
  howItWorks: [
    {
      title: 'Install SDK',
      description: 'Add @spaire/sdk to your project',
    },
    {
      title: 'Add routes',
      description: 'Checkout + webhook endpoints in Express',
    },
    {
      title: 'Go live',
      description: 'Full billing loop ready to deploy',
    },
  ],
  packages: '@spaire/sdk',
  docsLink: 'https://docs.spairehq.com/integrate/sdk/typescript',
  codeLang: 'typescript',
  envVars: `SPAIRE_ACCESS_TOKEN=your_access_token
SPAIRE_SUCCESS_URL=https://example.com/success?checkout_id={CHECKOUT_ID}
SPAIRE_WEBHOOK_SECRET=your_webhook_secret`,
  code: `import express from "express";
import { Spaire } from "@spaire/sdk";

const app = express();
app.use(express.json());

const spaire = new Spaire({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN,
});

// Create a checkout session
app.post("/api/checkout", async (req, res) => {
  const checkout = await spaire.checkouts.create({
    products: [req.body.productId],
    successUrl: process.env.SPAIRE_SUCCESS_URL,
  });
  res.json({ url: checkout.url });
});

// Handle webhooks
app.post("/api/webhooks/spaire", async (req, res) => {
  const event = req.body;

  if (event.type === "checkout.completed") {
    // Activate subscription or fulfill order
    console.log("Checkout completed:", event.data);
  }

  res.json({ received: true });
});

app.listen(3000);`,
}

export const ALL_INTEGRATIONS: Integration[] = [
  NEXTJS_INTEGRATION,
  LOVABLE_INTEGRATION,
  SUPABASE_INTEGRATION,
  V0_INTEGRATION,
  REPLIT_INTEGRATION,
  BOLT_INTEGRATION,
  BETTERAUTH_INTEGRATION,
  EXPRESS_INTEGRATION,
]

export const getIntegrationBySlug = (
  slug: string,
): Integration | undefined => {
  return ALL_INTEGRATIONS.find((i) => i.slug === slug)
}
