import React, { useState, useEffect } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from './firebase'
import Auth from './components/Auth'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'

function getSessionId() {
  let sid = sessionStorage.getItem('chameleon_sid')
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('chameleon_sid', sid)
  }
  return sid
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const sessionId = getSessionId()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#102222', color: '#0df2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>
        <span style={{ marginRight: 12, fontSize: 36 }}>🦎</span> Loading...
      </div>
    )
  }

  if (!user || !playerName) {
    return (
      <Auth
        onSignIn={(name) => {
          signInAnonymously(auth).then(() => setPlayerName(name))
        }}
        playerName={playerName}
        setPlayerName={setPlayerName}
      />
    )
  }

  if (currentRoomId) {
    return (
      <GameRoom
        roomId={currentRoomId}
        user={user}
        sessionId={sessionId}
        playerName={playerName}
        onLeave={() => setCurrentRoomId(null)}
      />
    )
  }

  return <Lobby user={user} sessionId={sessionId} playerName={playerName} onJoinRoom={setCurrentRoomId} />
}
