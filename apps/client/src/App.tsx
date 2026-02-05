import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Room } from '@/components/Room'
import './index.css'
import type { Card as CardType } from '@belote/shared'

const cards: CardType[] = [
  {
    rank: 'A',
    suit: 'hearts'
  },
  {
    rank: 'K',
    suit: 'hearts'
  },
]

function useSimpleRouter() {
  const [path, setPath] = useState(window.location.pathname)

  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath)
    setPath(newPath)
  }

  window.onpopstate = () => setPath(window.location.pathname)

  return { path, navigate }
}

function Home({ navigate }: { navigate: (path: string) => void }) {
  const [joinRoomId, setJoinRoomId] = useState('')

  const createRoom = () => {
    const roomId = crypto.randomUUID().slice(0, 8)
    navigate(`/room/${roomId}`)
  }

  const joinRoom = () => {
    if (joinRoomId.trim()) {
      navigate(`/room/${joinRoomId.trim()}`)
    }
  }

  return (
    <div className="container mx-auto p-8 flex flex-col items-center gap-8">
      <h1 className="text-4xl font-bold">Belote</h1>

      <div className="flex flex-col md:flex-row gap-4">
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Nouvelle partie</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={createRoom} className="w-full">
              Créer une room
            </Button>
          </CardContent>
        </Card>

        <Card className="w-72">
          <CardHeader>
            <CardTitle>Rejoindre</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="Code de la room"
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            />
            <Button onClick={joinRoom} className="w-full" variant="outline">
              Rejoindre
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function App() {
  const { path, navigate } = useSimpleRouter()

  const roomMatch = path.match(/^\/room\/(.+)$/)
  if (roomMatch && roomMatch[1]) {
    return <Room roomId={roomMatch[1]} />
  }

  return <Home navigate={navigate} />
}

export default App
