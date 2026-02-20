---
name: ghostnet-territories
description: "Play Ghostnet Territories — a real-time on-chain strategy game on Solana using MagicBlock Ephemeral Rollups. Create games, join battles, move units, train soldiers, build defenses, and conquer territory. Supports natural language commands via WhatsApp/Telegram. Use when user wants to play Ghostnet, manage a territory game, or interact with on-chain strategy gaming."
metadata:
  openclaw:
    emoji: "👻"
    homepage: "https://github.com/ghostnet-territories"
    requires:
      bins: ["node", "solana"]
      env:
        - SOLANA_PRIVATE_KEY
        - HELIUS_API_KEY
      modules: ["@solana/web3.js", "@coral-xyz/anchor"]
    primaryEnv: SOLANA_PRIVATE_KEY
    install:
      - id: solana-cli
        kind: shell
        command: "sh -c \"$(curl -sSfL https://release.solana.com/stable/install)\""
        bins: ["solana"]
        label: "Install Solana CLI"
      - id: node-deps
        kind: npm
        module: "@solana/web3.js"
        label: "Install Solana Web3"
---

# Ghostnet Territories 👻⚔️

A real-time on-chain territory control strategy game built on **Solana** using **MagicBlock Ephemeral Rollups** for privacy and speed.

## What You Can Do

| You say | What happens |
|---------|--------------|
| "Create a new game" | Creates a game on Solana devnet and gives you a Game ID |
| "Join game 42" | Joins an existing game |
| "Start the game" | Starts the game (creator only, needs 2+ players) |
| "Move units from 2,3 to 3,3" | Moves your units to an adjacent tile |
| "Train 2 units at 4,4" | Trains new soldiers at your tile (costs gold) |
| "Build defense at 1,1" | Builds a fortification (costs wood) |
| "Collect resources" | Harvests gold/wood from all your tiles |
| "Set strategy aggressive" | Changes AI strategy mode |
| "Status" | Shows your resources, score, and game state |
| "Help" | Lists all available commands |

## Getting Started

### 1. Set Up Your Wallet

Set your Solana private key in OpenClaw config:

```json
{
  "skills": {
    "entries": {
      "ghostnet-territories": {
        "apiKey": "your_solana_private_key_base58"
      }
    }
  }
}
```

### 2. Fund Your Wallet (Devnet)

```bash
solana airdrop 2 --url devnet
```

### 3. Play!

Just describe what you want to do in plain English. The skill handles all on-chain transactions.

## Game Overview

### Map
- **8×8 grid** of tiles
- Each tile can be: Empty, Owned (by a player), or a Resource tile
- Tiles have units (soldiers) and defense levels

### Resources
- **Gold** (💰): Used to train units. Start with 100.
- **Wood** (🪵): Used to build defenses. Start with 50.
- Collect resources from tiles you own.

### Units
- Train units at your tiles (costs 25 gold each)
- Move units to adjacent tiles (8 directions)
- Attack enemy tiles by moving into them
- Max 20 units total per player

### Strategy Modes
- **Balanced** ⚖️ — Default, equal focus
- **Aggressive** 🔥 — Prioritize attacks and territory capture
- **Defensive** 🛡️ — Focus on fortifications and holding ground
- **Economic** 💰 — Maximize resource collection

### Win Condition
- Highest score when the game ends
- Score = tiles owned + units alive + resources collected

## Architecture

- **Program ID:** `9LuS7xu5DLUac1sbFsF2uBYAdnfJrrs1C2JHgdYfjmtQ`
- **Network:** Solana Devnet
- **Privacy:** MagicBlock TEE Ephemeral Rollups (moves are hidden until resolved)
- **Delegation Program:** `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`

## CLI Commands

All commands can be run via the scripts in `scripts/`:

```bash
# Create a new game
node scripts/ghostnet-cli.mjs create --stake 0

# Join a game
node scripts/ghostnet-cli.mjs join --game 42

# Start a game
node scripts/ghostnet-cli.mjs start --game 42

# Move units
node scripts/ghostnet-cli.mjs move --game 42 --from 2,3 --to 3,3 --units 3

# Train units
node scripts/ghostnet-cli.mjs train --game 42 --at 4,4 --count 2

# Build defense
node scripts/ghostnet-cli.mjs defend --game 42 --at 1,1

# Collect resources
node scripts/ghostnet-cli.mjs collect --game 42

# Set strategy
node scripts/ghostnet-cli.mjs strategy --game 42 --mode aggressive

# Get game status
node scripts/ghostnet-cli.mjs status --game 42
```

## Web UI

The full game also has a web interface at `http://localhost:3000` when running locally:

```bash
cd app && npm run dev
```

Features:
- Interactive 8×8 game board with fog of war
- Real-time resource and score tracking
- Agent chat panel for natural language commands
- Wallet connection via Phantom/Solflare
- Auto-refresh game state every 3 seconds

## Security

- Private keys never leave your local environment
- All transactions signed locally
- MagicBlock TEE ensures move privacy on-chain
- Devnet only — no real funds at risk

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Wallet not funded" | Run `solana airdrop 2 --url devnet` |
| "Game not found" | Check the game ID is correct |
| "Not your turn" | Wait for other players or check game status |
| "Insufficient resources" | Collect resources first, then try again |
| Transaction timeout | Retry — devnet can be slow sometimes |

## Links

- **Program:** [Explorer](https://explorer.solana.com/address/9LuS7xu5DLUac1sbFsF2uBYAdnfJrrs1C2JHgdYfjmtQ?cluster=devnet)
- **MagicBlock:** [magicblock.gg](https://magicblock.gg)
- **Web UI:** `http://localhost:3000`
