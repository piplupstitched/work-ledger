# Work Ledger

Structured work logging and performance summaries for knowledge workers.

## Features

- Parse `work-log` code blocks from markdown files across your vault
- Aggregate totals, entry count, hours by category, and hours by project
- Generate weekly and quarterly markdown summaries
- Export all parsed entries to CSV
- Configurable category list, custom-category toggle, hour rounding, and date inference

## Work Log Format

Add this block anywhere in a note:

```work-log
project: SCD Manuscript
category: Research/Analysis
hours: 2
tags: [scd, manuscript]
note: Kaplan-Meier revisions
date: 2026-02-13
```

Required field:

- `project`

Optional fields:

- `category`
- `hours`
- `tags` (array style `[a, b]` or comma style `a, b`)
- `note`
- `date`

## Date Inference

When `date` is missing, Work Ledger resolves in this order:

1. `date:` in the code block
2. frontmatter `date:` or `created:`
3. filename patterns: `YYYY-MM-DD`, `YYYY_MM_DD`, `MM-DD-YYYY`
4. file modified timestamp
5. current day

If date inference is disabled in settings, missing dates fallback directly to today.

## Commands

- `Work Ledger: Open Summary`
- `Work Ledger: Export CSV`
- `Work Ledger: Generate Weekly Summary`
- `Work Ledger: Generate Quarterly Summary`
- `Work Ledger: Insert Work Log Template`

You can also open the summary from the left ribbon icon.

Inside the summary view, use date-range chips (`This Week`, `Last Week`, `This Month`, `This Quarter`, `All`, `Custom`) and click recent entries to jump to source notes.

## Settings

- Category list
- Allow custom categories
- Hour rounding increment (`0.25`, `0.5`, `1.0`)
- Enable date inference

## Manifest

Plugin id: `work-ledger`

## Support

Optional support via Ko-fi: https://ko-fi.com/piplupstitched
