import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper: Generate Room Code
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Shuffle
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// --- Mutations ---

export const createGame = mutation({
  args: {}, // No args needed, we get info from auth
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const roomCode = generateRoomCode();
    
    const gameId = await ctx.db.insert("games", {
      roomCode,
      status: "waiting",
      currentRound: 0,
    });

    const playerId = await ctx.db.insert("players", {
      gameId,
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name || identity.givenName || "Jugador",
      avatar: identity.pictureUrl || "",
      isHost: true,
      status: "alive",
    });

    await ctx.db.patch(gameId, { hostId: playerId });

    return { gameId, roomCode };
  },
});

export const joinGame = mutation({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const game = await ctx.db
      .query("games")
      .withIndex("by_room_code", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!game) throw new Error("La sala no existe");
    
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", game._id).eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (existingPlayer) {
      return { gameId: game._id, playerId: existingPlayer._id };
    }

    if (game.status !== "waiting") throw new Error("La partida ya ha comenzado");

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    if (players.length >= 10) throw new Error("La sala está llena (máximo 10 jugadores)");

    const playerId = await ctx.db.insert("players", {
      gameId: game._id,
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name || identity.givenName || "Jugador",
      avatar: identity.pictureUrl || "",
      isHost: false,
      status: "alive",
      readyForNext: true, // Ready by default when joining first time
    });

    return { gameId: game._id, playerId };
  },
});

export const restartGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Juego no encontrado");

    const player = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", args.gameId).eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!player || !player.isHost) throw new Error("Solo el anfitrión puede reiniciar");

    // Reset Game to waiting but keep current players
    await ctx.db.patch(args.gameId, {
      status: "waiting",
      currentRound: 0,
      startTime: undefined,
      roundEndTime: undefined,
      lastRoundSummary: undefined,
      winner: undefined,
    });

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    for (const p of players) {
      await ctx.db.patch(p._id, {
        role: undefined,
        status: "alive",
        readyForNext: p.isHost ? true : false, // Host is ready by default
      });
    }

    // Clean actions
    const actions = await ctx.db
      .query("actions")
      .withIndex("by_game_round", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const a of actions) await ctx.db.delete(a._id);

    const suspicions = await ctx.db
      .query("suspicions")
      .withIndex("by_game_round", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const s of suspicions) await ctx.db.delete(s._id);
  },
});

export const acceptNextGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const player = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", args.gameId).eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!player) throw new Error("Jugador no encontrado");
    await ctx.db.patch(player._id, { readyForNext: true });
  },
});

export const castSuspicion = mutation({
  args: {
    gameId: v.id("games"),
    targetId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "in_progress") throw new Error("Juego no activo");

    const player = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", args.gameId).eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!player || player.status !== "alive" || player.role !== "aldeano") throw new Error("Solo aldeanos vivos pueden sospechar");

    // Check if already voted this round?
    const existing = await ctx.db
      .query("suspicions")
      .withIndex("by_game_round", (q) => q.eq("gameId", args.gameId).eq("round", game.currentRound))
      .filter((q) => q.eq(q.field("actorId"), player._id))
      .first();

    if (existing) {
        // Update vote
        await ctx.db.patch(existing._id, { targetId: args.targetId });
    } else {
        await ctx.db.insert("suspicions", {
            gameId: args.gameId,
            round: game.currentRound,
            actorId: player._id,
            targetId: args.targetId
        });
    }
  },
});

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ... (helpers)

export const startGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Juego no encontrado");

    const player = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", args.gameId).eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!player || !player.isHost) throw new Error("Solo el anfitrión puede iniciar");

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Check if everyone is ready (if restarting)
    if (game.status === "waiting" && game.currentRound === 0) {
      const unready = players.filter(p => !p.readyForNext);
      if (unready.length > 0) throw new Error("Esperando a que todos acepten jugar");
    }

    if (players.length < 3) throw new Error("Se necesitan al menos 3 jugadores");

    let roles: string[] = [];
    const playerCount = players.length;
    if (playerCount < 3) {
      roles.push("asesino");
      for (let i = 1; i < playerCount; i++) roles.push("aldeano");
    } else {
      roles.push("asesino");
      roles.push("curandero");
      roles.push("detective");
      for (let i = 3; i < playerCount; i++) roles.push("aldeano");
    }

    roles = shuffleArray(roles);

    for (let i = 0; i < playerCount; i++) {
      await ctx.db.patch(players[i]._id, {
        role: roles[i] as any,
        status: "alive",
      });
    }

    const roundEndTime = Date.now() + 15000;
    await ctx.db.patch(args.gameId, {
      status: "in_progress",
      currentRound: 1,
      startTime: Date.now(),
      roundEndTime,
      lastRoundSummary: undefined,
    });

    // Schedule resolution
    await ctx.scheduler.runAt(roundEndTime, internal.games.scheduledResolve, { 
      gameId: args.gameId, 
      round: 1 
    });
  },
});

