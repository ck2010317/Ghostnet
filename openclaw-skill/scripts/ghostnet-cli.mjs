#!/usr/bin/env node
/**
 * Ghostnet Territories CLI — OpenClaw Skill Script
 *
 * Usage:
 *   node ghostnet-cli.mjs <command> [options]
 *
 * Commands:
 *   create   --stake <lamports>
 *   join     --game <id>
 *   start    --game <id>
 *   move     --game <id> --from <x,y> --to <x,y> --units <n>
 *   train    --game <id> --at <x,y> --count <n>
 *   defend   --game <id> --at <x,y>
 *   collect  --game <id>
 *   strategy --game <id> --mode <balanced|aggressive|defensive|economic>
 *   status   --game <id>
 *
 * Environment:
 *   SOLANA_PRIVATE_KEY  — Base58-encoded private key
 *   HELIUS_API_KEY      — Helius RPC API key (optional, falls back to public devnet)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bs58 from "bs58";

// ─── Constants ───────────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey("9LuS7xu5DLUac1sbFsF2uBYAdnfJrrs1C2JHgdYfjmtQ");
const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const GRID_SIZE = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getRpcUrl() {
  const apiKey = process.env.HELIUS_API_KEY;
  if (apiKey) return `https://devnet.helius-rpc.com/?api-key=${apiKey}`;
  return "https://api.devnet.solana.com";
}

function getKeypair() {
  const key = process.env.SOLANA_PRIVATE_KEY;
  if (!key) {
    // Fallback: try default Solana CLI keypair
    try {
      const home = process.env.HOME || process.env.USERPROFILE;
      const keyfile = join(home, ".config", "solana", "id.json");
      const raw = JSON.parse(readFileSync(keyfile, "utf-8"));
      return Keypair.fromSecretKey(Uint8Array.from(raw));
    } catch {
      console.error("❌ No SOLANA_PRIVATE_KEY set and no default keypair found.");
      console.error("   Set SOLANA_PRIVATE_KEY=<base58-private-key> or run `solana-keygen new`");
      process.exit(1);
    }
  }
  return Keypair.fromSecretKey(bs58.decode(key));
}

function getGamePDA(gameId) {
  const gameIdBuf = Buffer.alloc(8);
  gameIdBuf.writeBigUInt64LE(BigInt(gameId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("game"), gameIdBuf],
    PROGRAM_ID
  );
}

function getPlayerPDA(gameId, player) {
  const gameIdBuf = Buffer.alloc(8);
  gameIdBuf.writeBigUInt64LE(BigInt(gameId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("player"), gameIdBuf, player.toBuffer()],
    PROGRAM_ID
  );
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
      parsed[key] = val;
      if (val !== true) i++;
    }
  }
  return parsed;
}

// ─── IDL Loader ──────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

let IDL;
try {
  IDL = JSON.parse(readFileSync(join(__dirname, "ghostnet.json"), "utf-8"));
} catch {
  try {
    IDL = JSON.parse(readFileSync(join(__dirname, "..", "target", "idl", "ghostnet.json"), "utf-8"));
  } catch {
    try {
      IDL = JSON.parse(readFileSync(join(__dirname, "..", "app", "lib", "ghostnet.json"), "utf-8"));
    } catch {
      console.error("❌ Could not find IDL file. Run `anchor build` first.");
      process.exit(1);
    }
  }
}

// ─── Anchor-free instruction builder ─────────────────────────────────────────
// We use @coral-xyz/anchor for instruction building

// We'll use @coral-xyz/anchor dynamically
let Program, AnchorProvider, BN, Wallet;

async function loadAnchor() {
  try {
    const anchor = await import("@coral-xyz/anchor");
    const mod = anchor.default || anchor;
    Program = anchor.Program || mod.Program;
    AnchorProvider = anchor.AnchorProvider || mod.AnchorProvider;
    BN = mod.BN;
    Wallet = anchor.Wallet || mod.Wallet;
    if (!BN) {
      const bnjs = await import("bn.js");
      BN = bnjs.default || bnjs;
    }
  } catch (e) {
    console.error("❌ @coral-xyz/anchor not installed. Run: npm install @coral-xyz/anchor");
    console.error("   Detail:", e.message);
    process.exit(1);
  }
}

async function getProgram(connection, keypair) {
  await loadAnchor();

  const wallet = {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(keypair);
      return tx;
    },
    signAllTransactions: async (txs) => {
      txs.forEach((tx) => tx.partialSign(keypair));
      return txs;
    },
  };

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  return new Program(IDL, provider);
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function createGame(connection, keypair, stakeAmount) {
  const program = await getProgram(connection, keypair);
  const gameId = Math.floor(Math.random() * 1000000);
  const [gamePDA] = getGamePDA(gameId);

  const tx = await program.methods
    .createGame(new BN(gameId), new BN(stakeAmount || 0))
    .accounts({
      game: gamePDA,
      creator: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  // Auto-join
  const [playerPDA] = getPlayerPDA(gameId, keypair.publicKey);
  const tx2 = await program.methods
    .joinGame(new BN(gameId))
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`✅ Game created! Game ID: ${gameId}`);
  console.log(`   Create TX: ${tx}`);
  console.log(`   Join TX: ${tx2}`);
  console.log(`   Game PDA: ${gamePDA.toString()}`);
  console.log(`   Share Game ID ${gameId} with other players so they can join.`);
  return gameId;
}

async function joinGame(connection, keypair, gameId) {
  const program = await getProgram(connection, keypair);
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, keypair.publicKey);

  const tx = await program.methods
    .joinGame(new BN(gameId))
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`✅ Joined game #${gameId}!`);
  console.log(`   TX: ${tx}`);
}

async function startGame(connection, keypair, gameId) {
  const program = await getProgram(connection, keypair);
  const [gamePDA] = getGamePDA(gameId);

  const tx = await program.methods
    .startGame()
    .accounts({
      game: gamePDA,
      creator: keypair.publicKey,
    })
    .rpc();

  console.log(`✅ Game #${gameId} started!`);
  console.log(`   TX: ${tx}`);
}

async function moveUnits(connection, keypair, gameId, fromX, fromY, toX, toY, units) {
  const program = await getProgram(connection, keypair);
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, keypair.publicKey);

  const tx = await program.methods
    .moveUnits(new BN(gameId), fromX, fromY, toX, toY, units)
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: keypair.publicKey,
    })
    .rpc();

  console.log(`✅ Moved ${units} units from (${fromX},${fromY}) to (${toX},${toY})`);
  console.log(`   TX: ${tx}`);
}

async function trainUnits(connection, keypair, gameId, x, y, count) {
  const program = await getProgram(connection, keypair);
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, keypair.publicKey);

  const tx = await program.methods
    .trainUnits(new BN(gameId), x, y, count)
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: keypair.publicKey,
    })
    .rpc();

  console.log(`✅ Trained ${count} units at (${x},${y})`);
  console.log(`   TX: ${tx}`);
}

async function buildDefense(connection, keypair, gameId, x, y) {
  const program = await getProgram(connection, keypair);
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, keypair.publicKey);

  const tx = await program.methods
    .buildDefense(new BN(gameId), x, y)
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: keypair.publicKey,
    })
    .rpc();

  console.log(`✅ Defense built at (${x},${y})`);
  console.log(`   TX: ${tx}`);
}

async function collectResources(connection, keypair, gameId) {
  const program = await getProgram(connection, keypair);
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, keypair.publicKey);

  const tx = await program.methods
    .collectResources(new BN(gameId))
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: keypair.publicKey,
    })
    .rpc();

  console.log(`✅ Resources collected!`);
  console.log(`   TX: ${tx}`);
}

async function setStrategy(connection, keypair, gameId, mode) {
  const program = await getProgram(connection, keypair);
  const [playerPDA] = getPlayerPDA(gameId, keypair.publicKey);

  const modeArg =
    mode === "aggressive" ? { aggressive: {} } :
    mode === "defensive" ? { defensive: {} } :
    mode === "economic" ? { economic: {} } :
    { balanced: {} };

  const tx = await program.methods
    .setStrategy(new BN(gameId), modeArg)
    .accounts({
      playerState: playerPDA,
      player: keypair.publicKey,
    })
    .rpc();

  console.log(`✅ Strategy set to: ${mode}`);
  console.log(`   TX: ${tx}`);
}

async function getStatus(connection, keypair, gameId) {
  const program = await getProgram(connection, keypair);
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, keypair.publicKey);

  try {
    const game = await program.account.game.fetch(gamePDA);

    const statusMap = { lobby: "Lobby", active: "Active", finished: "Finished" };
    const status = game.status.lobby ? "Lobby" :
                   game.status.active ? "Active" :
                   game.status.finished ? "Finished" : "Unknown";

    console.log(`\n📊 Game #${gameId} Status`);
    console.log(`${"─".repeat(40)}`);
    console.log(`   Status: ${status}`);
    console.log(`   Players: ${game.playerCount}`);
    console.log(`   Turn: ${game.turn.toString()}`);
    console.log(`   Stake: ${game.stakeAmount.toString()} lamports`);
    console.log(`   Creator: ${game.creator.toString()}`);

    // Count tiles per player
    const tileCounts = {};
    if (game.grid && Array.isArray(game.grid)) {
      for (let i = 0; i < game.grid.length; i++) {
        const tile = game.grid[i];
        if (tile && tile.owned && tile.owned.owner) {
          const key = tile.owned.owner.toString().slice(0, 8);
          tileCounts[key] = (tileCounts[key] || 0) + 1;
        }
      }
    }
    if (Object.keys(tileCounts).length > 0) {
      console.log(`\n   🗺️ Territory:`);
      for (const [k, v] of Object.entries(tileCounts)) {
        console.log(`      ${k}…: ${v} tiles`);
      }
    }

    // Player state
    try {
      const player = await program.account.playerState.fetch(playerPDA);
      console.log(`\n   👤 Your State:`);
      console.log(`      Gold: ${player.gold.toString()}`);
      console.log(`      Wood: ${player.wood.toString()}`);
      console.log(`      Units: ${player.units}`);
      console.log(`      Score: ${player.score.toString()}`);
      console.log(`      Alive: ${player.isAlive}`);

      const stratMode = player.strategyMode.balanced ? "Balanced" :
                        player.strategyMode.aggressive ? "Aggressive" :
                        player.strategyMode.defensive ? "Defensive" :
                        player.strategyMode.economic ? "Economic" : "Unknown";
      console.log(`      Strategy: ${stratMode}`);
    } catch {
      console.log(`\n   ⚠️ You haven't joined this game yet.`);
    }

    console.log();
  } catch (e) {
    console.error(`❌ Game #${gameId} not found. Error: ${e.message}`);
  }
}

// ─── Natural Language Parser ─────────────────────────────────────────────────

async function endGame(connection, keypair, gameId) {
  const program = await getProgram(connection, keypair);
  const [gamePDA] = getGamePDA(gameId);

  const tx = await program.methods
    .endGame()
    .accounts({
      game: gamePDA,
      authority: keypair.publicKey,
    })
    .rpc();

  console.log(`\n🏁 Game #${gameId} ended!`);
  console.log(`   TX: ${tx}`);
}

function parseNaturalLanguage(input) {
  const lower = input.toLowerCase().trim();

  // Create game
  if (/^create\s*(a\s+)?(new\s+)?game/i.test(lower)) {
    const stakeMatch = lower.match(/stake\s+(\d+)/);
    return { command: "create", stake: stakeMatch ? parseInt(stakeMatch[1]) : 0 };
  }

  // Join game
  const joinMatch = lower.match(/join\s+game\s+#?(\d+)/i);
  if (joinMatch) return { command: "join", game: parseInt(joinMatch[1]) };

  // Start game
  const startMatch = lower.match(/start\s+(the\s+)?game\s*#?(\d+)?/i);
  if (startMatch) return { command: "start", game: startMatch[2] ? parseInt(startMatch[2]) : null };

  // Move units
  const moveMatch = lower.match(/move\s+(\d+)?\s*units?\s+(?:from\s+)?(\d+)\s*,\s*(\d+)\s+to\s+(\d+)\s*,\s*(\d+)/i);
  if (moveMatch) {
    return {
      command: "move",
      units: moveMatch[1] ? parseInt(moveMatch[1]) : 1,
      fromX: parseInt(moveMatch[2]),
      fromY: parseInt(moveMatch[3]),
      toX: parseInt(moveMatch[4]),
      toY: parseInt(moveMatch[5]),
    };
  }

  // Train units
  const trainMatch = lower.match(/train\s+(\d+)?\s*units?\s+(?:at\s+)?(\d+)\s*,\s*(\d+)/i);
  if (trainMatch) {
    return {
      command: "train",
      count: trainMatch[1] ? parseInt(trainMatch[1]) : 1,
      x: parseInt(trainMatch[2]),
      y: parseInt(trainMatch[3]),
    };
  }

  // Build defense
  const defendMatch = lower.match(/(?:build\s+)?def(?:ense|end)\s+(?:at\s+)?(\d+)\s*,\s*(\d+)/i);
  if (defendMatch) {
    return { command: "defend", x: parseInt(defendMatch[1]), y: parseInt(defendMatch[2]) };
  }

  // Strategy (check before collect since "farm mode" could match both)
  const stratMatch = lower.match(/(?:set\s+)?strategy\s+(aggressive|defensive|economic|balanced)/i);
  if (stratMatch) return { command: "strategy", mode: stratMatch[1].toLowerCase() };

  if (/aggressive|attack\s+mode/i.test(lower)) return { command: "strategy", mode: "aggressive" };
  if (/defensive|defend\s+mode/i.test(lower)) return { command: "strategy", mode: "defensive" };
  if (/economic|farm\s+mode/i.test(lower)) return { command: "strategy", mode: "economic" };

  // Collect (after strategy so "farm mode" isn't caught here)
  if (/collect|harvest|farm/i.test(lower)) return { command: "collect" };

  // Status
  if (/status|report|info|score/i.test(lower)) return { command: "status" };

  // Help
  if (/help|commands|what can/i.test(lower)) return { command: "help" };

  return null;
}

function showHelp() {
  console.log(`
👻 GHOSTNET TERRITORIES — Available Commands
${"═".repeat(50)}

  create  [--stake <lamports>]          Create a new game
  join    --game <id>                   Join an existing game
  start   --game <id>                   Start the game (creator only)
  move    --game <id> --from x,y --to x,y --units n
                                        Move units between tiles
  train   --game <id> --at x,y --count n
                                        Train soldiers at a tile
  defend  --game <id> --at x,y          Build defense at a tile
  collect --game <id>                   Collect resources
  strategy --game <id> --mode <mode>    Set strategy mode
  status  --game <id>                   View game & player status

Strategy modes: balanced, aggressive, defensive, economic

Natural language also works:
  "Create a new game"
  "Join game 42"
  "Move 3 units from 2,3 to 3,3"
  "Train 2 units at 4,4"
  "Set strategy aggressive"
  "Status"
`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    return;
  }

  const command = args[0];
  const opts = parseArgs(args.slice(1));

  // Check for natural language input (joined args)
  const fullInput = args.join(" ");
  const nlp = parseNaturalLanguage(fullInput);

  const connection = new Connection(getRpcUrl(), "confirmed");
  const keypair = getKeypair();

  console.log(`🔑 Wallet: ${keypair.publicKey.toString()}`);
  console.log(`🌐 RPC: ${getRpcUrl()}\n`);

  try {
    if (command === "create" || nlp?.command === "create") {
      await createGame(connection, keypair, opts.stake || nlp?.stake || 0);
    } else if (command === "join" || nlp?.command === "join") {
      const gameId = parseInt(opts.game || nlp?.game);
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await joinGame(connection, keypair, gameId);
    } else if (command === "start" || nlp?.command === "start") {
      const gameId = parseInt(opts.game || nlp?.game);
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await startGame(connection, keypair, gameId);
    } else if (command === "move" || nlp?.command === "move") {
      const gameId = parseInt(opts.game);
      const from = opts.from?.split(",").map(Number) || [nlp?.fromX, nlp?.fromY];
      const to = opts.to?.split(",").map(Number) || [nlp?.toX, nlp?.toY];
      const units = parseInt(opts.units || nlp?.units || 1);
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await moveUnits(connection, keypair, gameId, from[0], from[1], to[0], to[1], units);
    } else if (command === "train" || nlp?.command === "train") {
      const gameId = parseInt(opts.game);
      const at = opts.at?.split(",").map(Number) || [nlp?.x, nlp?.y];
      const count = parseInt(opts.count || nlp?.count || 1);
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await trainUnits(connection, keypair, gameId, at[0], at[1], count);
    } else if (command === "defend" || nlp?.command === "defend") {
      const gameId = parseInt(opts.game);
      const at = opts.at?.split(",").map(Number) || [nlp?.x, nlp?.y];
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await buildDefense(connection, keypair, gameId, at[0], at[1]);
    } else if (command === "collect" || nlp?.command === "collect") {
      const gameId = parseInt(opts.game);
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await collectResources(connection, keypair, gameId);
    } else if (command === "strategy" || nlp?.command === "strategy") {
      const gameId = parseInt(opts.game);
      const mode = opts.mode || nlp?.mode || "balanced";
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await setStrategy(connection, keypair, gameId, mode);
    } else if (command === "status" || nlp?.command === "status") {
      const gameId = parseInt(opts.game);
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await getStatus(connection, keypair, gameId);
    } else if (command === "help" || nlp?.command === "help") {
      showHelp();
    } else if (command === "end") {
      const gameId = parseInt(opts.game);
      if (!gameId) { console.error("❌ Missing --game <id>"); return; }
      await endGame(connection, keypair, gameId);
    } else {
      console.error(`❌ Unknown command: ${command}`);
      showHelp();
    }
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}`);
    if (e.logs) {
      console.error("\nProgram logs:");
      e.logs.forEach((l) => console.error(`  ${l}`));
    }
    process.exit(1);
  }
}

main();
