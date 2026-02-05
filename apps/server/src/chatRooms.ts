import Elysia from "elysia";
import { GameInstance } from "./repository/GameInstance";

const rooms = new Map<string, GameInstance>()

export const chatRooms = new Elysia()
    .ws('/ws/:roomId', {
        open(socket) {
            const roomId = socket.data.params.roomId
            const playerId = crypto.randomUUID().slice(0, 8);

            (socket as any).data.playerId = playerId;
            (socket as any).data.roomId = roomId;
            socket.subscribe(roomId)

            if (!rooms.has(roomId)) {
                rooms.set(roomId, new GameInstance(roomId, playerId))
            }

            const instance = rooms.get(roomId)!
            instance.addPlayer(playerId)

            const players = instance.getPlayers()

            socket.publish(roomId, JSON.stringify({
                type: 'player_joined',
                playerId,
                players
            }))

            socket.send(JSON.stringify({
                type: 'room_state',
                playerId,
                roomId,
                players,
                phase: instance.phase,
                config: instance.config,
            }))

            console.log(`Player ${playerId} joined room ${roomId} (${instance.playerCount} players)`)
        },

        message(socket, message: { type: string; text?: string }) {
            const { roomId, playerId } = (socket as any).data
            const instance = rooms.get(roomId)
            if (!instance) return

            if (message.type === 'chat' && message.text) {
                const chatMessage = instance.addChatMessage(playerId, message.text)

                console.log('chatMessage::::::::::', chatMessage)
                const payload = JSON.stringify({
                    type: 'chat',
                    content: chatMessage
                })

                socket.send(payload)
                socket.publish(roomId, payload)
            }

            if (message.type === 'toggle_player_ready') {
                instance.togglePlayerReady(playerId)

                const players = instance.getPlayers()

                const payload = JSON.stringify({
                    type: 'player_joined',
                    playerId,
                    players
                })

                socket.publish(roomId, payload)
                socket.send(payload)
            }

            if (message.type === 'start_game') {
                instance.changePhase('READY_TO_START')

                const payload = JSON.stringify({
                    type: 'phase_changed',
                    phase: instance.phase
                })

                socket.publish(roomId, payload)
                socket.send(payload)

                setTimeout(() => {
                    instance.changePhase('BIDDING')

                    const biddingPayload = JSON.stringify({
                        type: 'phase_changed',
                        phase: instance.phase
                    })

                    app.server!.publish(roomId, biddingPayload)
                }, 5000)
            }
        },

        close(socket) {
            const { roomId, playerId } = (socket as any).data
            const instance = rooms.get(roomId)

            if (roomId && instance) {
                instance.removePlayer(playerId)

                if (instance.isEmpty) {
                    rooms.delete(roomId)
                } else {
                    const players = instance.getPlayers()

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
