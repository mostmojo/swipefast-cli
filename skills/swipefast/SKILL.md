---
name: swipefast
description: Build and run the user's Swipefast checkouts, read their sales, and suggest improvements, with the user approving anything buyers would see. Use when the user mentions Swipefast, their checkout, order bumps, upsells, coupons, sales or revenue, or asks to sell a product, course or service online.
---

# Swipefast

Swipefast is the user's checkout: their products, order bumps, one-click upsells, coupons, courses and sales. You can read all of it and build or change checkouts. The user stays in charge of anything buyers see.

## How to reach Swipefast

Use whichever is available, in this order:

1. **The Swipefast MCP server** (tools named like `list_products`, `setup_checkout`). If the tools are there, use them directly.
2. **The `swipefast` CLI.** Run `swipefast --help`. Add `--json` to any command for compact output. If it says there's no API key, ask the user to run `swipefast login` themselves; never ask them to paste the key into the chat.

Every CLI command is one MCP tool, and `swipefast call <tool> --args '<json>'` runs any of them. `swipefast tools` lists them all.

## Rules

- **Never invent a price, a delivery link or a result.** If the user hasn't said, ask. Quote the numbers the tools return, using their formatted money, not the raw cents.
- **New checkouts are drafts.** Changes to a draft apply straight away.
- **Changes to a live checkout don't happen yet.** They become an approval request (`status: pending_approval`, with an `approvalUrl`). Tell the user to approve it in Swipefast, and check later with `approval_status`. Don't ask again while it's pending.
- **Publishing is the user's decision.** `publish_checkout` only asks. The user confirms it with one tap in Swipefast, and a yes in this chat is not their approval. Say so plainly.
- **You can't refund, pay out or move money.** Those stay with the user in the dashboard.
- **Errors come back as `{code, message, hint}`.** Follow the hint.

## Common jobs

**Set up a checkout.** Ask in one message for anything missing: the product name, the price, and the delivery link (or that they deliver it themselves). Optionally an order bump (headline, price, link), an upsell, and payment plans (e.g. 4 weekly payments of $50, or 3 monthly payments of $70; one-time prices only). Then create it all in one `setup_checkout` call and give the user the link to preview and publish. To add or change plans later, pass `paymentPlans` to `update_checkout`.

**How are sales going?** `revenue_summary`, then `list_orders` or `top_customers` for detail, and `traffic_sources` for where buyers came from. CLI: `swipefast revenue --days 30`.

**Improve a checkout.** Read it with `get_product` and its numbers with `offer_stats`. If the user has performance rules, start with `list_findings`. Propose one change at a time, with the reason from the numbers, and make it with `update_checkout`, `update_order_bump` or `update_upsell`. Mark the finding done with `resolve_finding`.

**Add a lesson to a course.** `list_courses` for the course and module ids, then `add_lesson` with a title, Markdown text and an optional video link. A lesson for a live course waits for approval.

**Email follow-up.** "Order bump buyers to sequence X, upsell buyers to Y, everyone who buys to Z" is three `add_email_rule` calls, one per `when` (`order_bump`, `upsell`, `sale`; also `refund` and `subscription_cancelled`). Call `list_email_options` first for the exact tag and sequence names in their connected email tool (Kit, Mailchimp, ActiveCampaign, beehiiv or MailerLite), and confirm the plan before adding rules, because joining a sequence can start emails to buyers. `list_email_rules` and `remove_email_rule` read and undo them.

**A launch coupon.** `create_coupon` with the code, the discount and, if they gave one, an end date.

## Links

- Setup for each AI app: https://swipefast.io/agents
- Every tool and how sign-in works: https://swipefast.io/developers/mcp
- Is Swipefast up? https://swipefast.io/status
