import Elysia from "elysia";
import type { InstanceState } from '@belote/shared'

// temporary room storage
// use db or redis then ?
const rooms = new Map<string, InstanceState>()

export const chatRooms = new Elysia()
    .ws('/ws/:roomId', {
        open(socket) {
            const roomId = socket.data.params.roomId
            const playerId = crypto.randomUUID().slice(0, 8);

            (socket as any).data.playerId = playerId;
            (socket as any).data.roomId = roomId;
            socket.subscribe(roomId)

            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set())
            }
            rooms.get(roomId)!.add(playerId)

            const players = [...rooms.get(roomId)!]

            socket.publish(roomId, JSON.stringify({
                type: 'player_joined',
                playerId,
                players
            }))

            socket.send(JSON.stringify({
                type: 'room_state',
                playerId,
                roomId,
                players
            }))

            console.log(`Player ${playerId} joined room ${roomId}`)
        },

        message(socket, message: { type: string; text?: string }) {
            const { roomId, playerId } = (socket as any).data

            if (message.type === 'chat' && message.text) {
                const chatMessage = JSON.stringify({
                    type: 'chat',
                    from: playerId,
                    text: message.text
                })

                socket.send(chatMessage)
                socket.publish(roomId, chatMessage)
            }
        },

        close(socket) {
            const { roomId, playerId } = (socket as any).data

            if (roomId && rooms.has(roomId)) {
                rooms.get(roomId)!.delete(playerId)

                const players = [...rooms.get(roomId)!]

                if (players.length === 0) {
                    rooms.delete(roomId)
                } else {
                    socket.publish(roomId, JSON.stringify({
                        type: 'player_left',
                        playerId,
                        players
                    }))
                }

                console.log(`Player ${playerId} left room ${roomId}`)
            }
        }
    })
