import { Card, CardContent } from '@/components/ui/card'
import { User } from 'lucide-react'

interface Player {
    id: string
    position: string | null
    status: string
    isReadyToStart: boolean
}

interface PlayerListProps {
    players: Player[]
    playerId: string | null
}

const TOTAL_SLOTS = 4

export function PlayerList({ players, playerId }: PlayerListProps) {
    const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => players[i] ?? null)

    return (
        <div className="grid grid-cols-4 gap-4">
            {slots.map((player, i) => (
                <Card key={player?.id ?? `empty-${i}`} className={`${player?.id === playerId ? 'border-primary' : ''}`}>
                    <CardContent className="flex flex-col items-center gap-2 py-4">
                        {player ? (
                            <>
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold uppercase">
                                    <User />
                                </div>
                                <span className="text-sm font-medium truncate max-w-full">
                                    {player.id}{player.id === playerId && ' (vous)'}
                                </span>
                                {player.isReadyToStart ? <span className="text-xs text-green-500">Prêt</span> : <span className="text-xs text-gray-500">Pas prêt</span>}
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30" />
                                <span className="text-sm text-muted-foreground">En attente...</span>
                            </>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
