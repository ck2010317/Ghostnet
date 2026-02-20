use anchor_lang::prelude::*;

declare_id!("9LuS7xu5DLUac1sbFsF2uBYAdnfJrrs1C2JHgdYfjmtQ");

// MagicBlock Delegation Program
pub const DELEGATION_PROGRAM_ID: Pubkey = pubkey!("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

// Seeds
pub const GAME_SEED: &[u8] = b"game";
pub const PLAYER_SEED: &[u8] = b"player";

// Constants
pub const GRID_SIZE: u8 = 8;
pub const MAX_PLAYERS: u8 = 4;
pub const MAX_UNITS: u8 = 20;
pub const INITIAL_GOLD: u64 = 100;
pub const INITIAL_WOOD: u64 = 50;
pub const UNIT_COST_GOLD: u64 = 25;
pub const DEFENSE_COST_WOOD: u64 = 30;
pub const RESOURCE_PER_TICK: u64 = 5;

#[program]
pub mod ghostnet {
    use super::*;

    /// Create a new game lobby
    pub fn create_game(ctx: Context<CreateGame>, game_id: u64, stake_amount: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let creator = ctx.accounts.creator.key();

        game.game_id = game_id;
        game.creator = creator;
        game.stake_amount = stake_amount;
        game.player_count = 0;
        game.status = GameStatus::Lobby;
        game.turn = 0;
        game.winner = None;
        game.created_at = Clock::get()?.unix_timestamp;
        game.started_at = 0;
        game.finished_at = 0;

        // Init empty grid
        game.grid = [[TileState::Empty; 8]; 8];

        msg!("Game {} created by {}", game_id, creator);
        Ok(())
    }

    /// Join an existing game
    pub fn join_game(ctx: Context<JoinGame>, game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player_state = &mut ctx.accounts.player_state;
        let player = ctx.accounts.player.key();

        require!(game.status == GameStatus::Lobby, GameError::GameNotInLobby);
        require!(game.player_count < MAX_PLAYERS, GameError::GameFull);

        let player_index = game.player_count;
        game.player_count += 1;

        player_state.game_id = game_id;
        player_state.player = player;
        player_state.player_index = player_index;
        player_state.gold = INITIAL_GOLD;
        player_state.wood = INITIAL_WOOD;
        player_state.units = 3;
        player_state.score = 0;
        player_state.is_alive = true;
        player_state.strategy_mode = StrategyMode::Balanced;

        // Assign starting corner (2x2)
        let (start_x, start_y): (usize, usize) = match player_index {
            0 => (0, 0),
            1 => (6, 0),
            2 => (0, 6),
            3 => (6, 6),
            _ => return Err(GameError::GameFull.into()),
        };

        for dx in 0..2usize {
            for dy in 0..2usize {
                game.grid[start_y + dy][start_x + dx] = TileState::Owned {
                    player: player_index,
                    units: 1,
                    has_defense: false,
                    has_mine: false,
                };
            }
        }

        player_state.score = 40; // 4 tiles * 10 pts

        msg!("Player {} joined game {} as P{}", player, game_id, player_index);
        Ok(())
    }

    /// Start the game (creator only, needs 2+ players)
    pub fn start_game(ctx: Context<StartGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.status == GameStatus::Lobby, GameError::GameNotInLobby);
        require!(game.player_count >= 2, GameError::NotEnoughPlayers);
        require!(game.creator == ctx.accounts.creator.key(), GameError::NotCreator);

        // Place resource mines in center
        game.grid[3][3] = TileState::Resource { resource_type: ResourceType::Gold, amount: 500 };
        game.grid[4][4] = TileState::Resource { resource_type: ResourceType::Gold, amount: 500 };
        game.grid[3][4] = TileState::Resource { resource_type: ResourceType::Wood, amount: 300 };
        game.grid[4][3] = TileState::Resource { resource_type: ResourceType::Wood, amount: 300 };

        game.status = GameStatus::Active;
        game.started_at = Clock::get()?.unix_timestamp;

        msg!("Game {} started with {} players!", game.game_id, game.player_count);
        Ok(())
    }

    /// Move units from one tile to adjacent tile
    pub fn move_units(
        ctx: Context<MoveUnits>,
        _game_id: u64,
        from_x: u8,
        from_y: u8,
        to_x: u8,
        to_y: u8,
        unit_count: u8,
    ) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player_state = &mut ctx.accounts.player_state;

        require!(game.status == GameStatus::Active, GameError::GameNotActive);
        require!(player_state.is_alive, GameError::PlayerEliminated);
        require!(from_x < GRID_SIZE && from_y < GRID_SIZE, GameError::OutOfBounds);
        require!(to_x < GRID_SIZE && to_y < GRID_SIZE, GameError::OutOfBounds);

        // Must be adjacent
        let dx = (from_x as i16 - to_x as i16).unsigned_abs() as u8;
        let dy = (from_y as i16 - to_y as i16).unsigned_abs() as u8;
        require!(dx <= 1 && dy <= 1 && (dx + dy) > 0, GameError::NotAdjacent);

        let pi = player_state.player_index;
        let fx = from_x as usize;
        let fy = from_y as usize;
        let tx = to_x as usize;
        let ty = to_y as usize;

        // Verify ownership of source
        match game.grid[fy][fx] {
            TileState::Owned { player, units, .. } => {
                require!(player == pi, GameError::NotYourTile);
                require!(units >= unit_count && unit_count > 0, GameError::NotEnoughUnits);
            }
            _ => return Err(GameError::NotYourTile.into()),
        }

        // Remove units from source
        if let TileState::Owned { ref mut units, .. } = game.grid[fy][fx] {
            *units -= unit_count;
        }

        // Handle destination
        let dest = game.grid[ty][tx];
        match dest {
            TileState::Empty => {
                game.grid[ty][tx] = TileState::Owned {
                    player: pi,
                    units: unit_count,
                    has_defense: false,
                    has_mine: false,
                };
                player_state.score += 10;
            }
            TileState::Owned { player: owner, units: def_units, has_defense, has_mine } => {
                if owner == pi {
                    // Reinforce
                    if let TileState::Owned { ref mut units, .. } = game.grid[ty][tx] {
                        *units += unit_count;
                    }
                } else {
                    // Combat
                    let atk = unit_count as u16;
                    let def_bonus: u16 = if has_defense { 2 } else { 0 };
                    let def = def_units as u16 + def_bonus;

                    if atk > def {
                        let remaining = ((atk - def) as u8).max(1);
                        game.grid[ty][tx] = TileState::Owned {
                            player: pi,
                            units: remaining,
                            has_defense: false,
                            has_mine: has_mine,
                        };
                        player_state.score += 50;
                    } else {
                        let remaining = ((def - atk) as u8).max(1);
                        game.grid[ty][tx] = TileState::Owned {
                            player: owner,
                            units: remaining,
                            has_defense,
                            has_mine,
                        };
                    }
                }
            }
            TileState::Resource { resource_type, amount } => {
                match resource_type {
                    ResourceType::Gold => player_state.gold += amount,
                    ResourceType::Wood => player_state.wood += amount,
                }
                game.grid[ty][tx] = TileState::Owned {
                    player: pi,
                    units: unit_count,
                    has_defense: false,
                    has_mine: true,
                };
                player_state.score += 100;
            }
        }

        game.turn += 1;
        msg!("P{} moved {} units ({},{}) -> ({},{})", pi, unit_count, from_x, from_y, to_x, to_y);
        Ok(())
    }

    /// Build defense on your tile
    pub fn build_defense(ctx: Context<BuildDefense>, _game_id: u64, x: u8, y: u8) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let ps = &mut ctx.accounts.player_state;

        require!(game.status == GameStatus::Active, GameError::GameNotActive);
        require!(ps.is_alive, GameError::PlayerEliminated);
        require!(x < GRID_SIZE && y < GRID_SIZE, GameError::OutOfBounds);
        require!(ps.wood >= DEFENSE_COST_WOOD, GameError::NotEnoughResources);

        let xi = x as usize;
        let yi = y as usize;

        match game.grid[yi][xi] {
            TileState::Owned { player, has_defense, .. } => {
                require!(player == ps.player_index, GameError::NotYourTile);
                require!(!has_defense, GameError::AlreadyHasDefense);
            }
            _ => return Err(GameError::NotYourTile.into()),
        }

        if let TileState::Owned { ref mut has_defense, .. } = game.grid[yi][xi] {
            *has_defense = true;
        }
        ps.wood -= DEFENSE_COST_WOOD;
        ps.score += 20;

        msg!("P{} built defense at ({},{})", ps.player_index, x, y);
        Ok(())
    }

    /// Train new units (costs gold)
    pub fn train_units(ctx: Context<TrainUnits>, _game_id: u64, x: u8, y: u8, count: u8) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let ps = &mut ctx.accounts.player_state;

        require!(game.status == GameStatus::Active, GameError::GameNotActive);
        require!(ps.is_alive, GameError::PlayerEliminated);
        require!(x < GRID_SIZE && y < GRID_SIZE, GameError::OutOfBounds);

        let cost = count as u64 * UNIT_COST_GOLD;
        require!(ps.gold >= cost, GameError::NotEnoughResources);
        require!(ps.units + count <= MAX_UNITS, GameError::MaxUnitsReached);

        let xi = x as usize;
        let yi = y as usize;

        match game.grid[yi][xi] {
            TileState::Owned { player, .. } => {
                require!(player == ps.player_index, GameError::NotYourTile);
            }
            _ => return Err(GameError::NotYourTile.into()),
        }

        if let TileState::Owned { ref mut units, .. } = game.grid[yi][xi] {
            *units += count;
        }

        ps.gold -= cost;
        ps.units += count;

        msg!("P{} trained {} units at ({},{})", ps.player_index, count, x, y);
        Ok(())
    }

    /// Collect resources from owned tiles
    pub fn collect_resources(ctx: Context<CollectResources>, _game_id: u64) -> Result<()> {
        let game = &ctx.accounts.game;
        let ps = &mut ctx.accounts.player_state;

        require!(game.status == GameStatus::Active, GameError::GameNotActive);
        require!(ps.is_alive, GameError::PlayerEliminated);

        let mut gold_gain: u64 = 0;
        let mut wood_gain: u64 = 0;

        for row in &game.grid {
            for tile in row {
                if let TileState::Owned { player, has_mine, .. } = tile {
                    if *player == ps.player_index {
                        gold_gain += RESOURCE_PER_TICK;
                        wood_gain += RESOURCE_PER_TICK;
                        if *has_mine {
                            gold_gain += RESOURCE_PER_TICK * 2;
                        }
                    }
                }
            }
        }

        ps.gold += gold_gain;
        ps.wood += wood_gain;

        msg!("P{} collected {} gold, {} wood", ps.player_index, gold_gain, wood_gain);
        Ok(())
    }

    /// Set strategy mode for agent
    pub fn set_strategy(ctx: Context<SetStrategy>, _game_id: u64, mode: StrategyMode) -> Result<()> {
        let ps = &mut ctx.accounts.player_state;
        ps.strategy_mode = mode.clone();
        msg!("P{} strategy -> {:?}", ps.player_index, mode);
        Ok(())
    }

    /// End game - declare winner
    pub fn end_game(ctx: Context<EndGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.status == GameStatus::Active, GameError::GameNotActive);
        game.status = GameStatus::Finished;
        game.finished_at = Clock::get()?.unix_timestamp;
        msg!("Game {} finished!", game.game_id);
        Ok(())
    }

    /// Delegate game to MagicBlock ER for real-time execution
    pub fn delegate_game(ctx: Context<DelegateGame>) -> Result<()> {
        let game = &ctx.accounts.game;
        let game_info = ctx.accounts.game.to_account_info();
        let payer_info = ctx.accounts.payer.to_account_info();
        let system_info = ctx.accounts.system_program.to_account_info();
        let delegation_program_info = ctx.accounts.delegation_program.to_account_info();
        let buffer_info = ctx.accounts.buffer.to_account_info();
        let record_info = ctx.accounts.delegation_record.to_account_info();
        let metadata_info = ctx.accounts.delegation_metadata.to_account_info();
        let owner_program_info = ctx.accounts.owner_program.to_account_info();

        // Build seeds for PDA signing
        let game_id_bytes = game.game_id.to_le_bytes();
        let (_, bump) = Pubkey::find_program_address(
            &[GAME_SEED, &game_id_bytes],
            &crate::ID,
        );
        let signer_seeds: &[&[u8]] = &[GAME_SEED, &game_id_bytes, &[bump]];

        // CPI to delegation program
        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: DELEGATION_PROGRAM_ID,
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(payer_info.key(), true),
                anchor_lang::solana_program::instruction::AccountMeta::new(game_info.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(owner_program_info.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new(buffer_info.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new(record_info.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new(metadata_info.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(system_info.key(), false),
            ],
            data: vec![0], // delegate instruction discriminator
        };

        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                payer_info,
                game_info,
                owner_program_info,
                buffer_info,
                record_info,
                metadata_info,
                system_info,
                delegation_program_info,
            ],
            &[signer_seeds],
        )?;

        msg!("Game {} delegated to ER!", game.game_id);
        Ok(())
    }
}

