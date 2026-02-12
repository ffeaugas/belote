import type {
    InstanceState,
    Player,
    TablePhase,
    ChatMessage,
    TableConfig,
    Card,
    PlayerPosition,
    GameAction
} from "@belote/shared";

const DEFAULT_CONFIG: TableConfig = {
    variant: 'classique',
    turnTimeout: 30_000,
    bidTimeout: 30_000,
    disconnectGrace: 60_000,
    targetScore: 1000,
    isPrivate: false,
};

/**
 * Domain entity: Encapsulates game state and state transitions.
 * Pure domain logic - no I/O, no side effects.
 */
export class GameState {
    private state: InstanceState;
    private actionLog: GameAction[] = [];

    constructor(state: InstanceState) {
        this.state = state;
    }

    static create(roomId: string, createdBy: string): GameState {
        const state: InstanceState = {
            id: roomId,
            createdAt: Date.now(),
            createdBy,
            config: { ...DEFAULT_CONFIG },
            phase: 'WAITING_FOR_PLAYERS',
            players: new Map(),
            chat: [],
        };
        return new GameState(state);
    }

    // Getters for read access
    get id() { return this.state.id; }
    get phase() { return this.state.phase; }
    get config() { return this.state.config; }
    get playerCount() { return this.state.players.size; }
    get isEmpty() { return this.state.players.size === 0; }
    get createdBy() { return this.state.createdBy; }

    getPlayers(): Player[] {
        return Array.from(this.state.players.values());
    }

    getPlayer(playerId: string): Player | undefined {
        return this.state.players.get(playerId);
    }

    getActions(): GameAction[] {
        return [...this.actionLog];
    }

    getChatMessages(): ChatMessage[] {
        return [...this.state.chat];
    }

    // State transitions - return new state or mutate and return self
    addPlayer(playerId: string): Player {
        const player: Player = {
            id: playerId,
            position: null,
            status: 'connected',
            hand: null,
            isReadyToStart: false,
        };
        this.state.players.set(playerId, player);
        this.logAction({ type: 'PLAYER_JOIN', playerId, timestamp: Date.now() });
        return player;
    }

    removePlayer(playerId: string): void {
        this.state.players.delete(playerId);
        this.logAction({ type: 'PLAYER_DISCONNECT', playerId, timestamp: Date.now() });
    }

    togglePlayerReady(playerId: string): boolean {
        const player = this.state.players.get(playerId);
        if (!player) return false;
        player.isReadyToStart = !player.isReadyToStart;
        if (player.isReadyToStart) {
            this.logAction({ type: 'PLAYER_READY', playerId, timestamp: Date.now() });
        }
        return player.isReadyToStart;
    }

    setPlayerPosition(playerId: string, position: PlayerPosition): void {
        const player = this.state.players.get(playerId);
        if (!player) return;
        player.position = position;
        this.logAction({ type: 'PLAYER_SIT', playerId, position, timestamp: Date.now() });
    }

    changePhase(phase: TablePhase): void {
        this.state.phase = phase;
        if (phase === 'PLAYING') {
            this.logAction({ type: 'GAME_START', timestamp: Date.now() });
        }
    }

    addChatMessage(playerId: string, text: string): ChatMessage {
        const message: ChatMessage = {
            id: crypto.randomUUID().slice(0, 8),
            playerId,
            message: text,
            timestamp: Date.now(),
        };
        this.state.chat.push(message);
        return message;
    }

    // Serialization for persistence
    toJSON(): object {
        return {
            ...this.state,
            players: Array.from(this.state.players.entries()),
        };
    }

    static fromJSON(data: any): GameState {
        const state: InstanceState = {
            ...data,
            players: new Map(data.players),
        };
        return new GameState(state);
    }

    private logAction(action: GameAction): void {
        this.actionLog.push(action);
    }
}
