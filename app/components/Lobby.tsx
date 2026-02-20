"use client";

import { useState, useEffect } from "react";

interface LobbyProps {
  onCreateGame: (gameId: number, stake: number) => Promise<void>;
  onJoinGame: (gameId: number) => Promise<void>;
  onStartGame: (gameId: number) => Promise<void>;
  isConnected: boolean;
  loading: boolean;
}

export default function Lobby({
  onCreateGame,
  onJoinGame,
  onStartGame,
  isConnected,
  loading,
}: LobbyProps) {
  const [gameId, setGameId] = useState(1);

  // Generate random game ID only on client to avoid hydration mismatch
  useEffect(() => {
    setGameId(Math.floor(Math.random() * 100000));
  }, []);
  const [joinGameId, setJoinGameId] = useState("");
  const [stake, setStake] = useState(0);
  const [tab, setTab] = useState<"create" | "join">("create");

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-gray-800/80 rounded-2xl border border-gray-700 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-3 text-sm font-bold transition ${
              tab === "create"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            🎮 Create Game
          </button>
          <button
            onClick={() => setTab("join")}
            className={`flex-1 py-3 text-sm font-bold transition ${
              tab === "join"
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            🤝 Join Game
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!isConnected && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-center">
              <p className="text-red-400 text-sm">Connect your wallet to play</p>
            </div>
          )}

          {tab === "create" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Game ID</label>
                <input
                  type="number"
                  value={gameId}
                  onChange={(e) => setGameId(Number(e.target.value))}
                  className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Stake (SOL) — 0 for free game
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => onCreateGame(gameId, Math.floor(stake * 1_000_000_000))}
                disabled={!isConnected || loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition"
              >
                {loading ? "Creating..." : "🚀 Create Game"}
              </button>
              <button
                onClick={() => onStartGame(gameId)}
                disabled={!isConnected || loading}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition"
              >
                {loading ? "Starting..." : "▶️ Start Game"}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Game ID to Join</label>
                <input
                  type="number"
                  value={joinGameId}
                  onChange={(e) => setJoinGameId(e.target.value)}
                  placeholder="Enter game ID..."
                  className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => onJoinGame(Number(joinGameId))}
                disabled={!isConnected || loading || !joinGameId}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition"
              >
                {loading ? "Joining..." : "🤝 Join Game"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
