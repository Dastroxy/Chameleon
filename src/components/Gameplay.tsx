import React, { useState, useEffect, useRef } from 'react'
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
  readyToVote?: Record<string, boolean>
}

interface Props {
  room: GameRoom
  user: User
  sessionId: string
  roomRef: DocumentReference
  onLeave: () => void
  showChat: () => void
}

const ROWS = ['A', 'B', 'C', 'D']
const COLS = ['1', '2', '3', '4']
const DISCUSSION_SECONDS = 180

export default function Gameplay({ room, user, sessionId, roomRef, onLeave, showChat }: Props) {
  const [clueInput, setClueInput] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(DISCUSSION_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasAdvanced = useRef(false)

  const players = Object.values(room.players || {})
  const me = room.players?.[sessionId]
  const isChameleon = room.chameleonId === sessionId
  const isMyTurn = room.currentTurn === sessionId
  const alreadyGaveClue = !!me?.clue
  const isHost = room.hostId === sessionId
  const turnOrder = room.turnOrder || []
  const grid = room.topicGrid ? unflattenGrid(room.topicGrid) : []

  const readyToVote = room.readyToVote || {}
  const iMeReadyToVote = !!readyToVote[sessionId]
  const readyCount = Object.keys(readyToVote).length
  const totalPlayers = players.length

  useEffect(() => {
    if (room.phase !== 'discussion') {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeLeft(DISCUSSION_SECONDS)
      hasAdvanced.current = false
      return
    }
    setTimeLeft(DISCUSSION_SECONDS)
    hasAdvanced.current = false
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          if (isHost && !hasAdvanced.current) {
            hasAdvanced.current = true
            moveToVoting()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [room.phase])

  useEffect(() => {
    if (room.phase !== 'discussion') return
    if (readyCount >= totalPlayers && totalPlayers > 0 && isHost && !hasAdvanced.current) {
      hasAdvanced.current = true
      moveToVoting()
    }
  }, [readyCount, totalPlayers, room.phase])

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs = String(timeLeft % 60).padStart(2, '0')
  const timerPct = (timeLeft / DISCUSSION_SECONDS) * 100
  const timerColor = timeLeft > 60 ? 'bg-primary' : timeLeft > 30 ? 'bg-yellow-400' : 'bg-red-500'

  async function submitClue() {
    if (!clueInput.trim() || !isMyTurn) return
    const clue = clueInput.trim()
    const myIndex = turnOrder.indexOf(sessionId)
    const remaining = turnOrder.slice(myIndex + 1).filter(id => !room.players?.[id]?.clue)
    const nextTurn = remaining[0] || ''
    await updateDoc(roomRef, {
      [`players.${sessionId}.clue`]: clue,
      currentTurn: nextTurn,
      chat: arrayUnion({ uid: sessionId, name: me?.name || 'Player', text: `"${clue}"`, timestamp: Date.now() })
    })
    const updatedPlayers = { ...room.players, [sessionId]: { ...me!, clue } }
    const allDone = turnOrder.every(id => !!updatedPlayers[id]?.clue)
    if (allDone) {
      await updateDoc(roomRef, {
        phase: 'discussion',
        readyToVote: {},
        chat: arrayUnion({ uid: 'system', name: 'System', text: '💬 All clues submitted! Discuss who the Chameleon is...', timestamp: Date.now(), isSystem: true })
      })
    }
    setClueInput('')
  }

  async function moveToVoting() {
    await updateDoc(roomRef, {
      phase: 'voting',
      votes: {},
      readyToVote: {},
      chat: arrayUnion({ uid: 'system', name: 'System', text: '🗳️ Time to vote! Who is the Chameleon?', timestamp: Date.now(), isSystem: true })
    })
  }

  async function markReadyToVote() {
    await updateDoc(roomRef, { [`readyToVote.${sessionId}`]: true })
  }

  return (
    <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between sticky top-0 z-10 shadow-sm">
        <button onClick={onLeave} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100">
          <span className="material-symbols-outlined text-gray-500">close</span>
        </button>
        <div className="text-center">
          <h2 className="text-base font-black">
            {room.phase === 'clue' ? '🎯 Clue Phase' : '💬 Discussion'}
          </h2>
          <p className="text-xs text-gray-400">Topic: {room.topic}</p>
        </div>
        <button onClick={showChat} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-primary">
          <span className="material-symbols-outlined">chat</span>
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-10">

        {/* Discussion block at TOP */}
        {room.phase === 'discussion' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">timer</span>
                  <p className="font-black text-gray-700">💬 Discussion Time!</p>
                </div>
                <span className={`font-black text-xl tabular-nums ${timeLeft <= 30 ? 'text-red-500' : timeLeft <= 60 ? 'text-yellow-500' : 'text-primary'}`}>
                  {mins}:{secs}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
                  style={{ width: `${timerPct}%` }} />
              </div>
              <p className="text-gray-400 text-xs mt-2 text-center">
                {timeLeft > 0 ? 'Debate who the Chameleon is before time runs out!' : "⏰ Time's up! Moving to vote..."}
              </p>
            </div>

            {iMeReadyToVote ? (
              <div className="w-full py-4 bg-primary/10 text-primary font-black rounded-xl text-center border border-primary/20">
                ✅ Ready to Vote! ({readyCount}/{totalPlayers})
              </div>
            ) : (
              <button onClick={markReadyToVote}
                className="w-full bg-primary text-white font-black py-4 rounded-xl text-lg shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">how_to_vote</span>
                Start Voting
                <span className="text-sm font-bold opacity-70">({readyCount}/{totalPlayers})</span>
              </button>
            )}
          </div>
        )}

        {/* Game Log */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3">Game Log</h4>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-2">
            {[...(room.chat || [])].slice(-10).reverse().map((msg, i) => {
              const isClue = !msg.isSystem && msg.text.startsWith('"') && msg.text.endsWith('"')
              return (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-2 py-1 ${isClue ? 'bg-red-50 border border-red-100' : ''}`}>
                  <span className={`text-xs font-black shrink-0 ${msg.isSystem ? 'text-primary' : isClue ? 'text-red-500' : 'text-secondary'}`}>
                    {msg.isSystem ? '⚙' : msg.name}:
                  </span>
                  <span className={`text-xs font-bold ${isClue ? 'text-red-600 uppercase tracking-wide' : 'text-gray-500'}`}>
                    {isClue ? msg.text.replace(/"/g, '').toUpperCase() : msg.text}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Players Row */}
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-4 gap-2">
            {players.map(p => (
              <div key={p.uid} className={`flex flex-col items-center gap-1 transition-opacity ${room.currentTurn === p.uid ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-4 bg-gray-50 ${room.currentTurn === p.uid ? 'border-primary' : 'border-gray-200'}`}>
                  {p.avatar}
                </div>
                <span className="text-[10px] font-bold truncate w-full text-center text-gray-600">
                  {p.uid === sessionId ? 'You' : p.name}
                </span>
                {p.clue && <span className="text-[9px] text-primary font-bold truncate max-w-full">"{p.clue}"</span>}
                {room.phase === 'discussion' && readyToVote[p.uid] && (
                  <span className="text-[9px] text-emerald-500 font-black">✓ ready</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Topic Grid Card */}
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
                  const isSecret = !isChameleon && revealed && room.secretCode === code
                  return (
                    <div key={col}
                      className={`rounded-lg px-1 py-2 text-center text-[11px] font-bold leading-tight transition-all
                        ${isSecret
                          ? 'bg-primary text-white shadow-md ring-2 ring-primary/40'
                          : 'bg-gray-50 border border-gray-100 text-gray-700'}`}>
                      {grid[ri]?.[ci] || ''}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Secret Code / Chameleon Role Card */}
        {isChameleon ? (
          <div className="rounded-2xl overflow-hidden shadow-md border-2 border-red-200">
            <div className="bg-red-500 p-4 text-center">
              <span className="text-4xl">🦎</span>
              <p className="text-white font-black text-xl mt-1">You are the Chameleon!</p>
            </div>
            <div className="bg-red-50 p-4 text-center">
              <p className="text-red-500 text-sm font-medium">You don't know the secret code.</p>
              <p className="text-red-400 text-sm">Study the grid, bluff your clue and blend in!</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Your Secret Code</p>
              <button onClick={() => setRevealed(!revealed)}
                className="bg-primary text-white text-xs font-black h-8 px-3 rounded-lg shadow-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">{revealed ? 'visibility_off' : 'visibility'}</span>
                {revealed ? 'Hide' : 'Reveal'}
              </button>
            </div>
            <div className="p-4 flex items-center justify-center gap-4">
              {revealed ? (
                <>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-md">
                      <span className="text-white font-black text-3xl tracking-wider">{room.secretCode}</span>
                    </div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Code</p>
                  </div>
                  <div className="text-2xl text-gray-300">→</div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-16 px-5 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                      <span className="text-primary font-black text-xl">{room.secretWord}</span>
                    </div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Secret Word</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  {[0, 1].map(i => (
                    <div key={i} className={`${i === 0 ? 'w-16 h-16' : 'h-16 px-8'} rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center`}>
                      <span className="text-gray-300 font-black text-2xl">?</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center pb-3">Give a subtle clue — don't reveal your code!</p>
          </div>
        )}

        {/* Clue Input */}
        {room.phase === 'clue' && isMyTurn && !alreadyGaveClue && (
          <div className="flex gap-2">
            <input type="text" value={clueInput}
              onChange={e => setClueInput(e.target.value.split(' ')[0])}
              onKeyDown={e => e.key === 'Enter' && submitClue()}
              placeholder="One word clue..."
              maxLength={20}
              className="flex-1 bg-white border-2 border-primary/30 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary font-medium shadow-sm"
            />
            <button onClick={submitClue} disabled={!clueInput.trim()}
              className="bg-primary text-white font-black px-5 rounded-xl disabled:opacity-40 shadow-sm">
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        )}

        {room.phase === 'clue' && !isMyTurn && (
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
            <p className="text-gray-400 text-sm">
              Waiting for <strong className="text-gray-700">{room.players?.[room.currentTurn]?.name || 'next player'}</strong>...
            </p>
          </div>
        )}

        {room.phase === 'clue' && isMyTurn && alreadyGaveClue && (
          <div className="bg-primary/10 rounded-xl p-4 text-center border border-primary/20">
            <p className="text-primary font-bold text-sm">✅ Clue submitted! Waiting for others...</p>
          </div>
        )}

      </main>
    </div>
  )
}
