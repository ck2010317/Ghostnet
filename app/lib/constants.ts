import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("9LuS7xu5DLUac1sbFsF2uBYAdnfJrrs1C2JHgdYfjmtQ");
export const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

// MagicBlock ER endpoints
export const ER_ENDPOINT_DEVNET_US = "https://devnet-us.magicblock.app";
export const ER_ENDPOINT_DEVNET_EU = "https://devnet-eu.magicblock.app";
export const ER_ENDPOINT_DEVNET_TEE = "https://tee.magicblock.app";

export const GRID_SIZE = 8;
export const MAX_PLAYERS = 4;
export const MAX_UNITS = 20;
export const INITIAL_GOLD = 100;
export const INITIAL_WOOD = 50;
export const UNIT_COST_GOLD = 25;
export const DEFENSE_COST_WOOD = 30;

export const PLAYER_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B"];
export const PLAYER_LABELS = ["Blue", "Red", "Green", "Yellow"];
export const PLAYER_EMOJIS = ["🔵", "🔴", "🟢", "🟡"];

export const GAME_SEED = new TextEncoder().encode("game");
export const PLAYER_SEED = new TextEncoder().encode("player");
