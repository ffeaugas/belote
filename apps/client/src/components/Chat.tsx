import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ChatMessage } from '@belote/shared'

interface ChatProps {
    messages: ChatMessage[]
    playerId: string | null
    sendMessage: (text: string) => void
}

export function Chat({ messages, playerId, sendMessage }: ChatProps) {
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

    return (
        <Card>
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
                                className={`p-2 rounded ${msg.playerId === playerId ? 'bg-primary text-primary-foreground ml-8' : 'bg-muted mr-8'}`}
                            >
                                <span className="font-bold text-xs opacity-70">{msg.playerId}</span>
                                <p>{msg.message}</p>
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
    )
}
