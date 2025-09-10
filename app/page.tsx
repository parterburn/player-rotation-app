"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Users, RotateCcw, Play, Pause, Plus, Minus } from "lucide-react"

interface Player {
  name: string
  playTime: number
  isPlaying: boolean
  position?: string
  lastPlayedTime: number // Track when player last played for fair rotation
}

interface GameState {
  isActive: boolean
  currentSide: "offense" | "defense"
  playCount: number
}

interface ScoreState {
  us: number
  them: number
}

const OFFENSE_POSITIONS = ["QB", "C", "RB", "X", "Y", "Z"]
const DEFENSE_POSITIONS = ["1", "2", "3", "4", "5", "6"]
const ROTATING_OFFENSE = ["C", "RB", "X", "Y", "Z"] // QB doesn't rotate

const STORAGE_KEYS = {
  PLAYERS: "football-tracker-players",
  GAME_STATE: "football-tracker-game-state",
  LINEUP: "football-tracker-lineup",
  ROSTER: "football-tracker-roster",
  SCORE: "football-tracker-score",
  QUARTERBACK: "football-tracker-quarterback",
}

const validateLineup = (lineup: Record<string, string>): boolean => {
  const playerNames = Object.values(lineup).filter((name) => name && name !== "Unassigned")
  const uniqueNames = new Set(playerNames)
  return playerNames.length === uniqueNames.size
}

const findDuplicatePlayer = (lineup: Record<string, string>): string | null => {
  const playerCounts: Record<string, string[]> = {}

  Object.entries(lineup).forEach(([position, playerName]) => {
    if (playerName && playerName !== "Unassigned") {
      if (!playerCounts[playerName]) {
        playerCounts[playerName] = []
      }
      playerCounts[playerName].push(position)
    }
  })

  for (const [playerName, positions] of Object.entries(playerCounts)) {
    if (positions.length > 1) {
      console.log(`[v0] VALIDATION ERROR: ${playerName} is assigned to multiple positions: ${positions.join(", ")}`)
      return playerName
    }
  }

  return null
}

