import { AtpSessionData } from "@atproto/api";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const DEFAULT_SERVICE_URL = "https://bsky.social"

export type Account = {
  did: string;
  handle: string
  serviceUrl?: string;
}

export interface Config {
  accounts: Account[];
  pdsUrl?: string;
  bluesky?: Partial<AtpSessionData>;
  storacha?: {
    email: `${string}@${string}`,
  };
  dataType?: "json" | "car"
}

export const CONFIG_PATH = path.join(homedir(), ".bsky-backup-config.json");

export const readConfig = (): Config => {
  if (!existsSync(CONFIG_PATH)) return { accounts: [] };
  try {
    const data = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return {
      accounts: [],
      pdsUrl: DEFAULT_SERVICE_URL,
      ...data,
    };
  } catch (error) {
    console.error("Failed to read config:", error);
    return { accounts: [] };
  }
};

export const writeConfig = (config: Config) => {
  try {
    mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    const existing = readConfig();
    const merged = {
      ...existing,
      ...config,
      accounts: config.accounts ?? existing.accounts,
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  } catch (error) {
    console.error("Failed to write config:", error);
  }
};
