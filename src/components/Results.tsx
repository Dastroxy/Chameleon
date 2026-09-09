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
  readyToVote?: Record<string, boolean>
}

interface Props {
  room: GameRoom
  user: User
  sessionId: string
  roomRef: DocumentReference
  onLeave: () => void
  showChat?: () => void
}

export default function Results({ room, user, sessionId, roomRef, onLeave, showChat }: Props) {
  const players = Object.values(room.players || {}).sort((a, b) => b.score - a.score)
  const chameleon = room.players?.[room.chameleonId]
  const isHost = room.hostId === sessionId
  const winner = players.find(p => p.score >= 5)
  const chameleonCaught = Object.values(room.votes || {}).filter(v => v === room.chameleonId).length > players.length / 2
  const guessedCorrectly = room.chameleonGuess?.toUpperCase() === room.secretCode?.toUpperCase()

  async function nextRound() {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]
    const secretCode = getRandomCode()
    const rowIndex = ROWS.indexOf(secretCode[0])
    const colIndex = parseInt(secretCode[1]) - 1
    const secretWord = topic.grid[rowIndex]?.[colIndex] ?? ''
    if (!secretWord) return

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
      readyToVote: {},
      roundNumber: (room.roundNumber || 1) + 1,
      players: resetPlayers,
      chat: arrayUnion({
        uid: 'system', name: 'System',
        text: `🔄 Round ${(room.roundNumber || 1) + 1} starts! Topic: ${topic.name}`,
        timestamp: Date.now(), isSystem: true
      })
    })
  }

  async function newGame() {
    const resetPlayers: Record<string, any> = {}
    Object.entries(room.players || {}).forEach(([uid, p]) => {
      resetPlayers[uid] = { ...p, clue: '', vote: '', score: 0 }
    })
    await updateDoc(roomRef, {
      phase: 'lobby',
      topic: '',
      topicGrid: {},
      secretCode: '',
      secretWord: '',
      chameleonId: '',
      currentTurn: '',
      turnOrder: [],
      votes: {},
      chameleonGuess: '',
      readyToVote: {},
      roundNumber: 1,
      players: resetPlayers,
      chat: arrayUnion({
        uid: 'system', name: 'System',
        text: `🎮 New game started! Scores reset to 0. Host can start when ready.`,
        timestamp: Date.now(), isSystem: true
      })
    })
  }

  const outcomeConfig = !chameleonCaught
    ? { emoji: '😈', title: 'Chameleon Escaped!', bg: 'bg-amber-500', light: 'bg-amber-50 border-amber-200' }
    : guessedCorrectly
    ? { emoji: '🦎', title: 'Chameleon Guessed Right!', bg: 'bg-amber-500', light: 'bg-amber-50 border-amber-200' }
    : { emoji: '🎉', title: 'Chameleon Caught!', bg: 'bg-primary', light: 'bg-emerald-50 border-emerald-200' }

  return (
    <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1 min-h-screen shadow-sm sm:border-x sm:border-gray-200/50 bg-transparent relative">
        <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between shadow-sm sticky top-0 z-10">
          <button onClick={onLeave} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
          <h2 className="text-lg font-black tracking-tight">Round Results</h2>
          {showChat ? (
            <button onClick={showChat} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-primary transition-colors relative">
              <span className="material-symbols-outlined">chat</span>
              {(room.chat || []).length > 0 && (
                <span className="absolute top-1 right-1 size-2.5 bg-primary rounded-full ring-2 ring-white" />
              )}
            </button>
          ) : <div className="size-10" />}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-44">

          {/* Outcome Banner */}
          <div className="rounded-2xl overflow-hidden shadow-md">
            <div className={`${outcomeConfig.bg} p-5 text-center`}>
              <span className="text-5xl">{outcomeConfig.emoji}</span>
              <h2 className="text-white text-2xl font-black mt-2">{outcomeConfig.title}</h2>
            </div>
            <div className={`${outcomeConfig.light} p-4 text-center border-x border-b rounded-b-2xl`}>
              <p className="text-gray-700 text-sm font-bold">
                <strong>{chameleon?.name}</strong> was the secret Chameleon!
              </p>
              {room.secretCode && (
                <p className="text-gray-600 text-sm mt-1.5 font-medium">
                  Secret coordinate was{' '}
                  <strong className="text-primary font-mono font-black">{room.secretCode}</strong>
                  {' '}→{' '}
                  <strong className="text-primary font-black">"{room.secretWord}"</strong>
                </p>
              )}
              {room.chameleonGuess && (
                <p className="text-gray-500 text-xs mt-1.5 font-medium">
                  Chameleon guessed: <strong className={`font-mono font-bold ${guessedCorrectly ? 'text-emerald-600' : 'text-red-500'}`}>{room.chameleonGuess}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Clues Review */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-black text-xs uppercase tracking-wider text-gray-400 mb-3">Clues Recap</h3>
            <div className="space-y-2">
              {(room.turnOrder || []).map(uid => {
                const p = room.players?.[uid]
                if (!p) return null
                const isThisChameleon = uid === room.chameleonId
                return (
                  <div key={uid} className={`flex items-center justify-between p-2.5 rounded-xl ${isThisChameleon ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p.avatar}</span>
                      <span className={`text-sm font-bold ${isThisChameleon ? 'text-red-600 font-black' : 'text-gray-800'}`}>
                        {p.name}{isThisChameleon ? ' 🦎' : ''}
                      </span>
                    </div>
                    <span className={`text-xs font-black px-2 py-1 rounded-md ${isThisChameleon ? 'bg-red-100 text-red-700' : 'bg-white border border-gray-200 text-gray-700'}`}>
                      "{p.clue || '—'}"
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scoreboard */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-black text-xs uppercase tracking-wider text-gray-400 mb-3">Scoreboard</h3>
            <div className="space-y-2">
              {players.map((p, i) => (
                <div key={p.uid} className={`flex items-center justify-between p-3 rounded-xl transition-all ${i === 0 ? 'checker-card border-2 border-primary/20 shadow-sm' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs font-black w-4">{i + 1}</span>
                    <span className="text-xl">{p.avatar}</span>
                    <div>
                      <span className="font-bold text-gray-900 text-sm">{p.name}{p.uid === sessionId ? ' (You)' : ''}</span>
                      {p.uid === room.chameleonId && (
                        <span className="ml-2 text-[10px] text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded border border-red-200">CHAMELEON</span>
                      )}
                    </div>
                  </div>
                  <span className={`font-black text-xl tabular-nums ${i === 0 ? 'text-primary' : 'text-gray-500'}`}>{p.score} pts</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-3 text-center font-medium">First player to 5 points wins the match!</p>
          </div>

          {winner && (
            <div className="checker-hero rounded-2xl p-5 text-center shadow-md animate-bounce">
              <div className="text-4xl mb-1">🏆</div>
              <h3 className="text-2xl font-black text-white">{winner.name} Wins!</h3>
              <p className="text-emerald-100 text-sm mt-0.5 font-bold">Reached 5 points first!</p>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg z-20">
          <div className="max-w-lg mx-auto space-y-2">
            {isHost && winner && (
              <button onClick={newGame}
                className="w-full bg-primary text-white font-black py-4 rounded-xl text-lg shadow-md hover:brightness-105 active:scale-95 transition-all">
                🎮 New Game (Reset Scores)
              </button>
            )}
            {isHost && !winner && (
              <button onClick={nextRound}
                className="w-full bg-primary text-white font-black py-4 rounded-xl text-lg shadow-md hover:brightness-105 active:scale-95 transition-all">
                Next Round →
              </button>
            )}
            {!isHost && (
              <p className="text-center text-gray-500 text-sm py-2 font-bold flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-primary text-base">progress_activity</span>
                Waiting for host to start next round...
              </p>
            )}
            <button onClick={onLeave}
              className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 active:scale-98 transition-all text-sm">
              Leave Room
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
