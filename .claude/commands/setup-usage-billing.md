# Setup Usage-Based Billing

AI-driven setup for Spaire usage-based billing. Detects the user's framework, creates meters, wires event ingestion, and configures metered pricing — all conversationally.

## Instructions

When the user invokes this command, walk them through setting up usage-based billing in their project. The goal is to **replace the manual docs-reading process** with an agent that scaffolds everything.

### Phase 1: Discover the User's Project

1. **Detect the framework** by checking the user's project for:
   - `package.json` → look for `next`, `express`, `fastify`, `hono`, `elysia`, `@sveltejs/kit`, `nuxt`, `astro`, `remix`
   - `requirements.txt` or `pyproject.toml` → look for `fastapi`, `flask`, `django`, `pydantic-ai`
   - `go.mod` → Go project
   - `composer.json` → look for `laravel`

2. **Ask what they want to meter**. Offer these common patterns:
   - **LLM token usage** (prompt tokens, completion tokens, total tokens)
   - **API calls** (count of requests to specific endpoints)
   - **Storage** (bytes uploaded/downloaded via S3 or similar)
   - **Compute time** (execution duration of tasks/functions)
   - **Custom** (let them describe their own metric)

3. **Ask about their pricing model**:
   - Price per unit (e.g., $0.001 per token)
   - Credits-based (prepaid credits deducted per use)
   - Both (credits with overage billing)

### Phase 2: Check Prerequisites

Before generating code, verify the user has:

1. **Spaire SDK installed** — if not, tell them to run:
   - TypeScript: `pnpm add @spaire/sdk` (and `@spaire/ingestion` if using strategies)
   - Python: `pip install spaire-sdk` or `uv add spaire-sdk`

2. **Environment variable** — `SPAIRE_ACCESS_TOKEN` must be set. If not:
   - Tell them: "Create an organization access token at https://dashboard.spairehq.com → Settings → Access Tokens"
   - For sandbox testing: "Use `server: 'sandbox'` in the SDK config and create a sandbox token"

3. **Existing product** — Ask if they already have a subscription product in Spaire, or if they need to create one via the dashboard.

### Phase 3: Generate the Meter Configuration

Based on what they want to meter, help them create the meter via the Spaire dashboard or explain what to configure:

#### LLM Token Usage
```
Meter Name: "llm-token-usage"
Filter: name equals "llm-usage"
Aggregation: Sum over "totalTokens"
```
Optionally, create separate meters for prompt and completion tokens:
```
Meter 1: "prompt-tokens" → Sum over "inputTokens", filter: name eq "llm-usage"
Meter 2: "completion-tokens" → Sum over "outputTokens", filter: name eq "llm-usage"
```

#### API Calls
```
Meter Name: "api-calls"
Filter: name equals "api-call"
Aggregation: Count
```

#### Storage (Bytes)
```
Meter Name: "storage-usage"
Filter: name equals "storage-upload"
Aggregation: Sum over "bytes"
```

#### Compute Time
```
Meter Name: "compute-time"
Filter: name equals "compute-execution"
Aggregation: Sum over "deltaTime"
```

Tell the user: "Go to https://dashboard.spairehq.com → Products → Meters → Create Meter and enter these values."

### Phase 4: Generate Event Ingestion Code

Generate the ingestion code **directly in the user's project** based on their framework and use case. Use the Edit or Write tools to create the files.

#### TypeScript + LLM (Vercel AI SDK)

If the project uses `ai` or `@ai-sdk/*`:

```typescript
// lib/spaire-ingestion.ts
import { Ingestion } from "@spaire/ingestion";
import { LLMStrategy } from "@spaire/ingestion/strategies/LLM";
import { openai } from "@ai-sdk/openai"; // or whichever provider they use

const llmIngestion = Ingestion({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN!,
})
  .strategy(new LLMStrategy(openai("gpt-4o")))
  .ingest("llm-usage");

export function getIngestionModel(customerId: string) {
  return llmIngestion.client({ customerId });
}
```

Then update their existing API route to use the wrapped model:
```typescript
import { getIngestionModel } from "@/lib/spaire-ingestion";
import { generateText } from "ai";

export async function POST(req: Request) {
  const { prompt, customerId } = await req.json();
  const model = getIngestionModel(customerId);

  const { text } = await generateText({
    model,
    system: "You are a helpful assistant.",
    prompt,
  });

  return Response.json({ text });
}
```

#### TypeScript + API Call Counting (Generic)

```typescript
// lib/spaire-ingestion.ts
import { Spaire } from "@spaire/sdk";

const spaire = new Spaire({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN!,
});

export async function trackApiCall(customerId: string, endpoint: string) {
  await spaire.events.ingest({
    events: [
      {
        name: "api-call",
        customerId,
        metadata: { endpoint },
      },
    ],
  });
}
```

#### TypeScript + S3 Storage

```typescript
// lib/spaire-ingestion.ts
import { Ingestion } from "@spaire/ingestion";
import { S3Strategy } from "@spaire/ingestion/strategies/S3";
import { S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const s3Ingestion = Ingestion({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN!,
})
  .strategy(new S3Strategy(s3Client))
  .ingest("storage-upload");

export function getTrackedS3Client(customerId: string) {
  return s3Ingestion.client({ customerId });
}
```

#### TypeScript + Compute Time

```typescript
// lib/spaire-ingestion.ts
import { Ingestion } from "@spaire/ingestion";
import { DeltaTimeStrategy } from "@spaire/ingestion/strategies/DeltaTime";

const deltaIngestion = Ingestion({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN!,
})
  .strategy(new DeltaTimeStrategy(() => performance.now()))
  .ingest("compute-execution");

export function getTimer(customerId: string) {
  const start = deltaIngestion.client({ customerId });
  return start; // call start() to begin, returns stop() function
}
```

