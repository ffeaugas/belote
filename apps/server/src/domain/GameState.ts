import type {
  InstanceState,
  Player,
  TablePhase,
  ChatMessage,
  TableConfig,
  GameAction,
} from "@belote/shared";

const DEFAULT_CONFIG: TableConfig = {
  variant: "classique",
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

  static create(roomId: string, name: string, createdBy: string): GameState {
    const state: InstanceState = {
      id: roomId,
      name,
      createdAt: Date.now(),
      createdBy,
      config: { ...DEFAULT_CONFIG },
      phase: "WAITING_FOR_PLAYERS",
      players: [],
      chat: [],
    };
    return new GameState(state);
  }

  // Getters for read access
  get id() {
    return this.state.id;
  }
  get name() {
    return this.state.name;
  }
  get phase() {
    return this.state.phase;
  }
  get config() {
    return this.state.config;
  }
  get playerCount() {
    return this.state.players.length;
  }
  get isEmpty() {
    return this.state.players.length === 0;
  }
  get createdBy() {
    return this.state.createdBy;
  }

  getPlayers(): Player[] {
    return [...this.state.players];
  }

  getMessages(): ChatMessage[] {
    return {
      ...this.state.chat,
    };
  }

  getPlayer(playerId: string): Player | undefined {
    return this.state.players.find((p) => p.id === playerId);
  }

  getActions(): GameAction[] {
    return [...this.actionLog];
  }

  getChatMessages(): ChatMessage[] {
    return [...this.state.chat];
  }

  addPlayer(playerId: string): Player {
    const player: Player = {
      id: playerId,
      position: null,
      status: "connected",
      hand: null,
      isReadyToStart: false,
    };
    this.state.players.push(player);
    this.logAction({ type: "PLAYER_JOIN", playerId, timestamp: Date.now() });
    return player;
  }

  removePlayer(playerId: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
  }

  disconnectPlayer(playerId: string): Player {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    player.status = "disconnected";
    player.disconnectedAt = Date.now();
    this.logAction({
      type: "PLAYER_DISCONNECT",
      playerId,
      timestamp: Date.now(),
    });
    return player;
  }

  reconnectPlayer(playerId: string): Player {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    player.status = "connected";
    delete player.disconnectedAt;
    this.logAction({
      type: "PLAYER_RECONNECT",
      playerId,
      timestamp: Date.now(),
    });
    return player;
  }

  togglePlayerReady(playerId: string): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return false;
    player.isReadyToStart = !player.isReadyToStart;
    if (player.isReadyToStart) {
      this.logAction({ type: "PLAYER_READY", playerId, timestamp: Date.now() });
    }
    return player.isReadyToStart;
  }

  changePhase(phase: TablePhase): void {
    this.state.phase = phase;
    if (phase === "PLAYING") {
      this.logAction({ type: "GAME_START", timestamp: Date.now() });
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

  static fromJSON(data: InstanceState): GameState {
    return new GameState(data);
  }

  toJSON(): InstanceState {
    return { ...this.state };
  }

  private logAction(action: GameAction): void {
    this.actionLog.push(action);
  }
}
