import React, { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { doc, onSnapshot, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { TOPICS, getRandomCode, flattenGrid } from '../data/topics'
import Gameplay from './Gameplay'
import VotingPhase from './VotingPhase'
import Results from './Results'
import Chat from './Chat'

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
  roomId: string
  user: User
  sessionId: string
  playerName: string
  onLeave: () => void
}

export default function GameRoom({ roomId, user, sessionId, playerName, onLeave }: Props) {
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [copied, setCopied] = useState(false)
  const roomRef = doc(db, 'rooms', roomId)

  useEffect(() => {
    const unsub = onSnapshot(roomRef, snap => {
      if (snap.exists()) setRoom({ id: snap.id, ...snap.data() } as GameRoom)
      else onLeave()
    })
    return unsub
  }, [roomId])

  if (!room) {
    return (
      <div className="min-h-screen checker-bg font-display flex flex-col items-center justify-center p-4">
        <div className="size-14 rounded-2xl checker-hero flex items-center justify-center shadow-md animate-pulse mb-3">
          <span className="material-symbols-outlined text-white text-2xl">comedy_mask</span>
        </div>
        <p className="text-primary font-bold text-sm tracking-wide">Loading room...</p>
      </div>
    )
  }

  const players = Object.values(room.players || {})
  const isHost = room.hostId === sessionId

  function copyRoomCode() {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function startGame() {
    if (players.length < 3) return

    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]
    const secretCode = getRandomCode()
    const rowIndex = ['A', 'B', 'C', 'D'].indexOf(secretCode[0])
    const colIndex = parseInt(secretCode[1]) - 1
    const secretWord = topic.grid[rowIndex]?.[colIndex] ?? ''

    if (!secretWord) return

    const shuffled = [...players.map(p => p.uid)].sort(() => Math.random() - 0.5)
    const chameleonId = shuffled[0]
    const turnOrder = [...shuffled.slice(1), shuffled[0]]

    try {
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
        chat: arrayUnion({
          uid: 'system',
          name: 'System',
          text: `🎮 Game started! Topic: ${topic.name}.`,
          timestamp: Date.now(),
          isSystem: true
        })
      })
    } catch (err) {
      console.error('startGame error:', err)
    }
  }

  async function leaveRoom() {
    try {
      const updatedPlayers = { ...room.players }
      delete updatedPlayers[sessionId]
      if (Object.keys(updatedPlayers).length === 0) {
        await deleteDoc(doc(db, 'rooms', roomId))
      } else {
        const newHostId = isHost ? Object.values(updatedPlayers)[0]?.uid || '' : room.hostId
        const update: any = { players: updatedPlayers, hostId: isHost ? newHostId : room.hostId }
        if (isHost && newHostId) update[`players.${newHostId}.isHost`] = true
        await updateDoc(roomRef, update)
      }
    } finally {
      onLeave()
    }
  }

  if (room.phase === 'clue' || room.phase === 'discussion') {
    return (
      <>
        <Gameplay room={room} user={user} sessionId={sessionId} roomRef={roomRef} onLeave={leaveRoom} showChat={() => setShowChat(true)} />
        {showChat && <Chat room={room} user={user} sessionId={sessionId} roomRef={roomRef} onClose={() => setShowChat(false)} />}
      </>
    )
  }

  if (room.phase === 'voting' || room.phase === 'chameleon_guess') {
    return (
      <>
        <VotingPhase room={room} user={user} sessionId={sessionId} roomRef={roomRef} onLeave={leaveRoom} showChat={() => setShowChat(true)} />
        {showChat && <Chat room={room} user={user} sessionId={sessionId} roomRef={roomRef} onClose={() => setShowChat(false)} />}
      </>
    )
  }

  if (room.phase === 'results') {
    return (
      <>
        <Results room={room} user={user} sessionId={sessionId} roomRef={roomRef} onLeave={leaveRoom} showChat={() => setShowChat(true)} />
        {showChat && <Chat room={room} user={user} sessionId={sessionId} roomRef={roomRef} onClose={() => setShowChat(false)} />}
      </>
    )
  }

  return (
    <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1 min-h-screen shadow-sm sm:border-x sm:border-gray-200/50 bg-transparent relative">
        <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between sticky top-0 z-10 shadow-sm">
          <button onClick={leaveRoom} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <span className="material-symbols-outlined text-gray-500">arrow_back</span>
          </button>
          <div className="text-center">
            <h2 className="text-lg font-black tracking-tight">Game Lobby</h2>
            <p className="text-xs font-mono font-bold text-gray-400 uppercase">#{roomId}</p>
          </div>
          <button onClick={() => setShowChat(true)} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-primary transition-colors relative">
            <span className="material-symbols-outlined">chat</span>
            {(room.chat || []).length > 1 && (
              <span className="absolute top-1 right-1 size-2.5 bg-primary rounded-full ring-2 ring-white" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-36 px-4 py-4 space-y-4">
          <div className="checker-hero rounded-2xl p-6 flex flex-col items-center text-center shadow-md">
            <span className="material-symbols-outlined text-5xl text-white mb-2">comedy_mask</span>
            <h1 className="text-white text-2xl font-black">Find the Chameleon</h1>
            <p className="text-emerald-50 text-sm mt-1 font-medium">Waiting for players to join...</p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
              <p className="text-primary text-3xl font-black">{players.length}/8</p>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mt-1">Players</p>
            </div>
            <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
              <p className="text-secondary text-3xl font-black">{8 - players.length}</p>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mt-1">Open Slots</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-bold">Room Code</p>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border-2 border-dashed border-primary/30">
              <code className="text-primary font-black text-2xl font-mono tracking-widest mr-2">{roomId}</code>
              <button
                onClick={copyRoomCode}
                className="flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-sm">{copied ? 'done' : 'content_copy'}</span>
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-black text-base mb-3 text-gray-700">Players ({players.length})</h3>
            <div className="space-y-2">
              {players.map(p => (
                <div key={p.uid} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full checker-card flex items-center justify-center text-xl border-2 border-primary/20">
                      {p.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{p.name}{p.uid === sessionId ? ' (You)' : ''}</p>
                      <p className="text-[10px] text-primary uppercase tracking-widest font-black">{p.isHost ? '👑 Host' : 'Player'}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg z-20">
          <div className="max-w-lg mx-auto">
            {isHost ? (
              <>
                <button
                  onClick={startGame}
                  disabled={players.length < 3}
                  className="w-full flex items-center justify-center gap-3 bg-primary text-white h-14 rounded-xl font-black text-lg shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-40"
                >
                  START GAME <span className="material-symbols-outlined">play_arrow</span>
                </button>
                {players.length < 3 && (
                  <p className="text-center text-gray-400 text-xs mt-2 font-medium">
                    Need {3 - players.length} more player{3 - players.length > 1 ? 's' : ''} to start (min 3)
                  </p>
                )}
              </>
            ) : (
              <div className="w-full py-3 text-center text-gray-500 text-sm font-bold flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-primary text-base">progress_activity</span>
                Waiting for host to start the game...
              </div>
            )}
          </div>
        </div>
      </div>
      {showChat && <Chat room={room} user={user} sessionId={sessionId} roomRef={roomRef} onClose={() => setShowChat(false)} />}
    </div>
  )
}
