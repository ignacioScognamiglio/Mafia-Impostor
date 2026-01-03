"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LobbyView } from "@/components/lobby-view";
import { GameView } from "@/components/game-view";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";
import { UserButton, useUser } from "@clerk/nextjs";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.code as string;
  const { isSignedIn, isLoaded } = useUser();
  
  // Use query to get game state AND current player ID (viewerId)
  const game = useQuery(api.games.getGame, { roomCode });
  const playersData = useQuery(api.games.getPlayers, game ? { gameId: game._id } : "skip");

  // Auth Redirect
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      toast.error("Debes iniciar sesión");
      router.push("/");
    }
  }, [isLoaded, isSignedIn, router]);

  // Loading State
  if (!isLoaded || game === undefined || playersData === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not Found
  if (game === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Sala no encontrada</h1>
        <button onClick={() => router.push("/")} className="text-primary underline">Volver al inicio</button>
      </div>
    );
  }

  // Check if user is part of the game
  if (!playersData.viewerId) {
     return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center p-4">
        <h1 className="text-2xl font-bold">No eres parte de esta partida</h1>
        <p>Parece que intentaste entrar a una sala sin unirte primero.</p>
        <button onClick={() => router.push("/")} className="text-primary underline">Volver al inicio</button>
      </div>
     );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div className="absolute top-4 right-4 z-50 flex gap-4 items-center">
        <ModeToggle />
        <UserButton />
      </div>

      {game.status === "waiting" && (
        <LobbyView 
          game={game} 
          players={playersData.players} 
          currentPlayerId={playersData.viewerId} 
        />
      )}

      {(game.status === "in_progress" || game.status === "finished") && (
        <GameView 
          game={game} 
          players={playersData.players} 
          currentPlayerId={playersData.viewerId}
          suspiciousTargets={playersData.suspiciousTargets}
        />
      )}
    </div>
  );
}