// ==================== ACCOUNTS ====================

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Game::LEN,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    #[account(
        init,
        payer = player,
        space = 8 + PlayerState::LEN,
        seeds = [PLAYER_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct MoveUnits<'info> {
    #[account(mut, seeds = [GAME_SEED, &game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [PLAYER_SEED, &game_id.to_le_bytes(), player.key().as_ref()], bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct BuildDefense<'info> {
    #[account(mut, seeds = [GAME_SEED, &game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [PLAYER_SEED, &game_id.to_le_bytes(), player.key().as_ref()], bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct TrainUnits<'info> {
    #[account(mut, seeds = [GAME_SEED, &game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [PLAYER_SEED, &game_id.to_le_bytes(), player.key().as_ref()], bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CollectResources<'info> {
    #[account(seeds = [GAME_SEED, &game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [PLAYER_SEED, &game_id.to_le_bytes(), player.key().as_ref()], bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct SetStrategy<'info> {
    #[account(mut, seeds = [PLAYER_SEED, &game_id.to_le_bytes(), player.key().as_ref()], bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct EndGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DelegateGame<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub game: Account<'info, Game>,
    /// CHECK: Delegation program
    #[account(address = DELEGATION_PROGRAM_ID)]
    pub delegation_program: AccountInfo<'info>,
    /// CHECK: Buffer
    #[account(mut)]
    pub buffer: AccountInfo<'info>,
    /// CHECK: Delegation record
    #[account(mut)]
    pub delegation_record: AccountInfo<'info>,
    /// CHECK: Delegation metadata
    #[account(mut)]
    pub delegation_metadata: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: Owner program
    #[account(address = crate::ID)]
    pub owner_program: AccountInfo<'info>,
}