export const submitAction = mutation({
  args: {
    gameId: v.id("games"),
    targetId: v.id("players"),
    actionType: v.union(v.literal("kill"), v.literal("heal"), v.literal("investigate")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "in_progress") throw new Error("Juego no activo");

    const player = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", args.gameId).eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!player || player.status !== "alive") throw new Error("Jugador no válido o muerto");

    const existingAction = await ctx.db
      .query("actions")
      .withIndex("by_game_round", (q) => q.eq("gameId", args.gameId).eq("round", game.currentRound))
      .filter((q) => q.eq(q.field("actorId"), player._id))
      .first();
    
    if (existingAction) {
      await ctx.db.patch(existingAction._id, { targetId: args.targetId });
    } else {
      await ctx.db.insert("actions", {
        gameId: args.gameId,
        round: game.currentRound,
        actorId: player._id,
        targetId: args.targetId,
        actionType: args.actionType,
      });
    }
  },
});

export const scheduledResolve = internalMutation({
  args: { gameId: v.id("games"), round: v.number() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "in_progress" || game.currentRound !== args.round) return;
    await resolveRound(ctx, args.gameId);
  },
});

export const forceEndRound = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    await resolveRound(ctx, args.gameId);
  }
});

// ... (queries)

async function resolveRound(ctx: any, gameId: Id<"games">) {
  const game = await ctx.db.get(gameId);
  if (!game || game.status !== "in_progress") return;

  const players = await ctx.db
    .query("players")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();

  const actions = await ctx.db
    .query("actions")
    .withIndex("by_game_round", (q: any) => q.eq("gameId", gameId).eq("round", game.currentRound))
    .collect();

  let summary = "";
  const assassin = players.find((p: any) => p.role === "asesino");
  
  // 1. Resolve Kill
  let victimId: Id<"players"> | null = null;
  const killAction = actions.find((a: any) => a.actionType === "kill");

  if (killAction) {
    victimId = killAction.targetId;
  } else if (assassin && assassin.status === "alive") {
    const potentialVictims = players.filter((p: any) => p.status === "alive" && p._id !== assassin._id);
    if (potentialVictims.length > 0) {
      const randomVictim = potentialVictims[Math.floor(Math.random() * potentialVictims.length)];
      victimId = randomVictim._id;
      summary += "El Asesino no eligió a tiempo, así que atacó al azar. ";
    }
  }

  // 2. Resolve Heal
  const healAction = actions.find((a: any) => a.actionType === "heal");
  let saved = false;
  if (victimId && healAction && healAction.targetId === victimId) {
    saved = true;
    victimId = null;
    summary += "¡El Curandero salvó a la víctima esta noche! ";
  }

  // 3. Apply Death (Temporarily, to check winner)
  let detectiveDied = false;
  let killedPlayer: any = null;
  if (victimId) {
    killedPlayer = players.find((p: any) => p._id === victimId);
    if (killedPlayer && killedPlayer.role === "detective") {
      detectiveDied = true;
    }
  }

  // 4. Detective Logic
  let assassinDiscovered = false;
  const investigateAction = actions.find((a: any) => a.actionType === "investigate");
  if (investigateAction) {
    const target = players.find((p: any) => p._id === investigateAction.targetId);
    if (target && target.role === "asesino") {
       assassinDiscovered = true;
    }
  }

  // 5. Tie-break Logic (Detective vs Assassin)
  if (detectiveDied && assassinDiscovered && !saved) {
    // Both acted against each other. Who was faster?
    const killTime = killAction?._creationTime || Infinity;
    const investigateTime = investigateAction?._creationTime || Infinity;

    if (investigateTime < killTime) {
      // Detective was faster
      summary += `¡El Detective fue más rápido y descubrió al Asesino antes de ser atacado! `;
      detectiveDied = false;
      victimId = null;
    } else {
      // Assassin was faster
      summary += `El Asesino fue más rápido y eliminó al Detective antes de ser descubierto. `;
      assassinDiscovered = false;
    }
  }

  // Apply final death status
  if (victimId) {
    await ctx.db.patch(victimId, { status: "dead" });
    summary += `${killedPlayer.name} ha sido ASESINADO. `;
  } else if (!saved && !assassinDiscovered) {
     summary += "Noche tranquila. Nadie murió. ";
  }

  if (assassinDiscovered) {
    summary += "¡El Asesino ha sido descubierto! ";
    await ctx.db.patch(gameId, { status: "finished", winner: "villagers", lastRoundSummary: summary });
    return;
  }

  if (detectiveDied) {
    summary += "¡El Detective ha muerto! El crimen quedará impune.";
    await ctx.db.patch(gameId, { status: "finished", winner: "impostor", lastRoundSummary: summary });
    return;
  }

  // Other win conditions
  const currentAlivePlayers = players.filter((p: any) => p.status === "alive" && p._id !== victimId);
  if (currentAlivePlayers.length <= 2) {
     await ctx.db.patch(gameId, { status: "finished", winner: "impostor", lastRoundSummary: summary });
     return;
  }

  // Next Round
  const nextRound = game.currentRound + 1;
  const nextEndTime = Date.now() + 15000;
  await ctx.db.patch(gameId, {
    currentRound: nextRound,
    startTime: Date.now(),
    roundEndTime: nextEndTime,
    lastRoundSummary: summary,
  });

  await ctx.scheduler.runAt(nextEndTime, internal.games.scheduledResolve, { 
    gameId, 
    round: nextRound 
  });
}

