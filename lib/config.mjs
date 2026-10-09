// Where the CLI keeps your API key: ~/.config/swipefast/config.json, readable
// only by you. SWIPEFAST_API_KEY in the environment wins over it.
import { mkdir, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const dirFor = (dir) => dir ?? join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "swipefast");

export async function readConfig(dir) {
  try { return JSON.parse(await readFile(join(dirFor(dir), "config.json"), "utf8")); }
  catch { return {}; }
}

export async function writeConfig(config, dir) {
  const d = dirFor(dir);
  await mkdir(d, { recursive: true, mode: 0o700 });
  const file = join(d, "config.json");
  await writeFile(file, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  await chmod(file, 0o600);
}

export async function clearConfig(dir) {
  await rm(join(dirFor(dir), "config.json"), { force: true });
}
