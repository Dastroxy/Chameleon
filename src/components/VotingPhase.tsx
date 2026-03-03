import React, { useState } from 'react'
import type { User } from 'firebase/auth'
import { DocumentReference, updateDoc, arrayUnion } from 'firebase/firestore'
import { unflattenGrid } from '../data/topics'

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

const ROWS = ['A', 'B', 'C', 'D']
const COLS = ['1', '2', '3', '4']

export default function VotingPhase({ room, user, sessionId, roomRef, onLeave }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [guessCode, setGuessCode] = useState('')
  const [voted, setVoted] = useState(!!room.votes?.[sessionId])

  const players = Object.values(room.players || {})
  const isChameleon = room.chameleonId === sessionId
  const grid = room.topicGrid ? unflattenGrid(room.topicGrid) : []

  const voteCounts: Record<string, number> = {}
  Object.values(room.votes || {}).forEach(v => {
    voteCounts[v] = (voteCounts[v] || 0) + 1
  })

  async function confirmVote() {
    if (!selected) return
    const voteUpdate = { ...room.votes, [sessionId]: selected }
    const totalVotes = Object.keys(voteUpdate).length
    await updateDoc(roomRef, { [`votes.${sessionId}`]: selected })
    setVoted(true)

    if (totalVotes >= players.length) {
      let maxVotes = 0; let accused = ''
      Object.values(voteUpdate).forEach(v => {
        const c = Object.values(voteUpdate).filter(x => x === v).length
        if (c > maxVotes) { maxVotes = c; accused = v }
      })
      const isChameleonCaught = accused === room.chameleonId
      if (isChameleonCaught) {
        await updateDoc(roomRef, {
          phase: 'chameleon_guess',
          chat: arrayUnion({ uid: 'system', name: 'System', text: `🎯 ${room.players?.[accused]?.name} is accused! They are the Chameleon — can they guess the code?`, timestamp: Date.now(), isSystem: true })
        })
      } else {
        const updatedPlayers = { ...room.players }
        const chameleonPlayer = updatedPlayers[room.chameleonId]
        if (chameleonPlayer) updatedPlayers[room.chameleonId] = { ...chameleonPlayer, score: chameleonPlayer.score + 2 }
        await updateDoc(roomRef, {
          phase: 'results', players: updatedPlayers,
          chat: arrayUnion({ uid: 'system', name: 'System', text: `😈 The Chameleon (${chameleonPlayer?.name}) escaped! +2 points!`, timestamp: Date.now(), isSystem: true })
        })
      }
    }
  }

  async function submitGuess() {
    if (!guessCode.trim()) return
    const correct = guessCode.trim().toUpperCase() === room.secretCode.toUpperCase()
    const updatedPlayers = { ...room.players }
    const chameleonPlayer = updatedPlayers[room.chameleonId]
    if (chameleonPlayer) updatedPlayers[room.chameleonId] = { ...chameleonPlayer, score: chameleonPlayer.score + (correct ? 1 : 0) }
    if (!correct) {
      Object.keys(updatedPlayers).forEach(uid => {
        if (uid !== room.chameleonId) updatedPlayers[uid] = { ...updatedPlayers[uid], score: updatedPlayers[uid].score + 2 }
      })
    }
    await updateDoc(roomRef, {
      phase: 'results', players: updatedPlayers, chameleonGuess: guessCode.trim().toUpperCase(),
      chat: arrayUnion({ uid: 'system', name: 'System', text: correct ? `🎉 Correct! Chameleon guessed ${guessCode.toUpperCase()} and escapes with 1pt!` : `❌ Wrong! The code was "${room.secretCode}" (${room.secretWord}). Others get 2pts!`, timestamp: Date.now(), isSystem: true })
    })
  }

  if (room.phase === 'chameleon_guess') {
    return (
      <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
        <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between shadow-sm">
          <button onClick={onLeave} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
          <div className="text-center">
            <h2 className="text-lg font-black">Chameleon Caught!</h2>
            <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Final Chance</p>
          </div>
          <div className="size-10" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-10">
          <div className="checker-hero rounded-2xl p-5 text-center shadow-md">
            <span className="text-5xl">🦎</span>
            <h2 className="text-white text-2xl font-black mt-2">Chameleon Caught!</h2>
            <p className="text-green-100 mt-1 text-sm">
              <strong>{room.players?.[room.chameleonId]?.name}</strong> must guess the secret code!
            </p>
          </div>

          {/* Topic grid */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="checker-hero px-4 py-3 flex items-center justify-between">
              <p className="text-white font-black text-base">📋 {room.topic}</p>
              <span className="text-green-100 text-xs font-bold uppercase tracking-wider">Topic Grid</span>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-5 gap-1 mb-1">
                <div />
                {COLS.map(c => (
                  <div key={c} className="text-center text-[11px] font-black text-gray-400">{c}</div>
                ))}
              </div>
              {ROWS.map((row, ri) => (
                <div key={row} className="grid grid-cols-5 gap-1 mb-1">
                  <div className="flex items-center justify-center text-[11px] font-black text-gray-400">{row}</div>
                  {COLS.map((col, ci) => {
                    const code = `${row}${col}`
                    const isSelected = guessCode === code
                    return (
                      <button key={col}
                        onClick={() => isChameleon && setGuessCode(isSelected ? '' : code)}
                        disabled={!isChameleon}
                        className={`rounded-lg px-1 py-2 text-center text-[11px] font-bold leading-tight transition-all
                          ${isSelected
                            ? 'bg-primary text-white shadow-md ring-2 ring-primary/40'
                            : 'bg-gray-50 border border-gray-100 text-gray-700 hover:border-primary/30'}`}>
                        {grid[ri]?.[ci] || ''}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {isChameleon ? (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                <p className="text-gray-500 text-sm mb-1">Selected code:</p>
                <p className={`text-3xl font-black ${guessCode ? 'text-primary' : 'text-gray-300'}`}>
                  {guessCode || '—'}
                </p>
                <p className="text-gray-400 text-xs mt-1">Tap a cell above to select</p>
              </div>
              <button onClick={submitGuess} disabled={!guessCode}
                className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-40">
                Submit Guess
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                <p className="text-sm">Waiting for Chameleon to guess...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
      <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between sticky top-0 z-10 shadow-sm">
        <button onClick={onLeave} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100">
          <span className="material-symbols-outlined text-gray-500">close</span>
        </button>
        <div className="text-center">
          <h2 className="text-lg font-black">Vote Phase</h2>
          <p className="text-xs text-primary font-bold uppercase tracking-wider">Who is the Chameleon?</p>
        </div>
        <div className="size-10" />
      </div>

      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
          <span>Votes cast</span>
          <span>{Object.keys(room.votes || {}).length}/{players.length}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
            style={{ width: `${(Object.keys(room.votes || {}).length / players.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <h3 className="text-xl font-black text-center mb-5 text-gray-800">
          Who is the <span className="text-primary">Chameleon</span>?
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {players.filter(p => p.uid !== sessionId).map(p => {
            const isSelected = selected === p.uid
            const alreadyVotedThis = room.votes?.[sessionId] === p.uid
            return (
              <button key={p.uid}
                onClick={() => !voted && setSelected(isSelected ? null : p.uid)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all shadow-sm
                  ${isSelected || alreadyVotedThis
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-gray-200 bg-white hover:border-primary/40'}`}>
                {(isSelected || alreadyVotedThis) && (
                  <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-0.5">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </div>
                )}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-4 checker-card ${isSelected ? 'border-primary' : 'border-gray-200'}`}>
                  {p.avatar}
                </div>
                <p className="font-black text-gray-900 text-sm">{p.name}</p>
                {voteCounts[p.uid] > 0
                  ? <p className="text-primary text-xs font-bold">{voteCounts[p.uid]} vote{voteCounts[p.uid] > 1 ? 's' : ''}</p>
                  : <p className="text-gray-400 text-[10px] uppercase tracking-wide">Player</p>
                }
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 bg-white border-t border-gray-200 shadow-lg">
        {voted ? (
          <div className="w-full py-4 bg-primary/10 text-primary font-black rounded-xl text-center border border-primary/20">
            ✅ Vote Submitted — Waiting for others...
          </div>
        ) : (
          <button onClick={confirmVote} disabled={!selected}
            className="w-full py-4 bg-primary text-white font-black rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-40">
            CONFIRM VOTE
          </button>
        )}
      </div>
    </div>
  )
}
