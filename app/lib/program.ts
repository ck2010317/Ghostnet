import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import IDL from "./ghostnet.json";
import { getGamePDA, getPlayerPDA, parseGameAccount, parsePlayerAccount, GameState, PlayerState } from "./game";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type GhostnetProgram = Program<any>;

export function getProgram(provider: AnchorProvider): GhostnetProgram {
  return new Program(IDL as any, provider);
}

// Helper to call methods without triggering TS deep-instantiation errors
function methods(program: GhostnetProgram): any {
  return (program as any).methods;
}

function account(program: GhostnetProgram): any {
  return (program as any).account;
}

export async function createGame(
  program: GhostnetProgram,
  gameId: number,
  stakeAmount: number,
  creator: PublicKey
) {
  const [gamePDA] = getGamePDA(gameId);

  const tx = await methods(program)
    .createGame(new BN(gameId), new BN(stakeAmount))
    .accounts({
      game: gamePDA,
      creator: creator,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { tx, gamePDA };
}

export async function joinGame(
  program: GhostnetProgram,
  gameId: number,
  player: PublicKey
) {
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, player);

  const tx = await methods(program)
    .joinGame(new BN(gameId))
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: player,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { tx, playerPDA };
}

export async function startGame(
  program: GhostnetProgram,
  gameId: number,
  creator: PublicKey
) {
  const [gamePDA] = getGamePDA(gameId);

  const tx = await methods(program)
    .startGame()
    .accounts({
      game: gamePDA,
      creator: creator,
    })
    .rpc();

  return { tx };
}

export async function moveUnits(
  program: GhostnetProgram,
  gameId: number,
  player: PublicKey,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  unitCount: number
) {
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, player);

  const tx = await methods(program)
    .moveUnits(new BN(gameId), fromX, fromY, toX, toY, unitCount)
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: player,
    })
    .rpc();

  return { tx };
}

export async function buildDefense(
  program: GhostnetProgram,
  gameId: number,
  player: PublicKey,
  x: number,
  y: number
) {
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, player);

  const tx = await methods(program)
    .buildDefense(new BN(gameId), x, y)
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: player,
    })
    .rpc();

  return { tx };
}

export async function trainUnits(
  program: GhostnetProgram,
  gameId: number,
  player: PublicKey,
  x: number,
  y: number,
  count: number
) {
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, player);

  const tx = await methods(program)
    .trainUnits(new BN(gameId), x, y, count)
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: player,
    })
    .rpc();

  return { tx };
}

export async function collectResources(
  program: GhostnetProgram,
  gameId: number,
  player: PublicKey
) {
  const [gamePDA] = getGamePDA(gameId);
  const [playerPDA] = getPlayerPDA(gameId, player);

  const tx = await methods(program)
    .collectResources(new BN(gameId))
    .accounts({
      game: gamePDA,
      playerState: playerPDA,
      player: player,
    })
    .rpc();

  return { tx };
}

export async function setStrategy(
  program: GhostnetProgram,
  gameId: number,
  player: PublicKey,
  mode: string
) {
  const [playerPDA] = getPlayerPDA(gameId, player);

  const modeArg =
    mode === "aggressive" ? { aggressive: {} } :
    mode === "defensive" ? { defensive: {} } :
    mode === "economic" ? { economic: {} } :
    { balanced: {} };

  const tx = await methods(program)
    .setStrategy(new BN(gameId), modeArg)
    .accounts({
      playerState: playerPDA,
      player: player,
    })
    .rpc();

  return { tx };
}

export async function endGame(
  program: GhostnetProgram,
  gameId: number,
  authority: PublicKey
) {
  const [gamePDA] = getGamePDA(gameId);

  const tx = await methods(program)
    .endGame()
    .accounts({
      game: gamePDA,
      authority: authority,
    })
    .rpc();

  return { tx };
}

export async function fetchGameState(
  program: GhostnetProgram,
  gameId: number
): Promise<GameState | null> {
  const [gamePDA] = getGamePDA(gameId);
  try {
    const data = await account(program).game.fetch(gamePDA);
    return parseGameAccount(data);
  } catch {
    return null;
  }
}

export async function fetchPlayerState(
  program: GhostnetProgram,
  gameId: number,
  player: PublicKey
): Promise<PlayerState | null> {
  const [playerPDA] = getPlayerPDA(gameId, player);
  try {
    const data = await account(program).playerState.fetch(playerPDA);
    return parsePlayerAccount(data);
  } catch {
    return null;
  }
}
