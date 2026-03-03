export type GamePhase = 'lobby' | 'clue' | 'discussion' | 'voting' | 'chameleon_guess' | 'results'

export interface Player {
  uid: string
  name: string
  avatar: string
  isHost: boolean
  isReady: boolean
  score: number
  clue?: string
  vote?: string
}

export interface ChatMessage {
  uid: string
  name: string
  text: string
  timestamp: number
  isSystem?: boolean
}

export interface GameRoom {
  id: string
  hostId: string
  phase: GamePhase
  players: Record<string, Player>
  topic: string
  secretWord: string
  chameleonId: string
  currentTurn: string
  turnOrder: string[]
  votes: Record<string, string>
  roundNumber: number
  maxRounds: number
  isPublic: boolean
  chameleonGuess?: string
  createdAt: number
  chat: ChatMessage[]
}
