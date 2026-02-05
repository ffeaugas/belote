import type { ChatMessage, Player, TablePhase } from '@belote/shared'
import { useEffect, useRef, useState, useCallback } from 'react'

interface RoomState {
    phase: TablePhase
    playerId: string | null
    roomId: string | null
    players: Player[]
    messages: ChatMessage[]
    isConnected: boolean
}

type ServerMessage =
    | { type: 'room_state'; playerId: string; roomId: string; players: Player[] }
    | { type: 'player_joined'; playerId: string; players: Player[] }
    | { type: 'player_left'; playerId: string; players: Player[] }
    | { type: 'chat'; content: ChatMessage }
    | { type: 'phase_changed'; phase: TablePhase }
    | { type: 'start_game' }

export function useRoom(roomId: string) {
    const [state, setState] = useState<RoomState>({
        playerId: null,
        roomId: null,
        phase: 'WAITING_FOR_PLAYERS',
        players: [],
        messages: [],
        isConnected: false
    })
    const ws = useRef<WebSocket | null>(null)

    useEffect(() => {
        ws.current = new WebSocket(`ws://localhost:3001/ws/${roomId}`)

        ws.current.onopen = () => {
            setState(prev => ({ ...prev, isConnected: true }))
        }

        ws.current.onmessage = (event) => {
            try {
                const data: ServerMessage = JSON.parse(event.data)

                switch (data.type) {
                    case 'room_state':
                        setState(prev => ({
                            ...prev,
                            playerId: data.playerId,
                            roomId: data.roomId,
                            players: data.players
                        }))
                        break

                    case 'player_joined':
                    case 'player_left':
                        setState(prev => ({
                            ...prev,
                            players: data.players
                        }))
                        break

                    case 'chat':
                        setState(prev => ({
                            ...prev,
                            messages: [...prev.messages, data.content]
                        }))
                        break

                    case 'phase_changed':
                        setState(prev => ({ ...prev, phase: data.phase }))
                        break
                }
            } catch (e) {
                console.error('Failed to parse message:', event.data)
            }
        }

        ws.current.onclose = () => {
            setState(prev => ({ ...prev, isConnected: false }))
        }

        return () => {
            ws.current?.close()
        }
    }, [roomId])

    const sendMessage = useCallback((text: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'chat', text }))
        }
    }, [])

    const togglePlayerReady = useCallback((playerId: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'toggle_player_ready', playerId }))
        }
    }, [])

    const startGame = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'start_game' }))
        }
    }, [])

    return { ...state, sendMessage, togglePlayerReady, startGame }
}
