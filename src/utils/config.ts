import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export interface Config {
  accounts: string[];
  pdsUrl?: string;
  bluesky?: {
    accessToken?: string;
    refreshToken?: string;
    did?: string;
  };
  storacha?: {
    apiKey?: string;
  };
}

export const CONFIG_PATH = path.join(homedir(), ".bsky-backup-config.json");

export const readConfig = (): Config => {
  if (!existsSync(CONFIG_PATH)) return { accounts: [] };
  const data = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  return { accounts: [], pdsUrl: "https://bsky.social", ...data };
};

export const writeConfig = (config: Config) => {
  const existing = readConfig();
  const merged = { ...existing, ...config };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
};
