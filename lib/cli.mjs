// The `swipefast` command. Every command is one MCP tool call; `call` runs
// any tool by name, so new tools work here the day they ship.
import { createClient, SwipefastError, VERSION, DEFAULT_URL } from "./client.mjs";
import { readConfig, writeConfig, clearConfig } from "./config.mjs";

const HELP = `swipefast ${VERSION}: your Swipefast checkouts from the terminal

Usage: swipefast <command> [options]

Account
  login [--key <key>]          Save your API key (Settings, Your connection key)
  logout                       Forget the saved key
  whoami                       Your account in one look

Read
  products [--status live|draft]
  product <id-or-slug>         One checkout, with its bump, upsell and links
  orders [--limit 20] [--days 30] [--product <slug>]
  revenue [--days 30]          Revenue, orders and refunds
  stats <id-or-slug> [--days 30]
                               Visits, conversion, bump and upsell take rates
  findings                     What your performance rules flagged
  approval <request-id>        What happened to a change your AI asked for

Ask (the change waits for your approval in Swipefast)
  publish <id-or-slug>         Ask to publish a draft; you confirm it in Swipefast

Anything else
  tools                        Every tool, and whether it reads or writes
  call <tool> [--args '<json>'] [--<name> <value> ...]
                               Run any tool by name

Options
  --json                       Compact JSON, for scripts and agents
  --help, --version

Environment
  SWIPEFAST_API_KEY            Use this key instead of the saved one
  SWIPEFAST_URL                Another Swipefast address (default ${DEFAULT_URL})

New checkouts are drafts. On a live one, anything that touches money waits for your
approval; wording and design apply straight away, and you can roll them back.
Nothing here can publish by itself, refund or move money.
Docs: https://swipefast.io/developers/mcp`;

/** --name value pairs and bare words. Numbers and true/false become values. */
export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [name, inline] = a.slice(2).split(/=(.*)/s, 2);
      const next = argv[i + 1];
      const value = inline !== undefined ? inline : next !== undefined && !next.startsWith("--") ? (i++, next) : true;
      flags[name] = value;
    } else if (a === "-h") flags.help = true;
    else if (a === "-v") flags.version = true;
    else positional.push(a);
  }
  return { positional, flags };
}

const asValue = (v) => (v === "true" ? true : v === "false" ? false : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
const int = (v) => (v === undefined || v === true ? undefined : Number(v));

/** Run one command. Returns the exit code; output goes through `io`. */
export async function main(argv, io = {}) {
  const env = io.env ?? process.env;
  const out = io.stdout ?? ((s) => process.stdout.write(s + "\n"));
  const err = io.stderr ?? ((s) => process.stderr.write(s + "\n"));
  const { positional, flags } = parseArgs(argv);
  const [command, ...rest] = positional;
  const print = (data) => out(flags.json ? JSON.stringify(data) : JSON.stringify(data, null, 2));

  if (flags.version) { out(VERSION); return 0; }
  if (!command || flags.help || command === "help") { out(HELP); return 0; }

  const saved = await readConfig(io.configDir);
  const baseUrl = env.SWIPEFAST_URL || saved.baseUrl || DEFAULT_URL;
  const client = (apiKey) => createClient({ apiKey, baseUrl, fetchImpl: io.fetch });

  try {
    if (command === "login") {
      const key = typeof flags.key === "string" ? flags.key.trim() : (await (io.prompt ?? promptLine)("Paste your Swipefast API key (Settings, Your connection key): ")).trim();
      const tools = await client(key).tools();
      await writeConfig({ ...saved, apiKey: key, baseUrl: env.SWIPEFAST_URL || saved.baseUrl }, io.configDir);
      out(`Signed in. ${tools.length} tools available. Try: swipefast whoami`);
      return 0;
    }
    if (command === "logout") { await clearConfig(io.configDir); out("Signed out. The key is no longer saved here."); return 0; }

    const sf = client(env.SWIPEFAST_API_KEY || saved.apiKey);
    const need = (what) => { if (!rest[0]) throw new SwipefastError(`Which ${what}?`, `Usage: swipefast ${command} <${what}>`); return rest[0]; };
    const days = int(flags.days);

    switch (command) {
      case "whoami": print(await sf.call("account_summary")); break;
      case "products": print(await sf.call("list_products", flags.status ? { status: flags.status } : {})); break;
      case "product": print(await sf.call("get_product", { product: need("id-or-slug") })); break;
      case "orders": print(await sf.call("list_orders", { ...(flags.limit ? { limit: int(flags.limit) } : {}), ...(days ? { days } : {}), ...(flags.product ? { productSlug: flags.product } : {}) })); break;
      case "revenue": print(await sf.call("revenue_summary", days ? { days } : {})); break;
      case "stats": print(await sf.call("offer_stats", { product: need("id-or-slug"), ...(days ? { days } : {}) })); break;
      case "findings": print(await sf.call("list_findings")); break;
      case "approval": print(await sf.call("approval_status", { request: need("request-id") })); break;
      case "publish": print(await sf.call("publish_checkout", { product: need("id-or-slug") })); break;
      case "tools": {
        const tools = await sf.tools();
        if (flags.json) print(tools.map(({ name, title, readOnly }) => ({ name, title, readOnly })));
        else out(tools.map((t) => `${t.readOnly ? "read " : "write"}  ${t.name.padEnd(22)} ${t.title}`).join("\n"));
        break;
      }
      case "call": {
        const name = need("tool");
        let args = {};
        if (typeof flags.args === "string") {
          try { args = JSON.parse(flags.args); } catch { throw new SwipefastError("--args isn't valid JSON.", `Example: swipefast call ${name} --args '{"days": 30}'`); }
        }
        for (const [k, v] of Object.entries(flags)) if (!["args", "json"].includes(k)) args[k] = asValue(v);
        print(await sf.call(name, args));
        break;
      }
      default:
        throw new SwipefastError(`Unknown command: ${command}`, "Run `swipefast --help` for the list, or `swipefast call <tool>` for any tool.");
    }
    return 0;
  } catch (e) {
    if (e instanceof SwipefastError) {
      err(`Error: ${e.message}`);
      if (e.hint) err(e.hint);
      return 1;
    }
    err(`Error: ${e?.message || e}`);
    return 1;
  }
}

async function promptLine(question) {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try { return await rl.question(question); } finally { rl.close(); }
}
