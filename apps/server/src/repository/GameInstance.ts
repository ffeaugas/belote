import type { InstanceState, Player, ChatMessage, TableConfig, TablePhase } from "@belote/shared";
import { assert } from "../utils/errorHandling";

const DEFAULT_CONFIG: TableConfig = {
    variant: 'classique',
    turnTimeout: 30_000,
    bidTimeout: 30_000,
    disconnectGrace: 60_000,
    targetScore: 1000,
    isPrivate: false,
}

export class GameInstance {
    private state: InstanceState;

    constructor(roomId: string, createdBy: string) {
        this.state = {
            id: roomId,
            createdAt: Date.now(),
            createdBy,
            config: { ...DEFAULT_CONFIG },
            phase: 'WAITING_FOR_PLAYERS',
            players: new Map(),
            chat: [],
        }
    }

    get id() { return this.state.id }
    get phase() { return this.state.phase }
    get config() { return this.state.config }
    get playerCount() { return this.state.players.size }
    get isEmpty() { return this.state.players.size === 0 }

    getPlayers(): Player[] {
        return Array.from(this.state.players.values())
    }

    addPlayer(playerId: string): Player {
        const player: Player = {
            id: playerId,
            position: null,
            status: 'connected',
            hand: null,
            isReadyToStart: false,
        }
        this.state.players.set(playerId, player)
        return player
    }

    removePlayer(playerId: string) {
        this.state.players.delete(playerId)
    }

    addChatMessage(playerId: string, text: string): ChatMessage {
        const message: ChatMessage = {
            id: crypto.randomUUID().slice(0, 8),
            playerId,
            message: text,
            timestamp: Date.now(),
        }
        this.state.chat.push(message)
        return message
    }

    togglePlayerReady(playerId: string) {
        const player = this.state.players.get(playerId)
        if (!player) return
        player.isReadyToStart = !player.isReadyToStart
    }

    changePhase(phase: TablePhase) {
        switch (phase) {
            case 'READY_TO_START': {
                const playersReadyCount = [...this.state.players.values()].filter(p => p.isReadyToStart).length;
                console.log('playersReadyCount::::::::::', playersReadyCount)
                assert(playersReadyCount === 4, 'Required 4 players to be ready to start the game')
                this.state.phase = 'READY_TO_START'
                break
            }
            default:
                throw new Error(`Phase ${phase} is not supported yet`)
        }
    }
}