import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export interface Config {
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
  if (!existsSync(CONFIG_PATH)) return {};
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
};

export const writeConfig = (config: Config) => {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};
