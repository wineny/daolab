import { REST, Routes } from "discord.js";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// --- Load .env ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, ".env");
try {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("[env] .env not found, using process env");
}

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN and CLIENT_ID are required.");
  process.exit(1);
}

// --- Collect command data ---
const commands = [];
const commandsPath = resolve(__dirname, "commands");
const commandFiles = readdirSync(commandsPath).filter((f) =>
  f.endsWith(".mjs")
);

for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  if (command.data) {
    commands.push(command.data.toJSON());
  }
}

// --- Deploy ---
const rest = new REST().setToken(DISCORD_TOKEN);

try {
  console.log(`[deploy] Deploying ${commands.length} command(s)...`);

  if (GUILD_ID) {
    // Guild-specific (instant, for development)
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log(`[deploy] Guild commands deployed (${GUILD_ID})`);
  } else {
    // Global (takes ~1hr to propagate)
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });
    console.log("[deploy] Global commands deployed");
  }
} catch (error) {
  console.error("[deploy] Failed:", error);
}
