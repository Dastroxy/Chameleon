import React, { useState, useRef, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { DocumentReference, updateDoc, arrayUnion } from 'firebase/firestore'

type GamePhase = 'lobby' | 'clue' | 'discussion' | 'voting' | 'chameleon_guess' | 'results'
interface Player { uid: string; name: string; avatar: string; isHost: boolean; isReady: boolean; score: number; clue?: string; vote?: string }
interface ChatMessage { uid: string; name: string; text: string; timestamp: number; isSystem?: boolean }
interface GameRoom { id: string; hostId: string; phase: GamePhase; players: Record<string, Player>; topic: string; secretWord: string; chameleonId: string; currentTurn: string; turnOrder: string[]; votes: Record<string, string>; roundNumber: number; maxRounds: number; isPublic: boolean; chameleonGuess?: string; createdAt: number; chat: ChatMessage[] }

interface Props {
  room: GameRoom
  user: User
  sessionId: string
  roomRef: DocumentReference
  onClose: () => void
}

export default function Chat({ room, user, sessionId, roomRef, onClose }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const me = room.players?.[sessionId]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.chat])

  async function sendMessage() {
    if (!input.trim()) return
    await updateDoc(roomRef, {
      chat: arrayUnion({ uid: sessionId, name: me?.name || 'Player', text: input.trim(), timestamp: Date.now() })
    })
    setInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(234,236,238,0.97)' }}>
      <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">chat</span>
          <h3 className="font-black text-gray-900">Chat</h3>
        </div>
        <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100">
          <span className="material-symbols-outlined text-gray-500">close</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(room.chat || []).map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.uid === sessionId ? 'flex-row-reverse' : ''}`}>
            {msg.isSystem ? (
              <p className="text-xs text-primary italic text-center w-full font-medium py-1">⚙ {msg.text}</p>
            ) : (
              <>
                <div className="text-xl shrink-0">{room.players?.[msg.uid]?.avatar || '😀'}</div>
                <div className={`max-w-[72%] rounded-2xl px-3 py-2 shadow-sm ${msg.uid === sessionId ? 'bg-primary text-white rounded-tr-sm' : 'bg-white text-gray-900 border border-gray-100 rounded-tl-sm'}`}>
                  {msg.uid !== sessionId && <p className="text-[10px] font-black mb-0.5 text-gray-400">{msg.name}</p>}
                  <p className="text-sm font-medium">{msg.text}</p>
                </div>
              </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-4 bg-white border-t border-gray-200 shadow-lg">
        <input type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Say something..."
          className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:border-primary font-medium transition-colors"
        />
        <button onClick={sendMessage} disabled={!input.trim()}
          className="bg-primary text-white font-black px-4 rounded-xl disabled:opacity-40 shadow-sm">
          <span className="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  )
}
