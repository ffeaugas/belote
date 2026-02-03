import { useEffect, useRef, useState, useCallback } from 'react'

export interface ChatMessage {
    from: string
    text: string
}

interface RoomState {
    playerId: string | null
    roomId: string | null
    players: string[]
    messages: ChatMessage[]
    isConnected: boolean
}

type ServerMessage =
    | { type: 'room_state'; playerId: string; roomId: string; players: string[] }
    | { type: 'player_joined'; playerId: string; players: string[] }
    | { type: 'player_left'; playerId: string; players: string[] }
    | { type: 'chat'; from: string; text: string }

export function useRoom(roomId: string) {
    const [state, setState] = useState<RoomState>({
        playerId: null,
        roomId: null,
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
                            messages: [...prev.messages, { from: data.from, text: data.text }]
                        }))
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

    return { ...state, sendMessage }
}
