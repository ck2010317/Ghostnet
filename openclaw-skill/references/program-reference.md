# Ghostnet Territories — On-Chain Program Reference

## Program ID
`9LuS7xu5DLUac1sbFsF2uBYAdnfJrrs1C2JHgdYfjmtQ`

## Network
Solana Devnet

## PDAs

### Game PDA
```
seeds = ["game", game_id.to_le_bytes()]
program = 9LuS7xu5DLUac1sbFsF2uBYAdnfJrrs1C2JHgdYfjmtQ
```

### Player PDA
```
seeds = ["player", game_id.to_le_bytes(), player_pubkey.to_bytes()]
program = 9LuS7xu5DLUac1sbFsF2uBYAdnfJrrs1C2JHgdYfjmtQ
```

## Instructions

### create_game(game_id: u64, stake_amount: u64)
Creates a new game instance.
- **Accounts:** game (PDA, init), creator (signer, mut), system_program
- **Constraints:** game_id must be unique

### join_game(game_id: u64)
Joins an existing game in Lobby state.
- **Accounts:** game (mut), player_state (PDA, init), player (signer, mut), system_program
- **Constraints:** max 4 players, game must be in Lobby state

### start_game()
Starts the game. Only the creator can call this.
- **Accounts:** game (mut), creator (signer)
- **Constraints:** Must be creator, at least 2 players, game in Lobby state
- **Side effects:** Initializes the 8×8 grid with starting positions and resources

### move_units(game_id: u64, from_x: u8, from_y: u8, to_x: u8, to_y: u8, unit_count: u8)
Moves units from one tile to an adjacent tile.
- **Accounts:** game (mut), player_state (mut), player (signer)
- **Constraints:** Must be active game, must own source tile, tiles must be adjacent, must have enough units

### build_defense(game_id: u64, x: u8, y: u8)
Builds a defense fortification on a tile.
- **Accounts:** game (mut), player_state (mut), player (signer)
- **Constraints:** Must own the tile, costs 30 wood

### train_units(game_id: u64, x: u8, y: u8, count: u8)
Trains new military units at a tile.
- **Accounts:** game (mut), player_state (mut), player (signer)
- **Constraints:** Must own the tile, costs 25 gold per unit, max 20 total units

### collect_resources(game_id: u64)
Collects gold and wood from all owned tiles.
- **Accounts:** game (mut), player_state (mut), player (signer)
- **Constraints:** Must have owned tiles

### set_strategy(game_id: u64, mode: StrategyMode)
Sets the AI strategy mode for the player.
- **Accounts:** player_state (mut), player (signer)
- **Modes:** Balanced, Aggressive, Defensive, Economic

### end_game()
Ends the game and determines winner.
- **Accounts:** game (mut), authority (signer)

### delegate_game(game_id: u64)
Delegates the game account to MagicBlock Ephemeral Rollups for privacy.
- **Accounts:** game (mut), creator (signer), delegation_program
- **Side effects:** CPI to DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh

## Account Structures

### Game
| Field | Type | Description |
|-------|------|-------------|
| creator | Pubkey | Game creator's public key |
| game_id | u64 | Unique game identifier |
| status | GameStatus | Lobby / Active / Finished |
| player_count | u8 | Number of joined players (max 4) |
| stake_amount | u64 | SOL staked per player |
| winner | Option<Pubkey> | Winner's public key (set when finished) |
| grid | [TileState; 64] | 8×8 game grid |
| turn | u64 | Current turn number |
| created_at | i64 | Unix timestamp of creation |
| last_action | i64 | Unix timestamp of last action |

### PlayerState
| Field | Type | Description |
|-------|------|-------------|
| player | Pubkey | Player's public key |
| game_id | u64 | Associated game ID |
| player_index | u8 | Player number (0-3) |
| gold | u64 | Current gold amount |
| wood | u64 | Current wood amount |
| units | u8 | Total units alive |
| score | u64 | Accumulated score |
| is_alive | bool | Whether player is still in game |
| strategy_mode | StrategyMode | Current AI strategy |

### TileState
| Variant | Fields | Description |
|---------|--------|-------------|
| Empty | — | Unoccupied tile |
| Owned | owner, units, defense | Tile owned by a player |
| Resource | resource_type, amount | Resource deposit |

## Constants

| Name | Value |
|------|-------|
| GRID_SIZE | 8 |
| MAX_PLAYERS | 4 |
| MAX_UNITS | 20 |
| INITIAL_GOLD | 100 |
| INITIAL_WOOD | 50 |
| UNIT_COST_GOLD | 25 |
| DEFENSE_COST_WOOD | 30 |

## MagicBlock Integration

### Delegation Program
`DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`

### Ephemeral Rollup Endpoints
- US: `https://devnet-us.magicblock.app`
- EU: `https://devnet-eu.magicblock.app`
- TEE: `https://tee.magicblock.app`

### How Privacy Works
1. Game creator calls `delegate_game` to hand game account to ER
2. Moves are processed inside MagicBlock's TEE (Trusted Execution Environment)
3. Other players cannot see your moves until they resolve
4. Game state is committed back to Solana when needed
