# `@spaire/checkout`

JavaScript utilities to integrate Spaire Checkout into your website, app, or AI agent.

## Installation

```bash
npm install @spaire/checkout
# or
pnpm add @spaire/checkout
```

---

## Browser — Script Tag (no build step)

The fastest way to add embedded checkout to any HTML page.

```html
<!-- Add to <head> -->
<script src="https://cdn.spairehq.com/embed.js" async></script>

<!-- Option A: automatic (data attributes) -->
<a
  href="https://api.spairehq.com/v1/checkout-links/YOUR_LINK_ID/redirect"
  data-spaire-checkout
  data-spaire-checkout-theme="dark"
>
  Buy now
</a>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    window.Spaire.EmbedCheckout.init() // wire up all data-spaire-checkout elements
  })
</script>

<!-- Option B: programmatic -->
<script>
  async function openCheckout() {
    const checkout = await window.Spaire.EmbedCheckout.create(
      'https://api.spairehq.com/v1/checkout-links/YOUR_LINK_ID/redirect',
      { theme: 'dark' },
    )

    checkout.addEventListener('success', () => {
      window.location.href = '/thank-you'
    })
  }
</script>
```

---

## React / Next.js

```tsx
import { SpaireEmbedCheckout } from '@spaire/checkout/embed'

export function BuyButton({ checkoutUrl }: { checkoutUrl: string }) {
  async function handleClick() {
    let checkout
    try {
      checkout = await SpaireEmbedCheckout.create(checkoutUrl, {
        theme: 'dark',
      })
    } catch (err) {
      // create() rejects after 30s if the checkout never loads
      console.error('Checkout failed to open:', err)
      return
    }

    checkout.addEventListener('success', () => {
      // The overlay is already closed automatically.
      // Do any post-purchase navigation here.
      window.location.href = '/thank-you'
    })
  }

  return <button onClick={handleClick}>Buy now</button>
}
```

### Events

| Event       | When it fires            | Default behavior                                 |
| ----------- | ------------------------ | ------------------------------------------------ |
| `loaded`    | iframe is ready          | Removes loading spinner                          |
| `confirmed` | customer submits payment | Prevents accidental close                        |
| `success`   | payment confirmed        | Closes overlay (+ redirects if `redirect: true`) |
| `close`     | customer clicks X        | Closes overlay (only if not confirming)          |

Call `event.preventDefault()` on any event to suppress the default behavior and handle it yourself.

### CSP

If your app sets a Content Security Policy, add the checkout origin to `frame-src`:

```js
// next.config.mjs
const cspHeader = `
  frame-src 'self' https://api.spairehq.com;
`
```

---

## AI Agents (server-side / headless)

AI agents can't render iframes. Instead, generate a checkout URL server-side and return it to the user to open in their browser.

```ts
import Spaire from '@spaire/sdk'

const spaire = new Spaire({ accessToken: process.env.SPAIRE_ACCESS_TOKEN })

// In your agent's tool handler:
async function createCheckoutLink(productPriceId: string) {
  const link = await spaire.checkoutLinks.create({
    productPriceId,
    successUrl: 'https://yourapp.com/thank-you',
  })

  // Return this URL to the user — they open it in their browser.
  return link.url
}
```

```ts
// Example: Claude tool definition
const tools = [
  {
    name: 'create_checkout',
    description: 'Create a checkout link for a product',
    input_schema: {
      type: 'object',
      properties: {
        product_price_id: { type: 'string' },
      },
      required: ['product_price_id'],
    },
  },
]

// Handle tool call:
async function handleToolCall(toolName: string, input: Record<string, string>) {
  if (toolName === 'create_checkout') {
    const url = await createCheckoutLink(input.product_price_id)
    return `Here's your checkout link: ${url}`
  }
}
```

### Listen for fulfillment via webhook

After the user completes payment, Spaire sends a webhook. Register an endpoint in your Spaire dashboard and handle `checkout.updated` events:

```ts
// Example: Express webhook handler
import express from 'express'
import Spaire from '@spaire/sdk'

const app = express()
const spaire = new Spaire({ accessToken: process.env.SPAIRE_ACCESS_TOKEN })

app.post(
  '/webhooks/spaire',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const event = await spaire.webhooks.constructEvent(
      req.body,
      req.headers['spaire-signature'] as string,
      process.env.SPAIRE_WEBHOOK_SECRET!,
    )

    if (
      event.type === 'checkout.updated' &&
      event.data.status === 'succeeded'
    ) {
      const { customerId, productId } = event.data
      // Provision access, send confirmation email, etc.
    }

    res.sendStatus(200)
  },
)
```

---

## TypeScript

The package ships full TypeScript types. No `@types/` package needed.