#### Python + PydanticAI

```python
# billing/ingestion.py
import os
from spaire_sdk.ingestion import Ingestion
from spaire_sdk.ingestion.strategies import PydanticAIStrategy

ingestion = Ingestion(os.getenv("SPAIRE_ACCESS_TOKEN"))
llm_strategy = ingestion.strategy(PydanticAIStrategy, "llm-usage")

def track_ai_usage(customer_id: str, result):
    """Call after each PydanticAI agent run to track token usage."""
    llm_strategy.ingest(customer_id, result)
```

#### Python + Generic Event Ingestion

```python
# billing/ingestion.py
import os
from spaire_sdk.ingestion import Ingestion

ingestion = Ingestion(os.getenv("SPAIRE_ACCESS_TOKEN"))

def track_api_call(customer_id: str, endpoint: str):
    ingestion.ingest({
        "name": "api-call",
        "external_customer_id": customer_id,
        "metadata": {"endpoint": endpoint},
    })
```

### Phase 5: Wire Up Metered Pricing

Guide the user to add a metered price to their product:

1. "Go to https://dashboard.spairehq.com → Products → select your product → Edit"
2. "Click 'Add Additional Price'"
3. "Select 'Metered' as the price type"
4. "Choose the meter you just created"
5. "Set the price per unit (e.g., $0.001 per token)"
6. "Optionally set a cap (maximum charge per billing period)"
7. "Save the product"

### Phase 6: (Optional) Credits Setup

If the user chose credits-based billing:

1. "Go to Products → Benefits → Create Benefit"
2. "Select 'Meter Credits' as the type"
3. "Choose your meter and set the number of credits per cycle"
4. "Attach this benefit to your product"

Also generate a balance-checking utility:

```typescript
// lib/spaire-balance.ts
import { Spaire } from "@spaire/sdk";

const spaire = new Spaire({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN!,
});

export async function getCustomerBalance(customerId: string) {
  const state = await spaire.customers.getStateExternal({ externalId: customerId });
  return state.activeMeters.map((m) => ({
    meter: m.meter.name,
    balance: m.balance,
    consumed: m.consumedUnits,
    credited: m.creditedUnits,
  }));
}

export async function hasCreditsRemaining(customerId: string, meterName: string): Promise<boolean> {
  const balances = await getCustomerBalance(customerId);
  const meter = balances.find((b) => b.meter === meterName);
  return meter ? meter.balance < 0 : false; // negative balance = credits remaining
}
```

Python equivalent:
```python
# billing/balance.py
import os
from spaire_sdk import Spaire

client = Spaire(access_token=os.getenv("SPAIRE_ACCESS_TOKEN"))

def get_customer_balance(customer_id: str):
    state = client.customers.get_state_external(external_id=customer_id)
    return [
        {
            "meter": m.meter.name,
            "balance": m.balance,
            "consumed": m.consumed_units,
            "credited": m.credited_units,
        }
        for m in state.active_meters
    ]

def has_credits_remaining(customer_id: str, meter_name: str) -> bool:
    balances = get_customer_balance(customer_id)
    meter = next((b for b in balances if b["meter"] == meter_name), None)
    return meter["balance"] < 0 if meter else False
```

### Phase 7: Generate Webhook Handler (Optional)

If the user needs to react to billing events (e.g., grant credits on purchase, handle subscription changes):

#### Next.js
```typescript
// app/api/webhook/spaire/route.ts
import { Webhooks } from "@spaire/nextjs";

export const POST = Webhooks({
  webhookSecret: process.env.SPAIRE_WEBHOOK_SECRET!,
  onOrderPaid: async (order) => {
    console.log(`Order paid: ${order.data.id} by customer ${order.data.customer_id}`);
    // Add your post-purchase logic here
  },
  onSubscriptionActive: async (subscription) => {
    console.log(`Subscription active: ${subscription.data.id}`);
    // Provision access to your service
  },
  onSubscriptionCanceled: async (subscription) => {
    console.log(`Subscription canceled: ${subscription.data.id}`);
    // Revoke access at end of billing period
  },
});
```

Tell the user: "Register this webhook URL at https://dashboard.spairehq.com → Settings → Webhooks"

### Phase 8: Testing Checklist

Present a testing checklist:

1. **Set `SPAIRE_ACCESS_TOKEN` in your `.env`** (sandbox token for testing)
2. **Create the meter** in the Spaire dashboard
3. **Add metered pricing** to your product
4. **Run your app** and trigger the event ingestion code
5. **Check the Spaire dashboard** → Products → Meters to see events flowing in
6. **Create a test checkout** to verify end-to-end billing

If using sandbox:
```typescript
const spaire = new Spaire({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN!,
  server: "sandbox",
});
```

### Key Rules for the Agent

- **Always detect the framework first** before generating any code
- **Write files directly** into the user's project using Write/Edit tools
- **Use the correct SDK package** — `@spaire/sdk` for basic ingestion, `@spaire/ingestion` for strategies (LLM, S3, Stream, DeltaTime)
- **Use the correct import paths** — strategies are at `@spaire/ingestion/strategies/LLM`, not from `@spaire/sdk`
- **Never hardcode access tokens** — always use environment variables
- **Prefer the Ingestion strategies** over raw `spaire.events.ingest()` when a matching strategy exists
- **Match event names in meters** — the meter filter `name equals "X"` must match the event name passed to `.ingest("X")`
- **Ask before creating files** — confirm file paths with the user before writing
- **Suggest sandbox first** — always recommend testing in sandbox before production
