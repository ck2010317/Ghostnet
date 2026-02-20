"use client";

import { PLAYER_COLORS, PLAYER_EMOJIS, PLAYER_LABELS } from "@/lib/constants";
import { GameState } from "@/lib/game";

interface GameInfoProps {
  game: GameState | null;
  playerScores: { index: number; score: number; isAlive: boolean }[];
}

export default function GameInfo({ game, playerScores }: GameInfoProps) {
  if (!game) {
    return (
      <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700">
        <p className="text-gray-400 text-sm">No game loaded</p>
      </div>
    );
  }

  const statusColor =
    game.status === "lobby" ? "text-yellow-400" :
    game.status === "active" ? "text-green-400" :
    "text-red-400";

  const statusEmoji =
    game.status === "lobby" ? "⏳" :
    game.status === "active" ? "🟢" :
    "🏁";

  return (
    <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700 space-y-3">
      {/* Game header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          Game #{game.gameId}
        </h2>
        <span className={`text-sm font-bold ${statusColor} uppercase`}>
          {statusEmoji} {game.status}
        </span>
      </div>

      {/* Game stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xs text-gray-400">Players</div>
          <div className="text-lg font-bold text-white">{game.playerCount}/4</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xs text-gray-400">Turn</div>
          <div className="text-lg font-bold text-white">{game.turn}</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xs text-gray-400">Stake</div>
          <div className="text-lg font-bold text-white">
            {(game.stakeAmount / 1_000_000_000).toFixed(2)} SOL
          </div>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scoreboard</h3>
        {playerScores
          .sort((a, b) => b.score - a.score)
          .map((ps) => (
            <div
              key={ps.index}
              className="flex items-center gap-2 bg-gray-700/30 rounded-lg px-3 py-1.5"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: PLAYER_COLORS[ps.index] }}
              />
              <span className="text-sm text-white font-medium">
                {PLAYER_EMOJIS[ps.index]} {PLAYER_LABELS[ps.index]}
              </span>
              <span className="ml-auto text-sm font-bold text-white">
                {ps.score} pts
              </span>
              {!ps.isAlive && (
                <span className="text-xs text-red-400">💀</span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
