import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
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

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is required. Set it in .env or environment.");
  process.exit(1);
}

// --- Client setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Load commands ---
client.commands = new Collection();
const commandsPath = resolve(__dirname, "commands");
try {
  const commandFiles = readdirSync(commandsPath).filter((f) =>
    f.endsWith(".mjs")
  );
  for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`[cmd] Loaded: /${command.data.name}`);
    }
  }
} catch (err) {
  console.warn("[cmd] No commands directory or failed to load:", err.message);
}

// --- Interaction handler ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[cmd] Error in /${interaction.commandName}:`, error);
    const reply = {
      content: "명령어 실행 중 오류가 발생했어요.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// --- Ready ---
client.once(Events.ClientReady, (c) => {
  console.log(`[bot] Ready! Logged in as ${c.user.tag}`);
  console.log(`[bot] Serving ${c.guilds.cache.size} guild(s)`);
});

// --- Graceful shutdown ---
process.on("SIGINT", () => {
  console.log("[bot] Shutting down...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[bot] Shutting down...");
  client.destroy();
  process.exit(0);
});

// --- Login ---
client.login(DISCORD_TOKEN);
