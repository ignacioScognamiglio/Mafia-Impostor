"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface LobbyViewProps {
  game: any;
  players: any[];
  currentPlayerId: string | null;
}

export function LobbyView({ game, players, currentPlayerId }: LobbyViewProps) {
  const startGame = useMutation(api.games.startGame);
  const acceptNextGame = useMutation(api.games.acceptNextGame);
  
  const currentPlayer = players.find(p => p._id === currentPlayerId);
  const isHost = currentPlayer?.isHost;
  const isReady = currentPlayer?.readyForNext;

  const allReady = players.every(p => p.readyForNext);

  const handleStart = async () => {
    try {
      if (players.length < 3) {
        toast.warning("Se necesitan al menos 3 jugadores");
        return;
      }
      if (!allReady) {
        toast.warning("Esperando a que todos acepten");
        return;
      }
      await startGame({ gameId: game._id });
    } catch (error: any) {
      toast.error(error.message || "Error al iniciar la partida");
    }
  };

  const handleAccept = async () => {
    try {
      await acceptNextGame({ gameId: game._id });
    } catch (error) {
      toast.error("Error al aceptar");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/20">
      <Card className="w-full max-w-md h-[80vh] flex flex-col">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Sala: {game.roomCode}</CardTitle>
          <CardDescription>Esperando a los jugadores...</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex justify-between items-center px-2">
             <span className="text-sm text-muted-foreground font-medium">
               Jugadores ({players.length})
             </span>
             {isHost && <Badge variant="secondary">Host</Badge>}
          </div>
          
          <ScrollArea className="flex-1 rounded-md border p-4 bg-card/50">
            <div className="space-y-3">
              {players.map((player) => (
                <div key={player._id} className="flex items-center gap-3 p-2 rounded-lg bg-background shadow-sm">
                  <Avatar>
                    <AvatarImage src={player.avatar} />
                    <AvatarFallback>{player.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 font-medium flex items-center gap-2">
                    {player.name}
                    {player.isHost && <Crown className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    {player._id === currentPlayerId && <Badge variant="outline" className="text-xs">Tú</Badge>}
                  </div>
                  {player.readyForNext ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">Listo</Badge>
                  ) : (
                    <Badge variant="secondary" className="animate-pulse">Esperando</Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="pt-4 space-y-2">
             {!isReady ? (
               <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAccept}>
                 Aceptar Jugar de Nuevo
               </Button>
             ) : isHost ? (
               <Button size="lg" className="w-full" onClick={handleStart} disabled={!allReady}>
                 {allReady ? "Comenzar Partida" : "Esperando jugadores..."}
               </Button>
             ) : (
               <div className="text-center p-4 bg-muted/50 rounded-lg">
                 <p className="text-sm font-medium text-green-600">Estás listo. Esperando al host...</p>
               </div>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

