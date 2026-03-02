export interface AgentPlatformCommand {
  slug: string
  name: string
  description: string
  /** The snippet to show for invoking this command with this agent */
  snippet: string
  snippetLang: 'bash' | 'text'
  /** If the command has its own dedicated detail page (Claude Code only) */
  detailPageSlug?: string
}

export interface AgentPlatform {
  slug: string
  name: string
  tagline: string
  description: string
  /** Short label shown as a badge, e.g. "Terminal AI Agent" */
  categoryLabel: string
  /** Tailwind text color class for the badge */
  categoryColor: string
  /** Tailwind bg color class for the badge */
  categoryBg: string
  /** Install command for the agent itself. Omit for IDE-based agents. */
  installCommand?: string
  howItWorks: { title: string; description: string }[]
  /** Bash snippet to load the Spaire playbooks into the project */
  setupSnippet?: string
  /** Explanation shown under the setup snippet */
  setupNote?: string
  commands: AgentPlatformCommand[]
  docsLink: string
}

const CDN_BASE = 'https://cdn.spairehq.com'

export const CLAUDE_CODE_PLATFORM: AgentPlatform = {
  slug: 'claude-code',
  name: 'Claude Code',
  tagline: 'Run Spaire agent commands directly inside Claude Code.',
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
      detailPageSlug: 'setup-checkout',
    },
    {
      slug: 'setup-usage-billing',
      name: 'Setup Usage Billing',
      description:
        'Installs the SDK, creates meters, and writes ingestion code for LLM tokens, API calls, storage, or custom metrics.',
      snippet: `cd your-project\nclaude\n\n# Then type:\n/setup-usage-billing`,
      snippetLang: 'bash',
      detailPageSlug: 'setup-usage-billing',
    },
  ],
  docsLink: 'https://docs.spairehq.com/integrate/agent-commands',
}

export const CURSOR_PLATFORM: AgentPlatform = {
  slug: 'cursor',
  name: 'Cursor',
  tagline: 'Run Spaire playbooks from the Cursor chat panel.',
  description:
    "Add the Spaire rules file to your project, then open Cursor's chat panel and ask it to follow the playbook. Cursor reads your codebase and writes the integration code for you.",
  categoryLabel: 'AI Code Editor',
  categoryColor: 'text-sky-600 dark:text-sky-400',
  categoryBg: 'bg-sky-50 dark:bg-sky-500/10',
  howItWorks: [
    {
      title: 'Load the rules file',
      description: 'Add the Spaire Cursor rules to your project with one command',
    },
    {
      title: 'Open Cursor Chat',
      description: 'Press Cmd+L (Mac) or Ctrl+L (Windows/Linux)',
    },
    {
      title: 'Ask it to run the playbook',
      description: 'Paste the prompt and Cursor handles the rest',
    },
  ],
  setupSnippet: `mkdir -p .cursor/rules\ncurl -sL -o .cursor/rules/spaire.mdc \\\n  ${CDN_BASE}/cursor/rules/spaire.mdc`,
  setupNote:
    'This downloads the Spaire rules file into your project. Cursor loads it automatically as project context. Commit the file so your whole team gets it.',
  commands: [
    {
      slug: 'setup-checkout',
      name: 'Setup Checkout',
      description:
        'Detects your framework, finds your pricing pages, and wires up Spaire checkout — overlay, programmatic, or server-side.',
      snippet: `Follow the setup-checkout playbook in docs/agent-playbooks/setup-checkout.md`,
      snippetLang: 'text',
    },
    {
      slug: 'setup-usage-billing',
      name: 'Setup Usage Billing',
      description:
        'Installs the SDK, creates meters, and writes ingestion code for LLM tokens, API calls, storage, or custom metrics.',
      snippet: `Follow the setup-usage-billing playbook in docs/agent-playbooks/setup-usage-billing.md`,
      snippetLang: 'text',
    },
  ],
  docsLink: 'https://docs.spairehq.com/integrate/agent-commands',
}

