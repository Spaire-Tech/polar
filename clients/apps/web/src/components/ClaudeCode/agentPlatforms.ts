export interface AgentPlatformCommand {
  slug: string
  name: string
  description: string
  /** The snippet to copy and run or paste in chat */
  snippet: string
  snippetLang: 'bash' | 'text'
  /** Label shown above the snippet, e.g. "Paste in Cursor Chat (Agent mode)" */
  snippetLabel: string
  /** If the command has its own dedicated deep-dive page (Claude Code only) */
  detailPageSlug?: string
}

export interface AgentPlatform {
  slug: string
  name: string
  tagline: string
  description: string
  /** Short label shown as a badge */
  categoryLabel: string
  /** Tailwind text color class for the badge */
  categoryColor: string
  /** Tailwind bg color class for the badge */
  categoryBg: string
  /** Install command. Omit for IDE-based agents (Cursor, Copilot). */
  installCommand?: string
  howItWorks: { title: string; description: string }[]
  /** Bash snippet to get the Spaire config file into the project */
  setupSnippet?: string
  /** Note shown below the setup snippet */
  setupNote?: string
  commands: AgentPlatformCommand[]
  docsLink: string
}

const CDN_BASE = 'https://cdn.spairehq.com'

export const CLAUDE_CODE_PLATFORM: AgentPlatform = {
  slug: 'claude-code',
  name: 'Claude Code',
  tagline: 'Run Spaire commands directly inside Claude Code.',
  description:
    'Add two slash commands to your project, open Claude Code, and type the command. The agent reads your codebase, asks a few questions, and writes production-ready billing code directly into your files.',
  categoryLabel: 'Terminal AI Agent',
  categoryColor: 'text-orange-600 dark:text-orange-400',
  categoryBg: 'bg-orange-50 dark:bg-orange-500/10',
  installCommand: 'npm install -g @anthropic-ai/claude-code',
  howItWorks: [
    {
      title: 'Install Claude Code',
      description: 'One command to get the CLI on your machine',
    },
    {
      title: 'Download command files',
      description: 'Add the Spaire slash commands to your project',
    },
    {
      title: 'Type the command',
      description: 'Claude Code reads your codebase and writes the code',
    },
  ],
  setupSnippet: `mkdir -p .claude/commands\ncurl -sL -o .claude/commands/setup-checkout.md \\\n  ${CDN_BASE}/claude/commands/setup-checkout.md\ncurl -sL -o .claude/commands/setup-usage-billing.md \\\n  ${CDN_BASE}/claude/commands/setup-usage-billing.md`,
  setupNote:
    'This downloads both agent commands into your project. Claude Code loads them automatically as custom slash commands. Commit the files so your whole team gets them.',
  commands: [
    {
      slug: 'setup-checkout',
      name: 'Setup Checkout',
      description:
        'Detects your framework, finds your pricing pages, and wires up Spaire checkout — overlay, programmatic, or server-side.',
      snippet: `cd your-project\nclaude\n\n# Then type:\n/setup-checkout`,
      snippetLang: 'bash',
      snippetLabel: 'Run in terminal',
      detailPageSlug: 'setup-checkout',
    },
    {
      slug: 'setup-usage-billing',
      name: 'Setup Usage Billing',
      description:
        'Installs the SDK, creates meters, and writes ingestion code for LLM tokens, API calls, storage, or custom metrics.',
      snippet: `cd your-project\nclaude\n\n# Then type:\n/setup-usage-billing`,
      snippetLang: 'bash',
      snippetLabel: 'Run in terminal',
      detailPageSlug: 'setup-usage-billing',
    },
  ],
  docsLink: 'https://docs.spairehq.com/integrate/agent-commands',
}

export const CURSOR_PLATFORM: AgentPlatform = {
  slug: 'cursor',
  name: 'Cursor',
  tagline: 'Ask Cursor to wire up Spaire — it already knows your codebase.',
  description:
    'Commit one rules file to your project and Cursor immediately gains context about Spaire. Open Agent mode, describe what you want, and Cursor finds the right files and writes the integration across your whole project.',
  categoryLabel: 'AI Code Editor',
  categoryColor: 'text-sky-600 dark:text-sky-400',
  categoryBg: 'bg-sky-50 dark:bg-sky-500/10',
  howItWorks: [
    {
      title: 'Commit the rules file',
      description:
        'Drop `.cursor/rules/spaire.mdc` into your project — every developer gets Spaire context automatically when they open Cursor.',
    },
    {
      title: 'Open Cursor Chat',
      description:
        'Press Cmd+L (Mac) or Ctrl+L (Windows). Switch to Agent mode for multi-file changes.',
    },
    {
      title: 'Describe what you want',
      description:
        'Say "Add Spaire checkout to this app" — Cursor finds your pricing page and writes the code.',
    },
  ],
  setupSnippet: `mkdir -p .cursor/rules\ncurl -sL -o .cursor/rules/spaire.mdc \\\n  ${CDN_BASE}/cursor/rules/spaire.mdc`,
  setupNote:
    'Cursor reads `.cursor/rules/*.mdc` files automatically as project context. Commit this file so every developer on your team gets Spaire context in their editor.',
  commands: [
    {
      slug: 'setup-checkout',
      name: 'Add Checkout',
      description:
        'Cursor detects your framework, finds your pricing pages, and wires up Spaire checkout — overlay, programmatic, or server-side.',
      snippet: `Add Spaire checkout to this app`,
      snippetLang: 'text',
      snippetLabel: 'Paste in Cursor Chat (Agent mode)',
    },
    {
      slug: 'setup-usage-billing',
      name: 'Set Up Usage Billing',
      description:
        'Cursor installs the SDK, asks what you want to meter, and writes ingestion code directly in your project.',
      snippet: `Set up Spaire usage billing in this project — ask me what to meter`,
      snippetLang: 'text',
      snippetLabel: 'Paste in Cursor Chat (Agent mode)',
    },
  ],
  docsLink: 'https://docs.spairehq.com/integrate/agent-commands',
}

