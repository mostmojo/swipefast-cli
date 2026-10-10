// A small client for Swipefast's MCP server: the same tools Claude, ChatGPT
// and the other AI apps use, called over HTTPS with your API key.
// No dependencies; needs Node 18+ for fetch.

export const VERSION = "0.2.0";
export const DEFAULT_URL = "https://swipefast.io";

/** Something went wrong, with what to do about it. */
export class SwipefastError extends Error {
  constructor(message, hint = "", code = "") {
    super(message);
    this.hint = hint;
    this.code = code;
  }
}

export function createClient({ apiKey, baseUrl = DEFAULT_URL, fetchImpl = globalThis.fetch }) {
  if (!apiKey) throw new SwipefastError("No API key.", "Run `swipefast login`, or set SWIPEFAST_API_KEY. Your key is in Swipefast under Settings, Your connection key.");
  const endpoint = `${String(baseUrl).replace(/\/+$/, "")}/api/mcp`;
  let id = 0;

  async function rpc(method, params) {
    let res;
    try {
      res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${apiKey}`,
          "user-agent": `swipefast-cli/${VERSION}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, ...(params ? { params } : {}) }),
      });
    } catch (e) {
      throw new SwipefastError(`Couldn't reach ${endpoint}.`, "Check your connection, or https://swipefast.io/status.");
    }
    if (res.status === 401) throw new SwipefastError("Swipefast didn't accept that API key.", "Run `swipefast login` with the key from Settings, Your connection key.");
    if (!res.ok) throw new SwipefastError(`Swipefast answered ${res.status}.`, "Try again in a minute, or check https://swipefast.io/status.");
    const body = await res.json();
    if (body.error) throw new SwipefastError(body.error.message || "Swipefast returned an error.");
    return body.result;
  }

  return {
    /** Every tool your key can use: name, title, whether it only reads. */
    async tools() {
      const result = await rpc("tools/list");
      return result.tools.map((t) => ({ name: t.name, title: t.title, readOnly: !!t.annotations?.readOnlyHint, description: t.description, inputSchema: t.inputSchema }));
    },
    /** Call one tool. Returns its data, or throws a SwipefastError with the hint. */
    async call(name, args = {}) {
      const result = await rpc("tools/call", { name, arguments: args });
      const text = result.content?.[0]?.text ?? "{}";
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (result.isError) throw new SwipefastError(data?.message || String(text), data?.hint || "", data?.code || "");
      return data;
    },
  };
}