export const CODEX_PLATFORM: AgentPlatform = {
  slug: 'codex',
  name: 'Codex',
  tagline: 'Run Spaire playbooks from the OpenAI Codex CLI.',
  description:
    "Your project's AGENTS.md already references the Spaire playbooks. Install the Codex CLI, run it in your project directory, and ask it to follow the setup playbook.",
  categoryLabel: 'CLI AI Agent',
  categoryColor: 'text-gray-600 dark:text-gray-400',
  categoryBg: 'bg-gray-100 dark:bg-gray-500/10',
  installCommand: 'npm install -g @openai/codex',
  howItWorks: [
    {
      title: 'Install Codex CLI',
      description: 'Get the OpenAI Codex CLI with one command',
    },
    {
      title: 'AGENTS.md is ready',
      description: "Your project's AGENTS.md already includes Spaire playbook references",
    },
    {
      title: 'Ask it to run the playbook',
      description: 'Launch Codex in your project and give it the instruction',
    },
  ],
  setupNote:
    "Your project's AGENTS.md already references the Spaire playbooks — no extra files to download. Codex reads AGENTS.md automatically when it starts in your project directory.",
  commands: [
    {
      slug: 'setup-checkout',
      name: 'Setup Checkout',
      description:
        'Detects your framework, finds your pricing pages, and wires up Spaire checkout — overlay, programmatic, or server-side.',
      snippet: `cd your-project\ncodex "Follow the setup-checkout playbook in docs/agent-playbooks/setup-checkout.md"`,
      snippetLang: 'bash',
    },
    {
      slug: 'setup-usage-billing',
      name: 'Setup Usage Billing',
      description:
        'Installs the SDK, creates meters, and writes ingestion code for LLM tokens, API calls, storage, or custom metrics.',
      snippet: `cd your-project\ncodex "Follow the setup-usage-billing playbook in docs/agent-playbooks/setup-usage-billing.md"`,
      snippetLang: 'bash',
    },
  ],
  docsLink: 'https://docs.spairehq.com/integrate/agent-commands',
}

export const GITHUB_COPILOT_PLATFORM: AgentPlatform = {
  slug: 'github-copilot',
  name: 'GitHub Copilot',
  tagline: 'Run Spaire playbooks from the Copilot Chat panel.',
  description:
    'Add the Spaire workspace instructions to your project, then open Copilot Chat in VS Code or JetBrains and ask it to follow the setup playbook.',
  categoryLabel: 'AI Pair Programmer',
  categoryColor: 'text-purple-600 dark:text-purple-400',
  categoryBg: 'bg-purple-50 dark:bg-purple-500/10',
  howItWorks: [
    {
      title: 'Load workspace instructions',
      description: 'Add the Spaire Copilot instructions to your project',
    },
    {
      title: 'Open Copilot Chat',
      description: 'Use the chat panel in VS Code, JetBrains, or GitHub.com',
    },
    {
      title: 'Ask it to run the playbook',
      description: 'Paste the @workspace prompt and Copilot handles the rest',
    },
  ],
  setupSnippet: `mkdir -p .github\ncurl -sL -o .github/copilot-instructions.md \\\n  ${CDN_BASE}/copilot/copilot-instructions.md`,
  setupNote:
    'This downloads the Spaire workspace instructions into your project. GitHub Copilot loads it automatically as context. Commit the file so your whole team gets it.',
  commands: [
    {
      slug: 'setup-checkout',
      name: 'Setup Checkout',
      description:
        'Detects your framework, finds your pricing pages, and wires up Spaire checkout — overlay, programmatic, or server-side.',
      snippet: `@workspace Follow the setup-checkout playbook in docs/agent-playbooks/setup-checkout.md`,
      snippetLang: 'text',
    },
    {
      slug: 'setup-usage-billing',
      name: 'Setup Usage Billing',
      description:
        'Installs the SDK, creates meters, and writes ingestion code for LLM tokens, API calls, storage, or custom metrics.',
      snippet: `@workspace Follow the setup-usage-billing playbook in docs/agent-playbooks/setup-usage-billing.md`,
      snippetLang: 'text',
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