export const CODEX_PLATFORM: AgentPlatform = {
  slug: 'codex',
  name: 'Codex',
  tagline: 'Hand Spaire integrations off to the Codex agent in your terminal.',
  description:
    'Install the Codex CLI, navigate to your project, and give it a task. Codex picks up AGENTS.md automatically for project context, then works autonomously — writing code, running tests, and iterating until the job is done.',
  categoryLabel: 'CLI AI Agent',
  categoryColor: 'text-neutral-500 dark:text-neutral-400',
  categoryBg: 'bg-neutral-100 dark:bg-neutral-500/10',
  installCommand: 'npm i -g @openai/codex',
  howItWorks: [
    {
      title: 'Install Codex CLI',
      description: 'One command gets the OpenAI Codex agent on your machine.',
    },
    {
      title: 'AGENTS.md is set up',
      description:
        "Your project's AGENTS.md already has Spaire context baked in — Codex reads it automatically.",
    },
    {
      title: 'Give it a task',
      description:
        'Run a single command from your terminal and Codex works autonomously from there.',
    },
  ],
  setupNote:
    "Your project's AGENTS.md already includes Spaire context — no extra files needed. Codex reads AGENTS.md automatically at startup when you run it inside your project.",
  commands: [
    {
      slug: 'setup-checkout',
      name: 'Add Checkout',
      description:
        'Codex detects your framework, finds pricing pages, and wires up Spaire checkout — it runs tests and iterates until it works.',
      snippet: `codex "Add Spaire checkout to this project"`,
      snippetLang: 'bash',
      snippetLabel: 'Run in your project directory',
    },
    {
      slug: 'setup-usage-billing',
      name: 'Set Up Usage Billing',
      description:
        'Codex installs the SDK, asks what to meter, writes ingestion code, and iterates until the integration is clean.',
      snippet: `codex "Set up Spaire usage billing — ask me what to meter"`,
      snippetLang: 'bash',
      snippetLabel: 'Run in your project directory',
    },
  ],
  docsLink: 'https://docs.spairehq.com/integrate/agent-commands',
}

export const GITHUB_COPILOT_PLATFORM: AgentPlatform = {
  slug: 'github-copilot',
  name: 'GitHub Copilot',
  tagline: 'Use Copilot Agent to wire up Spaire across your entire codebase.',
  description:
    'Commit workspace instructions once and every Copilot session in your repo gains full Spaire context. Switch to Agent mode in VS Code — Copilot edits files, checks for errors, and runs terminal commands autonomously until the integration is working.',
  categoryLabel: 'AI Pair Programmer',
  categoryColor: 'text-violet-600 dark:text-violet-400',
  categoryBg: 'bg-violet-50 dark:bg-violet-500/10',
  howItWorks: [
    {
      title: 'Commit workspace instructions',
      description:
        '`.github/copilot-instructions.md` gives Copilot context about Spaire — auto-loaded in every chat session.',
    },
    {
      title: 'Switch to Agent mode',
      description:
        'Open Copilot Chat in VS Code, click the model picker, and select Agent for autonomous multi-file changes.',
    },
    {
      title: 'Give it a task',
      description:
        'Describe the integration in plain English — Copilot reads your codebase and handles all the edits.',
    },
  ],
  setupSnippet: `mkdir -p .github\ncurl -sL -o .github/copilot-instructions.md \\\n  ${CDN_BASE}/copilot/copilot-instructions.md`,
  setupNote:
    'GitHub Copilot reads `.github/copilot-instructions.md` automatically in every chat session in this repo. Commit this file so your whole team gets Spaire context in their Copilot.',
  commands: [
    {
      slug: 'setup-checkout',
      name: 'Add Checkout',
      description:
        'Copilot Agent detects your framework, finds pricing pages, and wires up Spaire checkout — it checks for errors and iterates.',
      snippet: `Add Spaire checkout to this project`,
      snippetLang: 'text',
      snippetLabel: 'Paste in Copilot Chat (Agent mode)',
    },
    {
      slug: 'setup-usage-billing',
      name: 'Set Up Usage Billing',
      description:
        'Copilot Agent installs the SDK, asks what to meter, writes ingestion code, and wires up the full billing loop.',
      snippet: `Set up Spaire usage billing in this project`,
      snippetLang: 'text',
      snippetLabel: 'Paste in Copilot Chat (Agent mode)',
    },
  ],
  docsLink: 'https://docs.spairehq.com/integrate/agent-commands',
}

export const ALL_AGENT_PLATFORMS: AgentPlatform[] = [
  CLAUDE_CODE_PLATFORM,
  CURSOR_PLATFORM,
  CODEX_PLATFORM,
  GITHUB_COPILOT_PLATFORM,
]

export const getAgentPlatformBySlug = (
  slug: string,
): AgentPlatform | undefined => {
  return ALL_AGENT_PLATFORMS.find((p) => p.slug === slug)
}
