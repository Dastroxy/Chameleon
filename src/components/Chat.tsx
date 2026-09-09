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
    const textToSend = input.trim()
    setInput('')
    await updateDoc(roomRef, {
      chat: arrayUnion({ uid: sessionId, name: me?.name || 'Player', text: textToSend, timestamp: Date.now() })
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-sm animate-fade-in font-display">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1 h-full bg-slate-50 shadow-2xl">
        <div className="flex items-center bg-white p-4 border-b border-gray-200 justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">chat</span>
            <h3 className="font-black text-gray-900 text-base">Game Room Chat</h3>
          </div>
          <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(room.chat || []).length === 0 && (
            <p className="text-center text-gray-400 text-xs py-8 font-medium">No messages yet. Say hello or discuss the clues!</p>
          )}
          {(room.chat || []).map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.uid === sessionId ? 'flex-row-reverse' : ''}`}>
              {msg.isSystem ? (
                <div className="w-full py-1 text-center">
                  <span className="inline-block text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200/60 font-semibold px-2.5 py-1 rounded-full">
                    {msg.text}
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-2xl shrink-0 select-none">{room.players?.[msg.uid]?.avatar || '😀'}</div>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm ${msg.uid === sessionId ? 'bg-primary text-white rounded-tr-sm' : 'bg-white text-gray-900 border border-gray-100 rounded-tl-sm'}`}>
                    {msg.uid !== sessionId && <p className="text-[10px] font-black mb-0.5 text-gray-400">{msg.name}</p>}
                    <p className="text-sm font-medium leading-snug break-words">{msg.text}</p>
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-3.5 bg-white border-t border-gray-200 shadow-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Send message to room..."
              autoFocus
              className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:border-primary focus:bg-white font-medium transition-all text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-primary text-white font-black px-4 rounded-xl disabled:opacity-40 shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-lg">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