export default function FootballRotationTracker() {
  const [playersText, setPlayersText] = useState("Leo\nAlex\nBeckett\nBreck\nCamdenCarter\nIsaac\nJacob\nReagan\nRiley")
  const [players, setPlayers] = useState<Player[]>([])
  const [gameState, setGameState] = useState<GameState>({
    isActive: false,
    currentSide: "offense",
    playCount: 0,
  })
  const [currentLineup, setCurrentLineup] = useState<Record<string, string>>({})
  const [nextUpPlayers, setNextUpPlayers] = useState<Record<string, string>>({})
  const [rotationQueue, setRotationQueue] = useState<Array<{ position: string; player: string }>>([])
  const [score, setScore] = useState<ScoreState>({ us: 0, them: 0 })
  const [selectedQuarterback, setSelectedQuarterback] = useState<string>("")
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false)
  const [previousState, setPreviousState] = useState<{
    players: Player[]
    lineup: Record<string, string>
    rotationQueue: Array<{ position: string; player: string }>
    playCount: number
  } | null>(null)
  const [nextUpShown, setNextUpShown] = useState<boolean>(false)

  useEffect(() => {
    const savedRoster = localStorage.getItem(STORAGE_KEYS.ROSTER)
    const savedPlayers = localStorage.getItem(STORAGE_KEYS.PLAYERS)
    const savedGameState = localStorage.getItem(STORAGE_KEYS.GAME_STATE)
    const savedLineup = localStorage.getItem(STORAGE_KEYS.LINEUP)
    const savedScore = localStorage.getItem(STORAGE_KEYS.SCORE)
    const savedQuarterback = localStorage.getItem(STORAGE_KEYS.QUARTERBACK)

    if (savedRoster) {
      setPlayersText(savedRoster)
    }
    if (savedPlayers) {
      setPlayers(JSON.parse(savedPlayers))
    }
    if (savedGameState) {
      setGameState(JSON.parse(savedGameState))
    }
    if (savedLineup) {
      setCurrentLineup(JSON.parse(savedLineup))
    }
    if (savedScore) {
      setScore(JSON.parse(savedScore))
    }
    if (savedQuarterback) {
      setSelectedQuarterback(savedQuarterback)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROSTER, playersText)
  }, [playersText])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players))
  }, [players])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(gameState))
  }, [gameState])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LINEUP, JSON.stringify(currentLineup))
  }, [currentLineup])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCORE, JSON.stringify(score))
  }, [score])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUARTERBACK, selectedQuarterback)
  }, [selectedQuarterback])

  useEffect(() => {
    if (gameState.isActive) {
      updateNextUpPlayers()
    }
  }, [currentLineup, players, gameState.currentSide, gameState.isActive])

  useEffect(() => {
    const playerNames = playersText.split("\n").filter((name) => name.trim())
    setPlayers(
      playerNames.map((name) => ({
        name: name.trim(),
        playTime: 0,
        isPlaying: false,
        lastPlayedTime: 0,
      })),
    )
  }, [playersText])

  const getPlayersByFairRotation = () => {
    return [...players]
      .filter((p) => !p.isPlaying)
      .sort((a, b) => {
        if (a.playTime !== b.playTime) {
          return a.playTime - b.playTime
        }
        return a.lastPlayedTime - b.lastPlayedTime
      })
  }

  const getPlayersByPlayTime = () => {
    return [...players].sort((a, b) => a.playTime - b.playTime)
  }

  const updateNextUpPlayers = (side?: "offense" | "defense") => {
    const currentSide = side || gameState.currentSide
    console.log("[v0] updateNextUpPlayers called with side:", side, "currentSide:", currentSide)
    const positions = currentSide === "offense" ? ROTATING_OFFENSE : DEFENSE_POSITIONS
    console.log("[v0] Selected positions:", positions)
    const availablePlayers = getPlayersByFairRotation()

    const queueHasWrongPositions =
      rotationQueue.length > 0 && rotationQueue.some((pair) => !positions.includes(pair.position))

    if (rotationQueue.length === 0 || queueHasWrongPositions) {
      const initialQueue: Array<{ position: string; player: string }> = []

      // Create a longer queue that cycles through positions
      for (let i = 0; i < Math.min(availablePlayers.length, positions.length * 2); i++) {
        const position = positions[i % positions.length]
        const player = availablePlayers[i]
        if (player) {
          initialQueue.push({
            position: position,
            player: player.name,
          })
        }
      }
      console.log("[v0] Created initial queue:", initialQueue)
      setRotationQueue(initialQueue)

      const nextUp: Record<string, string> = {}
      const numToShow = Math.min(3, initialQueue.length)

      for (let i = 0; i < numToShow; i++) {
        const pair = initialQueue[i]
        if (pair) {
          nextUp[pair.position] = pair.player
        }
      }

      console.log("[v0] Setting nextUpPlayers:", nextUp)
      setNextUpPlayers(nextUp)
      return
    }

    // Show only the first 3 in the queue as "Next Up"
    const nextUp: Record<string, string> = {}
    const numToShow = Math.min(3, rotationQueue.length)

    for (let i = 0; i < numToShow; i++) {
      const pair = rotationQueue[i]
      if (pair) {
        nextUp[pair.position] = pair.player
      }
    }

    console.log("[v0] Setting nextUpPlayers:", nextUp)
    setNextUpPlayers(nextUp)
  }

  const toggleGame = () => {
    if (!gameState.isActive) {
      assignInitialLineup()
      setTimeout(() => {
        updateNextUpPlayers()
      }, 200)
    }
    setGameState((prev) => ({ ...prev, isActive: !prev.isActive }))
  }

  const handleNewGame = () => {
    const confirmed = confirm("Are you sure you want to start a new game? This will reset all player stats and lineup.")
    if (confirmed) {
      newGame()
    }
  }

  const newGame = () => {
    const playerNames = playersText.split("\n").filter((name) => name.trim())
    setPlayers(
      playerNames.map((name) => ({
        name: name.trim(),
        playTime: 0,
        isPlaying: false,
        lastPlayedTime: 0,
      })),
    )
    setGameState({
      isActive: false,
      currentSide: "offense",
      playCount: 0,
    })
    setCurrentLineup({})
    setNextUpPlayers({})
    setRotationQueue([])
    setScore({ us: 0, them: 0 })
    setSelectedQuarterback("") // Clear quarterback selection when starting new game
    setPreviousState(null) // Clear previous state when starting new game

    localStorage.removeItem(STORAGE_KEYS.PLAYERS)
    localStorage.removeItem(STORAGE_KEYS.GAME_STATE)
    localStorage.removeItem(STORAGE_KEYS.LINEUP)
    localStorage.removeItem(STORAGE_KEYS.SCORE)
    localStorage.removeItem(STORAGE_KEYS.QUARTERBACK) // Remove quarterback from localStorage
  }

  const assignInitialLineup = (side?: "offense" | "defense") => {
    const currentSide = side || gameState.currentSide
    const positions = currentSide === "offense" ? OFFENSE_POSITIONS : DEFENSE_POSITIONS
    const newLineup: Record<string, string> = {}
    const newPlayers = [...players]

    // Keep track of who was playing before we clear the lineup
    const previouslyPlayingPlayers = newPlayers.filter(player => player.isPlaying).map(player => player.name)

    newPlayers.forEach((player) => {
      player.isPlaying = false
      player.position = undefined
    })

    if (currentSide === "offense" && selectedQuarterback) {
      newLineup["QB"] = selectedQuarterback
      const qbIndex = newPlayers.findIndex((p) => p.name === selectedQuarterback)
      if (qbIndex !== -1) {
        newPlayers[qbIndex].isPlaying = true
        newPlayers[qbIndex].position = "QB"
      }
    }

    const remainingPositions = positions.filter((pos) => pos !== "QB" || currentSide === "defense")
    
    // Prioritize players who were NOT on the field previously when switching sides
    const availablePlayers = [...players]
      .filter((p) => p.name !== selectedQuarterback || currentSide === "defense")
      .sort((a, b) => {
        // First priority: players who were NOT playing previously
        const aWasPlaying = previouslyPlayingPlayers.includes(a.name)
        const bWasPlaying = previouslyPlayingPlayers.includes(b.name)
        
        if (aWasPlaying !== bWasPlaying) {
          return aWasPlaying ? 1 : -1 // Non-playing players first
        }
        
        // Second priority: players with less play time
        return a.playTime - b.playTime
      })

    remainingPositions.forEach((position, index) => {
      if (availablePlayers[index]) {
        const playerName = availablePlayers[index].name

        // Double-check this player isn't already assigned
        if (!Object.values(newLineup).includes(playerName)) {
          newLineup[position] = playerName
          const playerIndex = newPlayers.findIndex((p) => p.name === playerName)
          if (playerIndex !== -1) {
            newPlayers[playerIndex].isPlaying = true
            newPlayers[playerIndex].position = position
          }
        }
      }
    })

    const duplicatePlayer = findDuplicatePlayer(newLineup)
    if (duplicatePlayer) {
      console.error(`[v0] LINEUP VALIDATION FAILED: ${duplicatePlayer} assigned to multiple positions`)
      return // Don't set invalid lineup
    }

    setCurrentLineup(newLineup)
    setPlayers(newPlayers)
    setRotationQueue([])
  }

  const rotatePlayersForNextPlay = () => {
    if (!gameState.isActive || rotationQueue.length === 0) return

    const duplicatePlayer = findDuplicatePlayer(currentLineup)
    if (duplicatePlayer) {
      console.error(`[v0] ROTATION BLOCKED: Current lineup has duplicate player ${duplicatePlayer}`)
      return
    }

    setPreviousState({
      players: [...players],
      lineup: { ...currentLineup },
      rotationQueue: [...rotationQueue],
      playCount: gameState.playCount,
    })

    const positions = gameState.currentSide === "offense" ? ROTATING_OFFENSE : DEFENSE_POSITIONS
    const newPlayers = [...players]
    const newLineup = { ...currentLineup }

    if (nextUpShown) {
      newPlayers.forEach((player) => {
        if (player.isPlaying) {
          player.playTime += 1
        }
      })
    }

    const nextPair = rotationQueue[0]
    if (!nextPair) return

    const { position, player: incomingPlayerName } = nextPair

    const incomingPlayerIndex = newPlayers.findIndex((p) => p.name === incomingPlayerName)
    if (
      incomingPlayerIndex !== -1 &&
      newPlayers[incomingPlayerIndex].isPlaying &&
      newPlayers[incomingPlayerIndex].position !== position
    ) {
      console.error(
        `[v0] ROTATION BLOCKED: ${incomingPlayerName} is already playing at ${newPlayers[incomingPlayerIndex].position}`,
      )
      return
    }

    // Remove current player from this position
    const currentPlayerName = currentLineup[position]
    if (currentPlayerName) {
      const currentPlayerIndex = newPlayers.findIndex((p) => p.name === currentPlayerName)
      if (currentPlayerIndex !== -1) {
        newPlayers[currentPlayerIndex].isPlaying = false
        newPlayers[currentPlayerIndex].lastPlayedTime = gameState.playCount
        newPlayers[currentPlayerIndex].position = undefined
      }
    }

    // Add incoming player to this position
    if (incomingPlayerIndex !== -1) {
      newPlayers[incomingPlayerIndex].isPlaying = true
      newPlayers[incomingPlayerIndex].position = position
      newLineup[position] = incomingPlayerName
    }

    const newDuplicatePlayer = findDuplicatePlayer(newLineup)
    if (newDuplicatePlayer) {
      console.error(`[v0] ROTATION VALIDATION FAILED: ${newDuplicatePlayer} would be assigned to multiple positions`)
      return
    }

    const newQueue = [...rotationQueue]
    newQueue.shift() // Remove the player who just went in

    // Add a new player to the end of the queue
    const availablePlayers = getPlayersByFairRotation()
    const currentQueuePlayers = new Set(newQueue.map((pair) => pair.player))
    const newAvailablePlayer = availablePlayers.find((p) => !currentQueuePlayers.has(p.name))

    if (newAvailablePlayer) {
      const queuePositions = newQueue.map((pair) => pair.position)
      let nextPosition = positions[0] // Default to first position

      // Find the next position that should be in rotation
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i]
        if (!queuePositions.includes(pos)) {
          nextPosition = pos
          break
        }
      }

      // If all positions are covered, cycle to the next one after the current position
      if (queuePositions.length >= 3) {
        const currentPosIndex = positions.indexOf(position)
        const nextPosIndex = (currentPosIndex + newQueue.length + 1) % positions.length
        nextPosition = positions[nextPosIndex]
      }

      newQueue.push({
        position: nextPosition,
        player: newAvailablePlayer.name,
      })
    }

    setRotationQueue(newQueue)
    setPlayers(newPlayers)
    setCurrentLineup(newLineup)
    if (nextUpShown) {
      setGameState((prev) => ({ ...prev, playCount: prev.playCount + 1 }))
    }
  }

  const showNextUp = () => {
    setNextUpShown(true)
    updateNextUpPlayers()
  }

  const undoLastPlay = () => {
    if (!previousState) return

    setPlayers(previousState.players)
    setCurrentLineup(previousState.lineup)
    setRotationQueue(previousState.rotationQueue)
    setGameState((prev) => ({ ...prev, playCount: previousState.playCount }))
    setPreviousState(null) // Clear previous state after undo
  }

  const switchSides = () => {
    setGameState((prev) => ({
      ...prev,
      currentSide: prev.currentSide === "offense" ? "defense" : "offense",
      playCount: prev.playCount + 1,
    }))

    setTimeout(() => {
      assignInitialLineup()
      setTimeout(() => {
        updateNextUpPlayers()
      }, 50)
    }, 100)
  }

  const updateScore = (team: "us" | "them", change: number) => {
    setScore((prev) => ({
      ...prev,
      [team]: Math.max(0, prev[team] + change),
    }))
  }

  const resetScore = () => {
    setScore({ us: 0, them: 0 })
  }

  const handleQuarterbackChange = (newQB: string) => {
    setSelectedQuarterback(newQB)

    if (gameState.isActive && gameState.currentSide === "offense") {
      const newPlayers = [...players]
      const newLineup = { ...currentLineup }

      // Find if the new QB is currently playing another position
      const newQBPlayerIndex = newPlayers.findIndex((p) => p.name === newQB)
      const currentQBPosition = newPlayers[newQBPlayerIndex]?.position

      if (currentQBPosition && currentQBPosition !== "QB") {
        // New QB is playing another position, need to find a replacement
        const availablePlayers = newPlayers.filter((p) => !p.isPlaying && p.name !== newQB)

        if (availablePlayers.length > 0) {
          // Sort by play time to get fairest replacement
          const replacement = availablePlayers.sort((a, b) => a.playTime - b.playTime)[0]

          // Replace the new QB's old position with the replacement
          newLineup[currentQBPosition] = replacement.name
          const replacementIndex = newPlayers.findIndex((p) => p.name === replacement.name)
          if (replacementIndex !== -1) {
            newPlayers[replacementIndex].isPlaying = true
            newPlayers[replacementIndex].position = currentQBPosition
          }
        }
      }

      // Remove old QB from QB position if there was one
      const oldQB = currentLineup["QB"]
      if (oldQB && oldQB !== newQB) {
        const oldQBIndex = newPlayers.findIndex((p) => p.name === oldQB)
        if (oldQBIndex !== -1) {
          newPlayers[oldQBIndex].isPlaying = false
          newPlayers[oldQBIndex].position = undefined
        }
      }

      // Set new QB
      newLineup["QB"] = newQB
      if (newQBPlayerIndex !== -1) {
        newPlayers[newQBPlayerIndex].isPlaying = true
        newPlayers[newQBPlayerIndex].position = "QB"
      }

      // Validate the lineup before applying changes
      const duplicatePlayer = findDuplicatePlayer(newLineup)
      if (duplicatePlayer) {
        console.error(`[v0] QB CHANGE BLOCKED: ${duplicatePlayer} would be assigned to multiple positions`)
        return
      }

      setCurrentLineup(newLineup)
      setPlayers(newPlayers)

      // Update Next Up after QB change
      setTimeout(() => {
        updateNextUpPlayers()
      }, 50)
    }
  }

  const currentPositions = gameState.currentSide === "offense" ? OFFENSE_POSITIONS : DEFENSE_POSITIONS
  const sideColors =
    gameState.currentSide === "offense"
      ? "text-red-600 bg-red-50 border-red-200"
      : "text-blue-600 bg-blue-50 border-blue-200"

  return (
    <div className="min-h-screen bg-background p-2 max-w-md mx-auto">
      <div className="space-y-3">
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-bold text-primary">Youth Football Tracker</CardTitle>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{players.length} Players</span>
              <span>•</span>
              <span>Play #{gameState.playCount}</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <Button onClick={handleNewGame} variant="outline" size="sm" className="px-3 bg-transparent">
                New Game
              </Button>
              <Button onClick={toggleGame} className="flex-1" variant={gameState.isActive ? "secondary" : "default"}>
                {gameState.isActive ? (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Start
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="game" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="game" className="text-xs">
              Game
            </TabsTrigger>
            <TabsTrigger value="scoreboard" className="text-xs">
              Score
            </TabsTrigger>
            <TabsTrigger value="players" className="text-xs">
              Players
            </TabsTrigger>
          </TabsList>

          <TabsContent value="game" className="space-y-3 mt-3">
            <Tabs
              value={gameState.currentSide}
              onValueChange={(value) => {
                if (value !== gameState.currentSide) {
                  const newSide = value as "offense" | "defense"
                  setGameState((prev) => ({
                    ...prev,
                    currentSide: newSide,
                    playCount: prev.playCount + 1,
                  }))
                  setNextUpShown(false)
                  setTimeout(() => {
                    assignInitialLineup(newSide)
                    setTimeout(() => {
                      updateNextUpPlayers(newSide)
                    }, 50)
                  }, 50)
                }
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="offense" className="text-xs">
                  🏈 Offense
                </TabsTrigger>
                <TabsTrigger value="defense" className="text-xs">
                  🛡️ Defense
                </TabsTrigger>
              </TabsList>

              <TabsContent value="offense" className="mt-3">
                {gameState.isActive ? (
                  <>
                    <Card className="border-red-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base text-red-700">🏈 OFFENSE</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-1">
                          {OFFENSE_POSITIONS.map((position) => (
                            <div
                              key={position}
                              className="flex items-center justify-between p-2 rounded text-sm bg-red-50"
                            >
                              <span className="font-medium pr-3">{position}:</span>
                              {position === "QB" ? (
                                <Select value={selectedQuarterback} onValueChange={handleQuarterbackChange}>
                                  <SelectTrigger className="h-6 w-full text-xs">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {players
                                      .slice()
                                      .sort((a, b) => a.name.localeCompare(b.name))
                                      .map((player) => (
                                        <SelectItem key={player.name} value={player.name}>
                                          {player.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-red-600">{currentLineup[position] || "Unassigned"}</span>
                              )}
                            </div>
                          ))}
                        </div>

                        {nextUpShown && Object.keys(nextUpPlayers).length > 0 && (
                          <div className="border-t pt-3">
                            <h4 className="text-sm font-medium mb-2 text-red-700">Next Up:</h4>
                            <div className="space-y-1">
                              {Object.entries(nextUpPlayers).map(([position, playerName]) => (
                                <div
                                  key={position}
                                  className="flex items-center justify-between p-1 bg-white rounded border text-sm"
                                >
                                  <span className="font-medium">{position}:</span>
                                  <span className="text-red-600 font-medium">{playerName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={undoLastPlay}
                        variant="outline"
                        size="sm"
                        disabled={!previousState}
                        className="px-3 bg-transparent"
                      >
                        ↶
                      </Button>
                      {!nextUpShown ? (
                        <Button onClick={showNextUp} className="flex-1" size="sm">
                          Show Next Up
                        </Button>
                      ) : (
                        <Button onClick={rotatePlayersForNextPlay} className="flex-1" size="sm">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Next Play - Rotate Players
                        </Button>
                      )}
                    </div>

                    <Card className="mt-3">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">🏈 Offensive Formation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-green-100 p-3 rounded-lg relative min-h-[120px]">
                          <div className="absolute top-4 left-2 right-2 h-0.5 bg-gray-800"></div>
                          <div className="absolute top-6 left-2 text-xs font-bold">X</div>
                          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 -translate-x-4 text-xs font-bold">
                            C
                          </div>
                          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 translate-x-8 text-xs font-bold">
                            Y
                          </div>
                          <div className="absolute top-6 right-2 text-xs font-bold">Z</div>
                          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 text-xs font-bold">
                            QB
                          </div>
                          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 text-xs font-bold">R</div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="pt-4 text-center text-muted-foreground">
                      <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Start the game to see current lineup</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="defense" className="mt-3">
                {gameState.isActive ? (
                  <>
                    <Card className="border-blue-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base text-blue-700">🛡️ DEFENSE</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-1">
                          {DEFENSE_POSITIONS.map((position) => (
                            <div
                              key={position}
                              className="flex items-center justify-between p-2 rounded text-sm bg-blue-50"
                            >
                              <span className="font-medium">{position}:</span>
                              <span className="text-blue-600">{currentLineup[position] || "Unassigned"}</span>
                            </div>
                          ))}
                        </div>

                        {nextUpShown && Object.keys(nextUpPlayers).length > 0 && (
                          <div className="border-t pt-3">
                            <h4 className="text-sm font-medium mb-2 text-blue-700">Next Up:</h4>
                            <div className="space-y-1">
                              {Object.entries(nextUpPlayers).map(([position, playerName]) => (
                                <div
                                  key={position}
                                  className="flex items-center justify-between p-1 bg-white rounded border text-sm"
                                >
                                  <span className="font-medium">{position}:</span>
                                  <span className="text-blue-600 font-medium">{playerName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={undoLastPlay}
                        variant="outline"
                        size="sm"
                        disabled={!previousState}
                        className="px-3 bg-transparent"
                      >
                        ↶
                      </Button>
                      {!nextUpShown ? (
                        <Button onClick={showNextUp} className="flex-1" size="sm">
                          Show Next Up
                        </Button>
                      ) : (
                        <Button onClick={rotatePlayersForNextPlay} className="flex-1" size="sm">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Next Play - Rotate Players
                        </Button>
                      )}
                    </div>

                    <Card className="mt-3">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">🛡️ Defensive Formation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-blue-100 p-3 rounded-lg relative min-h-[120px]">
                          <div className="absolute top-4 left-2 right-2 h-0.5 bg-gray-800"></div>
                          <div className="absolute top-6 left-2 text-xs font-bold">1</div>
                          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold">2</div>
                          <div className="absolute top-6 right-2 text-xs font-bold">3</div>
                          <div className="absolute top-16 left-2 text-xs font-bold">4</div>
                          <div className="absolute top-16 left-1/2 transform -translate-x-1/2">
                            <div className="relative">
                              <div className="absolute -inset-2 bg-red-200 rounded-full opacity-60"></div>
                              <div className="relative z-10">5</div>
                              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-transparent border-b-red-500"></div>
                              </div>
                            </div>
                          </div>
                          <div className="absolute top-16 right-2 text-xs font-bold">6</div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="pt-4 text-center text-muted-foreground">
                      <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Start the game to see current lineup</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="scoreboard" className="space-y-3 mt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-center">Scoreboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                    <div className="text-center flex-1">
                      <div className="text-xl font-bold text-primary">{score.us}</div>
                      <div className="text-xs text-muted-foreground">Us</div>
                    </div>
                    <div className="flex flex-col gap-1 ml-3">
                      <Button size="sm" onClick={() => updateScore("us", 1)} className="w-6 h-6 p-0">
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateScore("us", -1)} className="w-6 h-6 p-0">
                        <Minus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="text-center flex-1">
                      <div className="text-xl font-bold">{score.them}</div>
                      <div className="text-xs text-muted-foreground">Them</div>
                    </div>
                    <div className="flex flex-col gap-1 ml-3">
                      <Button size="sm" onClick={() => updateScore("them", 1)} className="w-6 h-6 p-0">
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateScore("them", -1)}
                        className="w-6 h-6 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="players" className="space-y-3 mt-3">
            {!gameState.isActive ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Edit Roster</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    One player per line. Edit if kids show up late or drop out.
                  </p>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={playersText}
                    onChange={(e) => setPlayersText(e.target.value)}
                    placeholder="Enter player names, one per line..."
                    className="min-h-[150px] text-sm"
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Playing Time
                    </CardTitle>
                    <p className="text-xs text-muted-foreground text-left mt-1 mb-0">
                      Pause the game to edit the roster
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {players
                        .slice()
                        .sort((a, b) => a.playTime - b.playTime)
                        .map((player) => (
                          <div
                            key={player.name}
                            className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{player.name}</span>
                              {player.isPlaying && (
                                <Badge variant="secondary" className="text-xs px-1 py-0">
                                  {player.position}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{player.playTime}</span>
                              {player.isPlaying && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
