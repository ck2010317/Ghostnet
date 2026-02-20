"use client";

import { PlayerState } from "@/lib/game";
import { PLAYER_COLORS, PLAYER_EMOJIS, PLAYER_LABELS, UNIT_COST_GOLD, DEFENSE_COST_WOOD } from "@/lib/constants";

interface PlayerPanelProps {
  playerState: PlayerState | null;
  onTrainUnits: () => void;
  onBuildDefense: () => void;
  onCollectResources: () => void;
  onSetStrategy: (mode: string) => void;
}

export default function PlayerPanel({
  playerState,
  onTrainUnits,
  onBuildDefense,
  onCollectResources,
  onSetStrategy,
}: PlayerPanelProps) {
  if (!playerState) {
    return (
      <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700">
        <p className="text-gray-400">Join a game to see your stats</p>
      </div>
    );
  }

  const pi = playerState.playerIndex;

  return (
    <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700 space-y-4">
      {/* Player identity */}
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: PLAYER_COLORS[pi] }}
        />
        <h2 className="text-lg font-bold text-white">
          {PLAYER_EMOJIS[pi]} {PLAYER_LABELS[pi]} Team
        </h2>
        <span className="ml-auto text-sm text-gray-400">
          P{pi}
        </span>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-700/30">
          <div className="text-yellow-400 text-xs font-semibold">💰 GOLD</div>
          <div className="text-2xl font-bold text-yellow-300">{playerState.gold}</div>
        </div>
        <div className="bg-green-900/30 rounded-lg p-3 border border-green-700/30">
          <div className="text-green-400 text-xs font-semibold">🪵 WOOD</div>
          <div className="text-2xl font-bold text-green-300">{playerState.wood}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-700/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Score</div>
          <div className="text-lg font-bold text-white">{playerState.score}</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Units</div>
          <div className="text-lg font-bold text-white">{playerState.units}/20</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Status</div>
          <div className={`text-lg font-bold ${playerState.isAlive ? "text-green-400" : "text-red-400"}`}>
            {playerState.isAlive ? "ALIVE" : "DEAD"}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Actions</h3>
        <button
          onClick={onTrainUnits}
          disabled={playerState.gold < UNIT_COST_GOLD}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-4 rounded-lg transition"
        >
          ⚔️ Train Unit ({UNIT_COST_GOLD} gold)
        </button>
        <button
          onClick={onBuildDefense}
          disabled={playerState.wood < DEFENSE_COST_WOOD}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-4 rounded-lg transition"
        >
          🏰 Build Defense ({DEFENSE_COST_WOOD} wood)
        </button>
        <button
          onClick={onCollectResources}
          className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-semibold py-2 px-4 rounded-lg transition"
        >
          📦 Collect Resources
        </button>
      </div>

      {/* Strategy */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          AI Strategy: <span className="text-white capitalize">{playerState.strategyMode}</span>
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {["aggressive", "defensive", "balanced", "economic"].map((mode) => (
            <button
              key={mode}
              onClick={() => onSetStrategy(mode)}
              className={`text-xs py-1.5 px-2 rounded-lg font-semibold transition capitalize ${
                playerState.strategyMode === mode
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
            >
              {mode === "aggressive" ? "⚔️" : mode === "defensive" ? "🛡️" : mode === "balanced" ? "⚖️" : "💰"}{" "}
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