// ==================== STATE ====================

#[account]
pub struct Game {
    pub game_id: u64,
    pub creator: Pubkey,
    pub stake_amount: u64,
    pub player_count: u8,
    pub status: GameStatus,
    pub turn: u64,
    pub winner: Option<Pubkey>,
    pub grid: [[TileState; 8]; 8],
    pub created_at: i64,
    pub started_at: i64,
    pub finished_at: i64,
}

impl Game {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1 + 8 + (1 + 32) + (64 * 36) + 8 + 8 + 8 + 256;
}

#[account]
pub struct PlayerState {
    pub game_id: u64,
    pub player: Pubkey,
    pub player_index: u8,
    pub gold: u64,
    pub wood: u64,
    pub units: u8,
    pub score: u64,
    pub is_alive: bool,
    pub strategy_mode: StrategyMode,
}

impl PlayerState {
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8 + 1 + 8 + 1 + 1 + 64;
}

// ==================== ENUMS ====================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum GameStatus {
    Lobby,
    Active,
    Finished,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TileState {
    Empty,
    Owned {
        player: u8,
        units: u8,
        has_defense: bool,
        has_mine: bool,
    },
    Resource {
        resource_type: ResourceType,
        amount: u64,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ResourceType {
    Gold,
    Wood,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum StrategyMode {
    Aggressive,
    Defensive,
    Balanced,
    Economic,
}

// ==================== ERRORS ====================

#[error_code]
pub enum GameError {
    #[msg("Game is not in lobby state")]
    GameNotInLobby,
    #[msg("Game is full")]
    GameFull,
    #[msg("Game is not active")]
    GameNotActive,
    #[msg("Not enough players to start")]
    NotEnoughPlayers,
    #[msg("Only the creator can start the game")]
    NotCreator,
    #[msg("Coordinates out of bounds")]
    OutOfBounds,
    #[msg("Tiles must be adjacent")]
    NotAdjacent,
    #[msg("This is not your tile")]
    NotYourTile,
    #[msg("Not enough units")]
    NotEnoughUnits,
    #[msg("Not enough resources")]
    NotEnoughResources,
    #[msg("This tile already has a defense")]
    AlreadyHasDefense,
    #[msg("Maximum units reached")]
    MaxUnitsReached,
    #[msg("Player has been eliminated")]
    PlayerEliminated,
}
