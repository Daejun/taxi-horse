// What the mod keeps in the session: it outlives a reload of the mod, and
// ends with the session.

// Whether the session waits for something between turns, as the engine said
// when the last turn of the main loop ended.
export type IsWaiting = boolean

declare module 'claude-code' {
  interface PluginState {
    'taxi-horse': { isWaiting: IsWaiting }
  }
}
