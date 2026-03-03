import React from 'react'
import type { User } from 'firebase/auth'
import { DocumentReference, updateDoc, arrayUnion } from 'firebase/firestore'
import { TOPICS, ROWS, getRandomCode, flattenGrid } from '../data/topics'

type GamePhase = 'lobby' | 'clue' | 'discussion' | 'voting' | 'chameleon_guess' | 'results'
interface Player { uid: string; name: string; avatar: string; isHost: boolean; isReady: boolean; score: number; clue?: string; vote?: string }
interface ChatMessage { uid: string; name: string; text: string; timestamp: number; isSystem?: boolean }
interface GameRoom {
  id: string; hostId: string; phase: GamePhase; players: Record<string, Player>
  topic: string; topicGrid: Record<string, string>
  secretCode: string; secretWord: string
  chameleonId: string; currentTurn: string; turnOrder: string[]
  votes: Record<string, string>; roundNumber: number; maxRounds: number
  isPublic: boolean; chameleonGuess?: string; createdAt: number; chat: ChatMessage[]
}

interface Props {
  room: GameRoom
  user: User
  sessionId: string
  roomRef: DocumentReference
  onLeave: () => void
}

export default function Results({ room, user, sessionId, roomRef, onLeave }: Props) {
  const players = Object.values(room.players || {}).sort((a, b) => b.score - a.score)
  const chameleon = room.players?.[room.chameleonId]
  const isHost = room.hostId === sessionId
  const winner = players.find(p => p.score >= 5)
  const chameleonCaught = Object.values(room.votes || {}).filter(v => v === room.chameleonId).length > players.length / 2
  const guessedCorrectly = room.chameleonGuess?.toUpperCase() === room.secretCode?.toUpperCase()

  async function playAgain() {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]
    const secretCode = getRandomCode()
    const rowIndex = ROWS.indexOf(secretCode[0])
    const colIndex = parseInt(secretCode[1]) - 1
    const secretWord = topic.grid[rowIndex][colIndex]
    const playerIds = Object.keys(room.players || {})
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
    const chameleonId = shuffled[0]
    const turnOrder = [...shuffled.slice(1), shuffled[0]]
    const resetPlayers: Record<string, any> = {}
    Object.entries(room.players || {}).forEach(([uid, p]) => {
      resetPlayers[uid] = { ...p, clue: '', vote: '' }
    })
    await updateDoc(roomRef, {
      phase: 'clue',
      topic: topic.name,
      topicGrid: flattenGrid(topic.grid),
      secretCode,
      secretWord,
      chameleonId,
      currentTurn: turnOrder[0],
      turnOrder,
      votes: {},
      chameleonGuess: '',
      roundNumber: (room.roundNumber || 1) + 1,
      players: resetPlayers,
      chat: arrayUnion({ uid: 'system', name: 'System', text: `🔄 Round ${(room.roundNumber || 1) + 1} starts! Topic: ${topic.name}`, timestamp: Date.now(), isSystem: true })
    })
  }

  const outcomeConfig = !chameleonCaught
    ? { emoji: '😈', title: 'Chameleon Escaped!', bg: 'bg-yellow-500', light: 'bg-yellow-50 border-yellow-200' }
    : guessedCorrectly
    ? { emoji: '🦎', title: 'Chameleon Guessed Right!', bg: 'bg-yellow-500', light: 'bg-yellow-50 border-yellow-200' }
    : { emoji: '🎉', title: 'Chameleon Caught!', bg: 'bg-primary', light: 'bg-primary/5 border-primary/20' }

  return (
    <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
      <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between shadow-sm">
        <button onClick={onLeave} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100">
          <span className="material-symbols-outlined text-gray-500">close</span>
        </button>
        <h2 className="text-lg font-black">Results</h2>
        <div className="size-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        <div className="rounded-2xl overflow-hidden shadow-md">
          <div className={`${outcomeConfig.bg} p-5 text-center`}>
            <span className="text-5xl">{outcomeConfig.emoji}</span>
            <h2 className="text-white text-2xl font-black mt-2">{outcomeConfig.title}</h2>
          </div>
          <div className={`${outcomeConfig.light} p-4 text-center border-x border-b rounded-b-2xl`}>
            <p className="text-gray-600 text-sm font-medium">
              <strong>{chameleon?.name}</strong> was the Chameleon.
            </p>
            {room.secretCode && (
              <p className="text-gray-500 text-sm mt-1">
                Secret code was{' '}
                <strong className="text-primary">{room.secretCode}</strong>
                {' '}→{' '}
                <strong className="text-primary">{room.secretWord}</strong>
              </p>
            )}
            {room.chameleonGuess && (
              <p className="text-gray-400 text-xs mt-1">
                Chameleon guessed: <strong className={guessedCorrectly ? 'text-primary' : 'text-red-400'}>{room.chameleonGuess}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="font-black text-sm uppercase tracking-wider text-gray-400 mb-3">Clues Given</h3>
          <div className="space-y-2">
            {(room.turnOrder || []).map(uid => {
              const p = room.players?.[uid]
              if (!p) return null
              return (
                <div key={uid} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{p.avatar}</span>
                    <span className={`text-sm font-bold ${uid === room.chameleonId ? 'text-red-500' : 'text-gray-700'}`}>
                      {p.name}{uid === room.chameleonId ? ' 🦎' : ''}
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm font-medium">"{p.clue || '—'}"</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="font-black text-sm uppercase tracking-wider text-gray-400 mb-3">Scoreboard</h3>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={p.uid} className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? 'checker-card border-2 border-primary/20' : 'bg-gray-50 border border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm font-bold w-5">{i + 1}</span>
                  <span className="text-lg">{p.avatar}</span>
                  <div>
                    <span className="font-bold text-gray-900">{p.name}{p.uid === sessionId ? ' (You)' : ''}</span>
                    {p.uid === room.chameleonId && <span className="ml-2 text-[10px] text-red-500 font-black bg-red-50 px-1.5 py-0.5 rounded">CHAMELEON</span>}
                  </div>
                </div>
                <span className={`font-black text-xl ${i === 0 ? 'text-primary' : 'text-gray-400'}`}>{p.score}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">First to 5 points wins!</p>
        </div>

        {winner && (
          <div className="checker-hero rounded-2xl p-5 text-center shadow-md">
            <div className="text-4xl mb-2">🏆</div>
            <h3 className="text-2xl font-black text-white">{winner.name} Wins!</h3>
            <p className="text-green-100 text-sm mt-1">Reached 5 points first!</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg space-y-2">
        {isHost && !winner && (
          <button onClick={playAgain}
            className="w-full bg-primary text-white font-black py-4 rounded-xl text-lg shadow-md active:scale-95 transition-all">
            Play Again →
          </button>
        )}
        {!isHost && !winner && (
          <p className="text-center text-gray-400 text-sm py-2">Waiting for host to start next round...</p>
        )}
        <button onClick={onLeave} className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors">
          Leave Room
        </button>
      </div>
    </div>
  )
}
