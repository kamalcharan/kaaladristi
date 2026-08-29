# Grand Slam Offer — a Claude Code Skill

A guided, interactive **offer builder** for [Claude Code](https://claude.com/claude-code). It turns any product or service into a **Grand Slam Offer** — *an offer so good people feel stupid saying no* — by walking you through the full methodology one question at a time and ending with a finished, copy-pasteable offer document.

Built on the framework from **Alex Hormozi's *$100M Offers***. This skill is an original orchestration of those concepts for educational use; it does not contain or reproduce the book.

## What it does

It runs a 7-phase flow:

1. **Diagnose** — find where you're stuck (not enough clients vs. cash) and whether you're a commodity.
2. **Market** — score your market, niche down, define your avatar.
3. **Pricing** — LTV/Revenue-Cap math, premium positioning, raise value before price.
4. **Value Equation** — score your offer on the 4 drivers, attack the weakest.
5. **Build** — map problems → solutions → a value-stacked offer.
6. **Enhance** — scarcity, urgency, bonuses, a guarantee with teeth, and a MAGIC name.
7. **Launch** — completeness check, launch cadence, and a saved offer artifact + scorecard.

## Install

Copy the `grand-slam-offer/` folder into your project's (or home) skills directory:

```bash
# project-level
mkdir -p .claude/skills
cp -r grand-slam-offer .claude/skills/

# or user-level (available in every project)
mkdir -p ~/.claude/skills
cp -r grand-slam-offer ~/.claude/skills/
```

Restart Claude Code so the skill registers.

## Use

Three ways:

- **Slash command:** `/grand-slam-offer`
- **Just describe the task:** *"help me build an offer for my coaching program"*, *"what should I charge?"*, *"my offer isn't converting"*
- **Critique an existing offer:** paste it and the skill routes you to the weakest part.

It asks you questions one at a time, does the pricing/value math with your real numbers, and produces a finished offer: value-stack table, guarantee, name options, launch plan, and a scorecard.

## Structure

```
grand-slam-offer/
├── SKILL.md                 # orchestration: entry router + 7-phase flow
└── references/
    ├── playbook.md          # frameworks, formulas, calculators, scorecards
    └── swipe.md             # templates, scripts, swipe libraries, output format
```

## Credit

Methodology © Alex Hormozi, *$100M Offers*. Read the book — this skill is a companion, not a substitute.
