import Elysia from "elysia";

// temporary room storage
// use db or redis then ?
const rooms = new Map<string, Set<string>>()

export const chatRooms = new Elysia()
    .ws('/ws/:roomId', {
        open(ws) {
            const roomId = ws.data.params.roomId
            const playerId = crypto.randomUUID().slice(0, 8)

            ws.data.playerId = playerId
            ws.data.roomId = roomId
            ws.subscribe(roomId)

            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set())
            }
            rooms.get(roomId)!.add(playerId)

            const players = [...rooms.get(roomId)!]

            ws.publish(roomId, JSON.stringify({
                type: 'player_joined',
                playerId,
                players
            }))

            ws.send(JSON.stringify({
                type: 'room_state',
                playerId,
                roomId,
                players
            }))

            console.log(`Player ${playerId} joined room ${roomId}`)
        },

        message(ws, message: { type: string; text?: string }) {
            const { roomId, playerId } = ws.data

            if (message.type === 'chat' && message.text) {
                const chatMessage = JSON.stringify({
                    type: 'chat',
                    from: playerId,
                    text: message.text
                })

                ws.send(chatMessage)
                ws.publish(roomId, chatMessage)
            }
        },

        close(ws) {
            const { roomId, playerId } = ws.data

            if (roomId && rooms.has(roomId)) {
                rooms.get(roomId)!.delete(playerId)

                const players = [...rooms.get(roomId)!]

                if (players.length === 0) {
                    rooms.delete(roomId)
                } else {
                    ws.publish(roomId, JSON.stringify({
                        type: 'player_left',
                        playerId,
                        players
                    }))
                }

                console.log(`Player ${playerId} left room ${roomId}`)
            }
        }
    })
