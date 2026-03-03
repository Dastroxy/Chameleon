import React, { useState } from 'react'
import type { User } from 'firebase/auth'
import { collection, doc, setDoc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

type GamePhase = 'lobby' | 'clue' | 'discussion' | 'voting' | 'chameleon_guess' | 'results'
interface Player { uid: string; name: string; avatar: string; isHost: boolean; isReady: boolean; score: number; clue?: string; vote?: string }
interface ChatMessage { uid: string; name: string; text: string; timestamp: number; isSystem?: boolean }
interface GameRoom { id: string; hostId: string; phase: GamePhase; players: Record<string, Player>; topic: string; secretWord: string; chameleonId: string; currentTurn: string; turnOrder: string[]; votes: Record<string, string>; roundNumber: number; maxRounds: number; isPublic: boolean; chameleonGuess?: string; createdAt: number; chat: ChatMessage[] }

interface Props {
  user: User
  sessionId: string
  playerName: string
  onJoinRoom: (id: string) => void
}

const AVATARS = ['😀','😎','🤩','🥸','🤠','🧐','😏','🤫','🥳','😈','🦊','🐼']

export default function Lobby({ user, sessionId, playerName, onJoinRoom }: Props) {
  const [joinCode, setJoinCode] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'lobby'|'rules'>('lobby')
  const avatar = AVATARS[Math.abs(sessionId.charCodeAt(0) + sessionId.charCodeAt(1)) % AVATARS.length]

  const myPlayer: Player = {
    uid: sessionId, name: playerName, avatar, isHost: false, isReady: true, score: 0,
  }

  async function createRoom() {
    setCreating(true)
    try {
      const shortId = Math.random().toString(36).substring(2, 7).toUpperCase()
      const ref = doc(db, 'rooms', shortId)
      await setDoc(ref, {
        hostId: sessionId,
        phase: 'lobby',
        players: { [sessionId]: { ...myPlayer, isHost: true } },
        topic: '', secretWord: '', chameleonId: '', currentTurn: '',
        turnOrder: [], votes: {}, roundNumber: 1, maxRounds: 5, isPublic: false,
        chat: [{ uid: 'system', name: 'System', text: `Room created by ${playerName}.`, timestamp: Date.now(), isSystem: true }],
        createdAt: Date.now(),
      })
      onJoinRoom(shortId)
    } finally {
      setCreating(false)
    }
  }

  async function joinRoom(roomId: string) {
    if (!roomId.trim()) { alert('Please enter a room code'); return }
    const roomRef = doc(db, 'rooms', roomId.trim())
    const snap = await getDoc(roomRef)
    if (!snap.exists()) { alert('Room not found! Check the code and try again.'); return }
    const data = snap.data() as GameRoom
    if (data.phase !== 'lobby') { alert('Game already started!'); return }
    if (data.players[sessionId]) { onJoinRoom(roomId.trim()); return }
    if (Object.keys(data.players || {}).length >= 8) { alert('Room is full!'); return }
    await updateDoc(roomRef, {
      [`players.${sessionId}`]: { ...myPlayer, isHost: false },
      chat: arrayUnion({ uid: 'system', name: 'System', text: `${playerName} joined.`, timestamp: Date.now(), isSystem: true })
    })
    onJoinRoom(roomId.trim())
  }

  return (
    <div className="min-h-screen checker-bg font-display text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg checker-hero flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-white text-xl">comedy_mask</span>
          </div>
          <h1 className="text-lg font-black tracking-tight">Chameleon</h1>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
          <span className="text-lg">{avatar}</span>
          <span className="text-sm font-bold text-gray-600">{playerName}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {activeTab === 'lobby' ? (
          <>
            {/* Hero Banner */}
            <section className="checker-hero rounded-2xl p-6 flex flex-col items-center text-center gap-3 shadow-md">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-white">groups</span>
              </div>
              <h2 className="text-2xl font-black text-white">Ready to Blend In?</h2>
              <p className="text-green-100 text-sm max-w-xs">Create a room or join friends. Don't get caught!</p>
            </section>

            {/* Buttons */}
            <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <button
                onClick={createRoom}
                disabled={creating}
                className="w-full bg-primary text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-40">
                <span className="material-symbols-outlined">add_circle</span>
                {creating ? 'Creating...' : 'Create Room'}
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="w-full bg-gray-50 border-2 border-gray-200 text-gray-700 font-black py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:border-primary hover:text-primary">
                <span className="material-symbols-outlined">search</span> Join with Code
              </button>
            </section>

            {/* How to Play */}
            <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h4 className="font-black flex items-center gap-2 mb-2 text-gray-700">
                <span className="material-symbols-outlined text-primary text-lg">info</span> How to Play
              </h4>
              <p className="text-sm text-gray-500 leading-relaxed">
                Everyone knows the secret word except the <span className="font-black text-primary">Chameleon</span>. Give one-word clues, debate, then vote to catch them!
              </p>
            </section>
          </>
        ) : (
          <RulesPage />
        )}
      </main>

      {/* Bottom Nav */}
      <footer className="bg-white border-t border-gray-200 px-4 pb-8 pt-2">
        <div className="flex gap-2">
          {(['lobby','rules'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex flex-1 flex-col items-center gap-1 py-1 transition-colors ${activeTab === t ? 'text-primary' : 'text-gray-400'}`}>
              <span className="material-symbols-outlined text-[28px]">{t === 'lobby' ? 'videogame_asset' : 'menu_book'}</span>
              <p className="text-[11px] font-bold uppercase tracking-wider">{t}</p>
            </button>
          ))}
        </div>
      </footer>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-gray-100 shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary">meeting_room</span>
              <h3 className="text-xl font-black text-gray-900">Join Room</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">Enter the 5-character room code</p>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
              onKeyDown={e => e.key === 'Enter' && joinCode.length === 5 && (joinRoom(joinCode), setShowJoinModal(false))}
              placeholder="e.g. X7K2P"
              maxLength={5}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4 focus:outline-none focus:border-primary font-mono text-lg tracking-widest text-center transition-colors uppercase"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowJoinModal(false)} className="flex-1 bg-gray-100 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
              <button
                onClick={() => { joinRoom(joinCode); setShowJoinModal(false) }}
                disabled={joinCode.length !== 5}
                className="flex-1 bg-primary text-white py-3 rounded-xl font-black disabled:opacity-40 shadow-md"
              >Join</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RulesPage() {
  const rules = [
    { icon: '🃏', title: 'Setup', desc: '3–8 players. One random player is secretly the Chameleon.' },
    { icon: '🎯', title: 'Secret Word', desc: 'A Topic is revealed. All players except the Chameleon share a secret word.' },
    { icon: '💬', title: 'Give Clues', desc: 'Each player says ONE word related to the secret word. The Chameleon must bluff!' },
    { icon: '🗳️', title: 'Vote', desc: 'Debate who the Chameleon is, then everyone votes simultaneously.' },
    { icon: '🔍', title: 'Reveal', desc: 'If caught, the Chameleon gets one guess at the secret word to still escape!' },
    { icon: '🏆', title: 'Scoring', desc: 'Escapes undetected: +2pts. Caught but guesses right: +1pt. Caught & wrong: others +2pts. First to 5 wins!' },
  ]
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-black text-center text-gray-900">How to Play</h2>
      {rules.map((r, i) => (
        <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex gap-4">
          <span className="text-2xl">{r.icon}</span>
          <div>
            <p className="font-black text-primary">{r.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">{r.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
