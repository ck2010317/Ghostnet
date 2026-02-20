"use client";

import { useCallback, useState } from "react";
import { TileState } from "@/lib/game";
import { GRID_SIZE, PLAYER_COLORS, PLAYER_EMOJIS } from "@/lib/constants";

interface GameBoardProps {
  grid: TileState[][];
  playerIndex: number;
  onTileClick: (x: number, y: number) => void;
  selectedTile: { x: number; y: number } | null;
  fogOfWar: boolean;
}

export default function GameBoard({
  grid,
  playerIndex,
  onTileClick,
  selectedTile,
  fogOfWar,
}: GameBoardProps) {
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

  const isVisible = useCallback(
    (x: number, y: number): boolean => {
      if (!fogOfWar) return true;
      // Can see 2 tiles around your own tiles
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            const tile = grid[ny][nx];
            if (tile.kind === "owned" && tile.player === playerIndex) {
              return true;
            }
          }
        }
      }
      return false;
    },
    [grid, playerIndex, fogOfWar]
  );

  const isAdjacent = useCallback(
    (x: number, y: number): boolean => {
      if (!selectedTile) return false;
      const dx = Math.abs(x - selectedTile.x);
      const dy = Math.abs(y - selectedTile.y);
      return dx <= 1 && dy <= 1 && (dx + dy) > 0;
    },
    [selectedTile]
  );

  const getTileColor = (tile: TileState, x: number, y: number): string => {
    if (fogOfWar && !isVisible(x, y)) return "bg-gray-800";

    if (tile.kind === "owned") {
      const baseColor = PLAYER_COLORS[tile.player];
      return "";
    }
    if (tile.kind === "resource") {
      return tile.resourceType === "gold" ? "bg-yellow-500/30" : "bg-green-700/30";
    }
    return "bg-gray-700/50";
  };

  const getTileContent = (tile: TileState, x: number, y: number): string => {
    if (fogOfWar && !isVisible(x, y)) return "🌫️";

    if (tile.kind === "owned") {
      if (tile.hasDefense && tile.hasMine) return `🏰⛏️`;
      if (tile.hasDefense) return "🏰";
      if (tile.hasMine) return "⛏️";
      return `⚔️${tile.units}`;
    }
    if (tile.kind === "resource") {
      return tile.resourceType === "gold" ? "💰" : "🪵";
    }
    return "";
  };

  return (
    <div className="relative">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
        {grid.map((row, y) =>
          row.map((tile, x) => {
            const visible = !fogOfWar || isVisible(x, y);
            const isSelected =
              selectedTile?.x === x && selectedTile?.y === y;
            const adjacent = isAdjacent(x, y);
            const isHovered = hoverTile?.x === x && hoverTile?.y === y;

            return (
              <button
                key={`${x}-${y}`}
                onClick={() => onTileClick(x, y)}
                onMouseEnter={() => setHoverTile({ x, y })}
                onMouseLeave={() => setHoverTile(null)}
                className={`
                  relative w-16 h-16 rounded-lg border-2 transition-all duration-200
                  flex flex-col items-center justify-center text-xs font-bold
                  ${isSelected ? "border-white ring-2 ring-white/50 scale-110 z-10" : "border-gray-600/50"}
                  ${adjacent && selectedTile ? "border-yellow-400/70 ring-1 ring-yellow-400/30" : ""}
                  ${isHovered ? "brightness-125" : ""}
                  ${!visible ? "bg-gray-800/80" : ""}
                  hover:brightness-110 cursor-pointer
                `}
                style={{
                  backgroundColor:
                    tile.kind === "owned" && visible
                      ? `${PLAYER_COLORS[tile.player]}${tile.player === playerIndex ? "CC" : "66"}`
                      : tile.kind === "resource" && visible
                      ? tile.resourceType === "gold"
                        ? "#92400e55"
                        : "#14532d55"
                      : undefined,
                }}
              >
                {/* Tile content */}
                <span className="text-lg leading-none">
                  {getTileContent(tile, x, y)}
                </span>

                {/* Unit count for owned tiles */}
                {tile.kind === "owned" && visible && (
                  <span className="text-[10px] text-white/90 mt-0.5">
                    {PLAYER_EMOJIS[tile.player]} {tile.units}u
                  </span>
                )}

                {/* Coordinates */}
                <span className="absolute bottom-0.5 right-1 text-[8px] text-white/30">
                  {x},{y}
                </span>

                {/* Defense indicator */}
                {tile.kind === "owned" && tile.hasDefense && visible && (
                  <span className="absolute top-0.5 right-0.5 text-[10px]">🛡️</span>
                )}

                {/* Mine indicator */}
                {tile.kind === "owned" && tile.hasMine && visible && (
                  <span className="absolute top-0.5 left-0.5 text-[10px]">⛏️</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
