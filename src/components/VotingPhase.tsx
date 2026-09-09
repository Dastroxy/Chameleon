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
  showChat?: () => void
}

const ROWS = ['A', 'B', 'C', 'D']
const COLS = ['1', '2', '3', '4']

export default function VotingPhase({ room, user, sessionId, roomRef, onLeave, showChat }: Props) {
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
          chat: arrayUnion({ uid: 'system', name: 'System', text: `🎯 ${room.players?.[accused]?.name} was accused with the most votes! They are the Chameleon — can they guess the secret code?`, timestamp: Date.now(), isSystem: true })
        })
      } else {
        const updatedPlayers = { ...room.players }
        const chameleonPlayer = updatedPlayers[room.chameleonId]
        if (chameleonPlayer) updatedPlayers[room.chameleonId] = { ...chameleonPlayer, score: chameleonPlayer.score + 2 }
        await updateDoc(roomRef, {
          phase: 'results', players: updatedPlayers,
          chat: arrayUnion({ uid: 'system', name: 'System', text: `😈 The Chameleon (${chameleonPlayer?.name}) fooled everyone and escaped! +2 points to Chameleon!`, timestamp: Date.now(), isSystem: true })
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
      chat: arrayUnion({ uid: 'system', name: 'System', text: correct ? `🎉 Incredible! The Chameleon correctly guessed "${room.secretCode}" (${room.secretWord}) and scored 1 point!` : `❌ Wrong guess! The secret code was "${room.secretCode}" (${room.secretWord}). Non-chameleons get 2 points each!`, timestamp: Date.now(), isSystem: true })
    })
  }

  if (room.phase === 'chameleon_guess') {
    return (
      <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
        <div className="w-full max-w-lg mx-auto flex flex-col flex-1 min-h-screen shadow-sm sm:border-x sm:border-gray-200/50 bg-transparent">
          <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between shadow-sm sticky top-0 z-10">
            <button onClick={onLeave} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <span className="material-symbols-outlined text-gray-500">close</span>
            </button>
            <div className="text-center">
              <h2 className="text-lg font-black tracking-tight">Chameleon Caught!</h2>
              <p className="text-xs text-red-500 font-bold uppercase tracking-wider">Final Guess Phase</p>
            </div>
            {showChat ? (
              <button onClick={showChat} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-primary transition-colors relative">
                <span className="material-symbols-outlined">chat</span>
              </button>
            ) : <div className="size-10" />}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-12">
            <div className="checker-hero rounded-2xl p-5 text-center shadow-md">
              <span className="text-5xl">🦎</span>
              <h2 className="text-white text-2xl font-black mt-2">Chameleon's Last Stand</h2>
              <p className="text-emerald-50 mt-1 text-sm font-medium">
                <strong>{room.players?.[room.chameleonId]?.name}</strong> must deduce and select the secret word!
              </p>
            </div>

            {/* Topic grid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="checker-hero px-4 py-3 flex items-center justify-between">
                <p className="text-white font-black text-base flex items-center gap-1.5">
                  <span>📋</span> {room.topic}
                </p>
                <span className="text-emerald-50 text-xs font-bold uppercase tracking-wider">Tap a cell</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-5 gap-1.5 mb-1.5">
                  <div />
                  {COLS.map(c => (
                    <div key={c} className="text-center text-xs font-black text-gray-400">{c}</div>
                  ))}
                </div>
                {ROWS.map((row, ri) => (
                  <div key={row} className="grid grid-cols-5 gap-1.5 mb-1.5">
                    <div className="flex items-center justify-center text-xs font-black text-gray-400">{row}</div>
                    {COLS.map((col, ci) => {
                      const code = `${row}${col}`
                      const isSelected = guessCode === code
                      return (
                        <button key={col}
                          onClick={() => isChameleon && setGuessCode(isSelected ? '' : code)}
                          disabled={!isChameleon}
                          className={`rounded-xl px-1.5 py-2.5 text-center text-xs font-black leading-snug min-h-[44px] flex items-center justify-center break-words hyphens-auto transition-all
                            ${isSelected
                              ? 'bg-primary text-white shadow-md ring-2 ring-primary/50 scale-[1.02]'
                              : 'bg-gray-50 border border-gray-100 text-gray-800 hover:border-primary/40'}`}>
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
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Selected Coordinate:</p>
                  <p className={`text-4xl font-black font-mono ${guessCode ? 'text-primary' : 'text-gray-300'}`}>
                    {guessCode || '—'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1 font-medium">Tap any cell in the grid above to lock in your guess</p>
                </div>
                <button onClick={submitGuess} disabled={!guessCode}
                  className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 text-base">
                  Submit Guess ({guessCode || 'Select a cell'})
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
                <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                  <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                  <p className="text-sm font-bold">Waiting for {room.players?.[room.chameleonId]?.name || 'the Chameleon'} to guess the secret word...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1 min-h-screen shadow-sm sm:border-x sm:border-gray-200/50 bg-transparent">
        <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between sticky top-0 z-10 shadow-sm">
          <button onClick={onLeave} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
          <div className="text-center">
            <h2 className="text-lg font-black tracking-tight">Vote Phase</h2>
            <p className="text-xs text-primary font-bold uppercase tracking-wider">Who is the Chameleon?</p>
          </div>
          {showChat ? (
            <button onClick={showChat} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-primary transition-colors relative">
              <span className="material-symbols-outlined">chat</span>
              {(room.chat || []).length > 0 && (
                <span className="absolute top-1 right-1 size-2.5 bg-primary rounded-full ring-2 ring-white" />
              )}
            </button>
          ) : <div className="size-10" />}
        </div>

        <div className="bg-white px-4 py-3 border-b border-gray-100">
          <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
            <span>Votes cast</span>
            <span className="text-primary font-black">{Object.keys(room.votes || {}).length}/{players.length}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(Object.keys(room.votes || {}).length / players.length) * 100}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 pb-32">
          <h3 className="text-xl font-black text-center mb-1 text-gray-800">
            Cast Your Accusation
          </h3>
          <p className="text-center text-xs text-gray-400 font-medium mb-5">
            Pick the player whose clue seemed most suspicious
          </p>

          <div className="grid grid-cols-2 gap-3">
            {players.filter(p => p.uid !== sessionId).map(p => {
              const isSelected = selected === p.uid
              const alreadyVotedThis = room.votes?.[sessionId] === p.uid
              return (
                <button key={p.uid}
                  onClick={() => !voted && setSelected(isSelected ? null : p.uid)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all shadow-sm
                    ${isSelected || alreadyVotedThis
                      ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                      : 'border-gray-200 bg-white hover:border-primary/40'}`}>
                  {(isSelected || alreadyVotedThis) && (
                    <div className="absolute top-2.5 right-2.5 bg-primary text-white rounded-full p-1 shadow">
                      <span className="material-symbols-outlined text-sm block">check</span>
                    </div>
                  )}
                  <div className={`size-14 rounded-full flex items-center justify-center text-2xl border-2 checker-card ${isSelected ? 'border-primary' : 'border-gray-200'}`}>
                    {p.avatar}
                  </div>
                  <div className="text-center w-full">
                    <p className="font-black text-gray-900 text-sm truncate">{p.name}</p>
                    {p.clue && (
                      <p className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded mt-1 truncate">
                        "{p.clue}"
                      </p>
                    )}
                  </div>
                  {voteCounts[p.uid] > 0 ? (
                    <p className="text-primary text-xs font-black bg-primary/10 px-2 py-0.5 rounded-full mt-0.5">
                      {voteCounts[p.uid]} vote{voteCounts[p.uid] > 1 ? 's' : ''}
                    </p>
                  ) : (
                    <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">Player</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg z-20">
          <div className="max-w-lg mx-auto">
            {voted ? (
              <div className="w-full py-4 bg-primary/10 text-primary font-black rounded-xl text-center border border-primary/20 shadow-sm">
                ✅ Accusation Submitted — Waiting for all players...
              </div>
            ) : (
              <button onClick={confirmVote} disabled={!selected}
                className="w-full py-4 bg-primary text-white font-black rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 text-base">
                CONFIRM ACCUSATION
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
