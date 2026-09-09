import React, { useState } from 'react'

interface Props {
  onSignIn: (name: string) => void
  playerName: string
  setPlayerName: (n: string) => void
}

export default function Auth({ onSignIn, playerName, setPlayerName }: Props) {
  const [input, setInput] = useState(playerName)

  return (
    <div className="min-h-screen checker-bg font-display flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo card */}
        <div className="checker-hero rounded-2xl p-6 flex flex-col items-center mb-4 shadow-lg text-center">
          <span className="material-symbols-outlined text-white text-6xl mb-2">comedy_mask</span>
          <h1 className="text-3xl font-black text-white tracking-tight">Chameleon</h1>
          <p className="text-emerald-100 text-sm mt-1 font-medium">The social deduction word game</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Name</label>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && input.trim() && onSignIn(input.trim())}
            placeholder="Enter your name..."
            maxLength={16}
            autoFocus
            className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium mb-4"
          />
          <button
            onClick={() => input.trim() && onSignIn(input.trim())}
            disabled={!input.trim()}
            className="w-full bg-primary text-white font-black py-4 rounded-xl text-lg shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-40"
          >
            Enter the Game
          </button>
        </div>
      </div>
    </div>
  )
}
