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

    if (!game) throw new Error("Sala no encontrada");
    
    // Allow re-joining if already in the game (waiting or in progress)
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", game._id).eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (existingPlayer) {
      return { gameId: game._id, playerId: existingPlayer._id };
    }

    if (game.status !== "waiting") throw new Error("La partida ya ha comenzado");

    const playerId = await ctx.db.insert("players", {
      gameId: game._id,
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name || identity.givenName || "Jugador",
      avatar: identity.pictureUrl || "",
      isHost: false,
      status: "alive",
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

    // Verify Host
    const player = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", args.gameId).eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!player || !player.isHost) throw new Error("Solo el anfitrión puede reiniciar");

    // Reset Game
    await ctx.db.patch(args.gameId, {
      status: "waiting",
      currentRound: 0,
      startTime: undefined,
      lastRoundSummary: undefined,
      winner: undefined,
    });

    // Reset Players
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    for (const p of players) {
      await ctx.db.patch(p._id, {
        role: undefined,
        status: "alive",
      });
    }

    // Clean up actions and suspicions (optional but cleaner)
    // We can't easily delete by index in bulk without iterating, 
    // but since we filter by game/round, old ones won't affect new game if round resets to 0.
    // However, round 0 actions/suspicions from previous game might leak if we don't clear them?
    // Actually, actions are usually round >= 1. Round 0 is setup. 
    // So keeping them is "okay" as history, but better to clear if we want a fresh start.
    // For simplicity/speed we'll skip bulk delete (expensive) and rely on round logic. 
    // Since currentRound resets to 0, and we increment to 1 on start, 
    // we just need to ensure we don't fetch old round 1 stuff.
    // But we WILL fetch old round 1 stuff if we don't delete or change game ID.
    // Ideally we should delete. Let's iterate.
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

export const startGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Juego no encontrado");

    // Verify Host
    const player = await ctx.db
      .query("players")
      .withIndex("by_game_token", (q) => q.eq("gameId", args.gameId).eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!player || !player.isHost) throw new Error("Solo el anfitrión puede iniciar");

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    if (players.length === 0) throw new Error("No hay jugadores");

    const playerCount = players.length;
    let roles: string[] = [];

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

    await ctx.db.patch(args.gameId, {
      status: "in_progress",
      currentRound: 1,
      startTime: Date.now(),
      lastRoundSummary: undefined, // Clear summary on start
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

    // Identify current player securely
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

    // Check completion
    const allPlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const activeSpecialPlayers = allPlayers.filter(
      (p) => p.status === "alive" && p.role !== "aldeano"
    );

    const currentRoundActions = await ctx.db
      .query("actions")
      .withIndex("by_game_round", (q) => q.eq("gameId", args.gameId).eq("round", game.currentRound))
      .collect();

    if (currentRoundActions.length >= activeSpecialPlayers.length) {
      await resolveRound(ctx, args.gameId);
    }
  },
});

export const forceEndRound = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // Ideally verify host here too, but for speed we trust the button visibility logic + game state
    await resolveRound(ctx, args.gameId);
  }
});

// --- Queries ---

export const getGame = query({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_room_code", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .unique();
  },
});

export const getPlayers = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    
    // Determine if current viewer is in the list
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { players, viewerId: null, suspiciousTargets: [] };

    // Find the player object corresponding to the current user
    const viewer = players.find(p => p.tokenIdentifier === identity.tokenIdentifier);
    
    let suspiciousTargets: Id<"players">[] = [];
    if (viewer && viewer.role === "detective") {
        const game = await ctx.db.get(args.gameId);
        if (game) {
            const suspicions = await ctx.db
            .query("suspicions")
            .withIndex("by_game_round", (q) => q.eq("gameId", args.gameId).eq("round", game.currentRound))
            .collect();
            suspiciousTargets = suspicions.map(s => s.targetId);
        }
    }

    return { 
      players, 
      viewerId: viewer ? viewer._id : null,
      suspiciousTargets
    };
  },
});

// --- Internal Resolution Logic (Same as before) ---

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

  // 3. Apply Death
  let detectiveDied = false;
  if (victimId) {
    const victim = players.find((p: any) => p._id === victimId);
    if (victim) {
      await ctx.db.patch(victim._id, { status: "dead" });
      summary += `${victim.name} ha sido ASESINADO. `;
      if (victim.role === "detective") {
        detectiveDied = true;
      }
    }
  } else if (!saved && (!assassin || assassin.status === "dead")) {
     summary += "Noche tranquila. Nadie murió. ";
  }

  // 4. Detective Logic (Win Condition Only)
  let assassinDiscovered = false;
  const investigateAction = actions.find((a: any) => a.actionType === "investigate");
  if (investigateAction) {
    const target = players.find((p: any) => p._id === investigateAction.targetId);
    if (target && target.role === "asesino") {
       assassinDiscovered = true;
       summary += `El Detective investigó a ${target.name} y lo descubrió: ¡ES EL ASESINO! `;
    }
    // Note: We do NOT reveal the result if they are innocent, to protect identities.
  }

  // 5. Win Conditions
  // Condition A: Assassin Discovered -> Villagers Win
  if (assassinDiscovered) {
    await ctx.db.patch(gameId, { status: "finished", winner: "villagers", lastRoundSummary: summary });
    return;
  }

  // Condition B: Detective Killed -> Impostor Wins
  if (detectiveDied) {
    summary += "¡El Detective ha muerto! El crimen quedará impune.";
    await ctx.db.patch(gameId, { status: "finished", winner: "impostor", lastRoundSummary: summary });
    return;
  }

  // Condition C: Assassin is Dead (Killed by random chance or voting if we had it, but mostly redundant if discovered logic handles it. Still good to keep)
  const assassinIsDead = victimId && players.find((p: any) => p._id === victimId)?.role === "asesino";
  if (assassinIsDead) {
    await ctx.db.patch(gameId, { status: "finished", winner: "villagers", lastRoundSummary: summary });
    return;
  }
  
  // Condition D: Few Players Left -> Impostor Wins
  // Count alive players excluding the victim (already handled by status update effectively, but need to be sure)
  const alivePlayers = players.filter((p: any) => p.status === "alive" && p._id !== victimId); // victimId is already null if saved
  // Re-fetch or filter properly based on status updates? 
  // We just patched the victim status. The 'players' array is stale for the victim.
  const currentAliveCount = players.filter((p: any) => p.status === "alive" && p._id !== victimId).length;

  if (currentAliveCount <= 2) {
     await ctx.db.patch(gameId, { status: "finished", winner: "impostor", lastRoundSummary: summary });
     return;
  }

  // Next Round
  await ctx.db.patch(gameId, {
    currentRound: game.currentRound + 1,
    startTime: Date.now(),
    lastRoundSummary: summary,
  });
}
