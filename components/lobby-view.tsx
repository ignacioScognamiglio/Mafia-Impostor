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
  const isHost = players.find(p => p._id === currentPlayerId)?.isHost;

  const handleStart = async () => {
    try {
      if (players.length < 3) { // Minimal validation
         // toast.warning("Se necesitan al menos 3 jugadores"); // Uncomment in prod
      }
      await startGame({ gameId: game._id });
    } catch (error) {
      toast.error("Error al iniciar la partida");
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
             {isHost && <Badge variant="secondary">Eres el Host</Badge>}
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
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="pt-4">
             {isHost ? (
               <Button size="lg" className="w-full" onClick={handleStart}>
                 Comenzar Partida
               </Button>
             ) : (
               <div className="text-center p-4 bg-muted/50 rounded-lg animate-pulse">
                 <p className="text-sm font-medium">Esperando al anfitrión...</p>
               </div>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
