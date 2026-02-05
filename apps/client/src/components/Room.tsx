import { useRoom } from '@/hooks/useRoom'
import { Button } from '@/components/ui/button'
import { PlayerList } from '@/components/PlayerList'
import { Chat } from '@/components/Chat'
import type { ChatMessage, Player, TablePhase } from '@belote/shared'

interface RoomProps {
    roomId: string
}

export function Room({ roomId }: RoomProps) {
    const { playerId, players, messages, isConnected, sendMessage, togglePlayerReady, startGame, phase } = useRoom(roomId)
    if (!isConnected) {
        return <div className="text-center p-8">Connexion en cours...</div>
    }

    if (phase === 'WAITING_FOR_PLAYERS' || phase === 'READY_TO_START') {
        return (
            <Lobby phase={phase} roomId={roomId} players={players} messages={messages} playerId={playerId ?? ''} sendMessage={sendMessage} startGame={startGame} togglePlayerReady={togglePlayerReady} />
        )
    }
    return <div className="text-center p-8">Phase not implemented yet</div>
}
interface LobbyProps {
    phase: TablePhase
    roomId: string
    players: Player[]
    messages: ChatMessage[]
    playerId: string
    sendMessage: (text: string) => void
    startGame: () => void
    togglePlayerReady: (playerId: string) => void
}

const Lobby = ({
    phase,
    roomId,
    players,
    messages,
    playerId,
    sendMessage,
    startGame,
    togglePlayerReady
}: LobbyProps) => {
    return (
        <div className="container mx-auto p-8 max-w-4xl relative">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Room: {roomId}</h1>
                <Button variant="outline" onClick={() => window.location.href = '/'}>
                    Quitter
                </Button>
            </div>

            <div className="flex flex-col gap-4">
                <PlayerList players={players} playerId={playerId} />
                <Chat messages={messages} playerId={playerId} sendMessage={sendMessage} />
            </div>
            <Button onClick={() => startGame()}>
                Start game
            </Button>
            <Button onClick={() => togglePlayerReady(playerId)}>Toggle ready</Button>

            {phase === 'READY_TO_START' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-8 shadow-lg text-2xl font-bold text-center">
                        Ready to start...
                    </div>
                </div>
            )}
        </div>
    )
}
