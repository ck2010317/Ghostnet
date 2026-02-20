"use client";

import { useState, useCallback, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import GameBoard from "@/components/GameBoard";
import PlayerPanel from "@/components/PlayerPanel";
import AgentChat, { ChatMessage } from "@/components/AgentChat";
import GameInfo from "@/components/GameInfo";
import Lobby from "@/components/Lobby";
import {
  getProgram,
  createGame,
  joinGame,
  startGame,
  moveUnits,
  buildDefense,
  trainUnits,
  collectResources,
  setStrategy,
  fetchGameState,
  fetchPlayerState,
} from "@/lib/program";
import { GameState, PlayerState, TileState } from "@/lib/game";

export default function GamePage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fogOfWar, setFogOfWar] = useState(true);
  const [view, setView] = useState<"lobby" | "game">("lobby");

  const addAgentMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "agent", text, timestamp: new Date() }]);
  }, []);

  const getProvider = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      throw new Error("Wallet not connected");
    }
    return new AnchorProvider(
      connection,
      wallet as never,
      { commitment: "confirmed" }
    );
  }, [connection, wallet]);

  // Refresh game state
  const refreshGameState = useCallback(async () => {
    if (!currentGameId || !wallet.publicKey) return;
    try {
      const provider = getProvider();
      const program = getProgram(provider);
      const gs = await fetchGameState(program, currentGameId);
      setGameState(gs);
      const ps = await fetchPlayerState(program, currentGameId, wallet.publicKey);
      setPlayerState(ps);
    } catch (e) {
      console.error("Refresh error:", e);
    }
  }, [currentGameId, wallet.publicKey, getProvider]);

  // Auto-refresh every 3s when in game
  useEffect(() => {
    if (view !== "game" || !currentGameId) return;
    const interval = setInterval(refreshGameState, 3000);
    return () => clearInterval(interval);
  }, [view, currentGameId, refreshGameState]);

  const handleCreateGame = async (gameId: number, stake: number) => {
    if (!wallet.publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getProvider();
      const program = getProgram(provider);
      await createGame(program, gameId, stake, wallet.publicKey);

      // Auto-join after creating
      await joinGame(program, gameId, wallet.publicKey);

      setCurrentGameId(gameId);
      await refreshGameStateManual(program, gameId);
      addAgentMessage(`Game #${gameId} created! Share this ID with other players so they can join. You need at least 2 players to start.`);
      setView("game");
    } catch (e: unknown) {
      setError((e as Error).message);
      console.error(e);
    }
    setLoading(false);
  };

  const handleJoinGame = async (gameId: number) => {
    if (!wallet.publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getProvider();
      const program = getProgram(provider);
      await joinGame(program, gameId, wallet.publicKey);

      setCurrentGameId(gameId);
      await refreshGameStateManual(program, gameId);
      addAgentMessage(`Joined game #${gameId}! Waiting for the creator to start the game.`);
      setView("game");
    } catch (e: unknown) {
      setError((e as Error).message);
      console.error(e);
    }
    setLoading(false);
  };

  const handleStartGame = async (gameId: number) => {
    if (!wallet.publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getProvider();
      const program = getProgram(provider);
      await startGame(program, gameId, wallet.publicKey);

      setCurrentGameId(gameId);
      await refreshGameStateManual(program, gameId);
      addAgentMessage(`Game #${gameId} started! 🎮 You can now move units, train soldiers, and conquer territory. Select a tile to begin.`);
      setView("game");
    } catch (e: unknown) {
      setError((e as Error).message);
      console.error(e);
    }
    setLoading(false);
  };

  const refreshGameStateManual = async (program: ReturnType<typeof getProgram>, gameId: number) => {
    const gs = await fetchGameState(program, gameId);
    setGameState(gs);
    if (wallet.publicKey) {
      const ps = await fetchPlayerState(program, gameId, wallet.publicKey);
      setPlayerState(ps);
    }
  };

  const handleTileClick = async (x: number, y: number) => {
    if (!gameState || !playerState || !wallet.publicKey || !currentGameId) return;
    if (gameState.status !== "active") return;

    const tile = gameState.grid[y][x];

    // If we have a selected tile, try to move
    if (selectedTile) {
      const fromTile = gameState.grid[selectedTile.y][selectedTile.x];
      if (fromTile.kind === "owned" && fromTile.player === playerState.playerIndex) {
        const dx = Math.abs(x - selectedTile.x);
        const dy = Math.abs(y - selectedTile.y);
        if (dx <= 1 && dy <= 1 && (dx + dy) > 0) {
          setLoading(true);
          try {
            const provider = getProvider();
            const program = getProgram(provider);
            const unitsToMove = Math.max(1, fromTile.units - 1);
            await moveUnits(
              program,
              currentGameId,
              wallet.publicKey,
              selectedTile.x,
              selectedTile.y,
              x,
              y,
              unitsToMove
            );

            const destTile = gameState.grid[y][x];
            if (destTile.kind === "owned" && destTile.player !== playerState.playerIndex) {
              addAgentMessage(`⚔️ Attacked (${x},${y}) with ${unitsToMove} units! Combat resolved.`);
            } else if (destTile.kind === "resource") {
              addAgentMessage(`💰 Captured resource at (${x},${y})! Resources collected.`);
            } else {
              addAgentMessage(`➡️ Moved ${unitsToMove} units to (${x},${y}).`);
            }

            await refreshGameState();
          } catch (e: unknown) {
            addAgentMessage(`❌ Move failed: ${(e as Error).message?.slice(0, 100)}`);
          }
          setLoading(false);
          setSelectedTile(null);
          return;
        }
      }
    }

    // Select tile
    if (tile.kind === "owned" && tile.player === playerState.playerIndex && tile.units > 0) {
      setSelectedTile({ x, y });
      addAgentMessage(`Selected tile (${x},${y}) — ${tile.units} units. Click an adjacent tile to move/attack.`);
    } else {
      setSelectedTile(null);
    }
  };

  const handleTrainUnits = async () => {
    if (!selectedTile || !wallet.publicKey || !currentGameId) {
      addAgentMessage("Select one of your tiles first to train units there.");
      return;
    }
    setLoading(true);
    try {
      const provider = getProvider();
      const program = getProgram(provider);
      await trainUnits(program, currentGameId, wallet.publicKey, selectedTile.x, selectedTile.y, 1);
      addAgentMessage(`⚔️ Trained 1 unit at (${selectedTile.x},${selectedTile.y})!`);
      await refreshGameState();
    } catch (e: unknown) {
      addAgentMessage(`❌ Training failed: ${(e as Error).message?.slice(0, 100)}`);
    }
    setLoading(false);
  };

  const handleBuildDefense = async () => {
    if (!selectedTile || !wallet.publicKey || !currentGameId) {
      addAgentMessage("Select one of your tiles first to build defense there.");
      return;
    }
    setLoading(true);
    try {
      const provider = getProvider();
      const program = getProgram(provider);
      await buildDefense(program, currentGameId, wallet.publicKey, selectedTile.x, selectedTile.y);
      addAgentMessage(`🏰 Defense built at (${selectedTile.x},${selectedTile.y})!`);
      await refreshGameState();
    } catch (e: unknown) {
      addAgentMessage(`❌ Build failed: ${(e as Error).message?.slice(0, 100)}`);
    }
    setLoading(false);
  };

  const handleCollectResources = async () => {
    if (!wallet.publicKey || !currentGameId) return;
    setLoading(true);
    try {
      const provider = getProvider();
      const program = getProgram(provider);
      await collectResources(program, currentGameId, wallet.publicKey);
      addAgentMessage("📦 Resources collected from all your tiles!");
      await refreshGameState();
    } catch (e: unknown) {
      addAgentMessage(`❌ Collection failed: ${(e as Error).message?.slice(0, 100)}`);
    }
    setLoading(false);
  };

  const handleSetStrategy = async (mode: string) => {
    if (!wallet.publicKey || !currentGameId) return;
    setLoading(true);
    try {
      const provider = getProvider();
      const program = getProgram(provider);
      await setStrategy(program, currentGameId, wallet.publicKey, mode);
      addAgentMessage(`🧠 Strategy changed to ${mode}. Agent adapting behavior...`);
      await refreshGameState();
    } catch (e: unknown) {
      addAgentMessage(`❌ Strategy change failed: ${(e as Error).message?.slice(0, 100)}`);
    }
    setLoading(false);
  };

  const handleSendMessage = (msg: string) => {
    setMessages((prev) => [...prev, { role: "user", text: msg, timestamp: new Date() }]);

    // Simple NLP for agent commands
    const lower = msg.toLowerCase();
    if (lower.includes("attack") || lower.includes("aggressive")) {
      handleSetStrategy("aggressive");
      addAgentMessage("🔥 Switching to aggressive mode. Prioritizing enemy territory capture.");
    } else if (lower.includes("defend") || lower.includes("defensive")) {
      handleSetStrategy("defensive");
      addAgentMessage("🛡️ Switching to defensive mode. Building defenses and holding territory.");
    } else if (lower.includes("resource") || lower.includes("economic") || lower.includes("farm")) {
      handleSetStrategy("economic");
      addAgentMessage("💰 Switching to economic mode. Focusing on resource collection.");
    } else if (lower.includes("balance")) {
      handleSetStrategy("balanced");
      addAgentMessage("⚖️ Switching to balanced mode. Equal focus on attack and defense.");
    } else if (lower.includes("status") || lower.includes("report")) {
      if (playerState && gameState) {
        addAgentMessage(
          `📊 Status Report:\n` +
          `Score: ${playerState.score} pts\n` +
          `Gold: ${playerState.gold} | Wood: ${playerState.wood}\n` +
          `Units: ${playerState.units}/20\n` +
          `Strategy: ${playerState.strategyMode}\n` +
          `Game turn: ${gameState.turn}`
        );
      } else {
        addAgentMessage("No game data available yet.");
      }
    } else if (lower.includes("collect")) {
      handleCollectResources();
    } else if (lower.includes("train")) {
      handleTrainUnits();
    } else if (lower.includes("help")) {
      addAgentMessage(
        "Available commands:\n" +
        "• \"attack\" / \"aggressive\" — aggressive mode\n" +
        "• \"defend\" / \"defensive\" — defensive mode\n" +
        "• \"resource\" / \"farm\" — economic mode\n" +
        "• \"balance\" — balanced mode\n" +
        "• \"status\" — get status report\n" +
        "• \"collect\" — collect resources\n" +
        "• \"train\" — train a unit on selected tile"
      );
    } else {
      addAgentMessage(`Understood: "${msg}". Type "help" for available commands.`);
    }
  };

  const playerScores = playerState
    ? [{ index: playerState.playerIndex, score: playerState.score, isAlive: playerState.isAlive }]
    : [];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              👻 GHOSTNET
            </h1>
            <span className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-0.5">
              Powered by MagicBlock
            </span>
          </div>

          <div className="flex items-center gap-3">
            {view === "game" && (
              <button
                onClick={() => setView("lobby")}
                className="text-sm text-gray-400 hover:text-white transition"
              >
                ← Lobby
              </button>
            )}
            <button
              onClick={() => setFogOfWar(!fogOfWar)}
              className={`text-xs px-3 py-1 rounded-lg transition ${
                fogOfWar ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400"
              }`}
            >
              {fogOfWar ? "🌫️ Fog ON" : "👁️ Fog OFF"}
            </button>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-4 py-2 text-center">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="bg-blue-900/30 border-b border-blue-700 px-4 py-1 text-center">
          <span className="text-blue-400 text-sm animate-pulse">⏳ Processing transaction...</span>
        </div>
      )}

      {/* Main Content */}
      {view === "lobby" ? (
        <Lobby
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          onStartGame={handleStartGame}
          isConnected={!!wallet.publicKey}
          loading={loading}
        />
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left panel */}
            <div className="lg:col-span-3 space-y-4">
              <GameInfo game={gameState} playerScores={playerScores} />
              <PlayerPanel
                playerState={playerState}
                onTrainUnits={handleTrainUnits}
                onBuildDefense={handleBuildDefense}
                onCollectResources={handleCollectResources}
                onSetStrategy={handleSetStrategy}
              />
            </div>

            {/* Game Board */}
            <div className="lg:col-span-6 flex justify-center">
              {gameState ? (
                <GameBoard
                  grid={gameState.grid}
                  playerIndex={playerState?.playerIndex ?? 0}
                  onTileClick={handleTileClick}
                  selectedTile={selectedTile}
                  fogOfWar={fogOfWar}
                />
              ) : (
                <div className="flex items-center justify-center h-96">
                  <p className="text-gray-500">Loading game state...</p>
                </div>
              )}
            </div>

            {/* Right panel - Agent Chat */}
            <div className="lg:col-span-3">
              <AgentChat
                messages={messages}
                onSendMessage={handleSendMessage}
                agentStatus={
                  playerState
                    ? `${playerState.strategyMode} mode`
                    : "standby"
                }
              />
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-gray-500">
          <span>Ghostnet Territories — Built with MagicBlock Ephemeral Rollups + OpenClaw</span>
          <span>Solana Devnet</span>
        </div>
      </footer>
    </div>
  );
}
