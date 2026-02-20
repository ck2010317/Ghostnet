import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { PROGRAM_ID, GAME_SEED, PLAYER_SEED } from "./constants";

/** Encode a number as 8-byte little-endian Uint8Array (browser-safe, no BigInt Buffer methods) */
function encodeU64LE(value: number): Uint8Array {
  const bn = new BN(value);
  const arr = bn.toArray("le", 8); // little-endian, padded to 8 bytes
  return new Uint8Array(arr);
}

export function getGamePDA(gameId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [GAME_SEED, encodeU64LE(gameId)],
    PROGRAM_ID
  );
}

export function getPlayerPDA(gameId: number, player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PLAYER_SEED, encodeU64LE(gameId), player.toBuffer()],
    PROGRAM_ID
  );
}

export type TileState =
  | { kind: "empty" }
  | { kind: "owned"; player: number; units: number; hasDefense: boolean; hasMine: boolean }
  | { kind: "resource"; resourceType: "gold" | "wood"; amount: number };

export type GameStatus = "lobby" | "active" | "finished";

export interface GameState {
  gameId: number;
  creator: PublicKey;
  stakeAmount: number;
  playerCount: number;
  status: GameStatus;
  turn: number;
  winner: PublicKey | null;
  grid: TileState[][];
  createdAt: number;
  startedAt: number;
  finishedAt: number;
}

export interface PlayerState {
  gameId: number;
  player: PublicKey;
  playerIndex: number;
  gold: number;
  wood: number;
  units: number;
  score: number;
  isAlive: boolean;
  strategyMode: "aggressive" | "defensive" | "balanced" | "economic";
}

export function parseGameStatus(raw: Record<string, unknown>): GameStatus {
  if ("lobby" in raw) return "lobby";
  if ("active" in raw) return "active";
  if ("finished" in raw) return "finished";
  return "lobby";
}

export function parseTileState(raw: Record<string, unknown>): TileState {
  if ("empty" in raw) return { kind: "empty" };
  if ("owned" in raw) {
    const o = raw.owned as Record<string, unknown>;
    return {
      kind: "owned",
      player: o.player as number,
      units: o.units as number,
      hasDefense: o.hasDefense as boolean,
      hasMine: o.hasMine as boolean,
    };
  }
  if ("resource" in raw) {
    const r = raw.resource as Record<string, unknown>;
    const rt = r.resourceType as Record<string, unknown>;
    return {
      kind: "resource",
      resourceType: "gold" in rt ? "gold" : "wood",
      amount: (r.amount as { toNumber?: () => number })?.toNumber?.() ?? (r.amount as number),
    };
  }
  return { kind: "empty" };
}

export function parseStrategyMode(raw: Record<string, unknown>): PlayerState["strategyMode"] {
  if ("aggressive" in raw) return "aggressive";
  if ("defensive" in raw) return "defensive";
  if ("balanced" in raw) return "balanced";
  if ("economic" in raw) return "economic";
  return "balanced";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGameAccount(data: any): GameState {
  return {
    gameId: data.gameId?.toNumber?.() ?? Number(data.gameId),
    creator: data.creator,
    stakeAmount: data.stakeAmount?.toNumber?.() ?? Number(data.stakeAmount),
    playerCount: data.playerCount,
    status: parseGameStatus(data.status),
    turn: data.turnNumber?.toNumber?.() ?? data.turn?.toNumber?.() ?? Number(data.turn ?? 0),
    winner: data.winner ?? null,
    grid: (data.grid as Record<string, unknown>[][]).map((row) =>
      row.map((tile) => parseTileState(tile))
    ),
    createdAt: data.createdAt?.toNumber?.() ?? Number(data.createdAt),
    startedAt: data.startedAt?.toNumber?.() ?? Number(data.startedAt),
    finishedAt: data.finishedAt?.toNumber?.() ?? Number(data.finishedAt),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePlayerAccount(data: any): PlayerState {
  return {
    gameId: data.gameId?.toNumber?.() ?? Number(data.gameId),
    player: data.player,
    playerIndex: data.playerIndex,
    gold: data.gold?.toNumber?.() ?? Number(data.gold),
    wood: data.wood?.toNumber?.() ?? Number(data.wood),
    units: data.units,
    score: data.score?.toNumber?.() ?? Number(data.score),
    isAlive: data.isAlive,
    strategyMode: parseStrategyMode(data.strategyMode),
  };
}
