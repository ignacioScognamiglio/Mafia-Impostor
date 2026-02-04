import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    roomCode: v.string(),
    status: v.union(v.literal("waiting"), v.literal("in_progress"), v.literal("finished")),
    hostId: v.optional(v.id("players")),
    currentRound: v.number(),
    startTime: v.optional(v.number()),
    roundEndTime: v.optional(v.number()),
    lastRoundSummary: v.optional(v.string()),
    winner: v.optional(v.union(v.literal("villagers"), v.literal("impostor"))),
  }).index("by_room_code", ["roomCode"]),

  players: defineTable({
    gameId: v.id("games"),
    tokenIdentifier: v.string(), // Clerk User ID
    name: v.string(),
    avatar: v.string(),
    isHost: v.boolean(),
    role: v.optional(v.union(v.literal("asesino"), v.literal("curandero"), v.literal("detective"), v.literal("aldeano"))),
    status: v.union(v.literal("alive"), v.literal("dead")),
    readyForNext: v.optional(v.boolean()),
  })
  .index("by_game", ["gameId"])
  .index("by_token", ["tokenIdentifier"])
  .index("by_game_token", ["gameId", "tokenIdentifier"]), // To check if user is already in game

  actions: defineTable({
    gameId: v.id("games"),
    round: v.number(),
    actorId: v.id("players"),
    targetId: v.id("players"),
    actionType: v.union(v.literal("kill"), v.literal("heal"), v.literal("investigate")),
  }).index("by_game_round", ["gameId", "round"]),

  suspicions: defineTable({
    gameId: v.id("games"),
    round: v.number(),
    actorId: v.id("players"),
    targetId: v.id("players"),
  }).index("by_game_round", ["gameId", "round"]),
});