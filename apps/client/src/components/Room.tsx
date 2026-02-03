import { useState } from 'react'
import { useRoom } from '@/hooks/useRoom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RoomProps {
    roomId: string
}

export function Room({ roomId }: RoomProps) {
    const { playerId, players, messages, isConnected, sendMessage } = useRoom(roomId)
    const [input, setInput] = useState('')

    const handleSend = () => {
        if (input.trim()) {
            sendMessage(input.trim())
            setInput('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSend()
        }
    }

    if (!isConnected) {
        return <div className="text-center p-8">Connexion en cours...</div>
    }

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Room: {roomId}</h1>
                <Button variant="outline" onClick={() => window.location.href = '/'}>
                    Quitter
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Liste des joueurs */}
                <Card>
                    <CardHeader>
                        <CardTitle>Joueurs ({players.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {players.map((id) => (
                                <li
                                    key={id}
                                    className={`p-2 rounded ${id === playerId ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                                >
                                    {id} {id === playerId && '(vous)'}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Chat */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Chat</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col h-96">
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4 p-2 border rounded">
                            {messages.length === 0 ? (
                                <p className="text-muted-foreground text-center">Aucun message</p>
                            ) : (
                                messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`p-2 rounded ${msg.from === playerId ? 'bg-primary text-primary-foreground ml-8' : 'bg-muted mr-8'}`}
                                    >
                                        <span className="font-bold text-xs opacity-70">{msg.from}</span>
                                        <p>{msg.text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Votre message..."
                            />
                            <Button onClick={handleSend}>Envoyer</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
