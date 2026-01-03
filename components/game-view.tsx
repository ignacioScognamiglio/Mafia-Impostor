"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ROLES } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

interface GameViewProps {
  game: any;
  players: any[];
  currentPlayerId: string | null;
  suspiciousTargets?: string[];
}

export function GameView({ game, players, currentPlayerId, suspiciousTargets = [] }: GameViewProps) {
  const submitAction = useMutation(api.games.submitAction);
  const forceEndRound = useMutation(api.games.forceEndRound);
  const restartGame = useMutation(api.games.restartGame);
  const castSuspicion = useMutation(api.games.castSuspicion);
  
  const me = players.find((p) => p._id === currentPlayerId);
  const myRole = me?.role ? ROLES[me.role as keyof typeof ROLES] : null;

  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);
  const [hasSuspected, setHasSuspected] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Timer Logic
  useEffect(() => {
    if (game.status !== "in_progress") return;
    
    // Reset local state on new round
    setHasActed(false);
    setHasSuspected(false);
    setSelectedTargetId(null);

    const updateTimer = () => {
      const elapsed = (Date.now() - (game.startTime || Date.now())) / 1000;
      const remaining = Math.max(0, 60 - elapsed);
      setTimeLeft(remaining);

      // Timeout logic (Host triggers)
      if (remaining === 0 && me?.isHost) {
         forceEndRound({ gameId: game._id }); 
      }
    };

    const interval = setInterval(updateTimer, 1000);
    updateTimer(); 

    return () => clearInterval(interval);
  }, [game.currentRound, game.status, game.startTime, me?.isHost, game._id, forceEndRound]);

  // Show Summary when round changes
  useEffect(() => {
    if (game.lastRoundSummary && game.currentRound > 1) {
      setShowSummary(true);
    }
  }, [game.currentRound, game.lastRoundSummary]);

  // Handle Action
  const handleAction = async () => {
    if (!selectedTargetId) return toast.error("Selecciona un objetivo");
    if (!me?.role) return;

    // Villager Logic (Suspicion)
    if (me.role === "aldeano") {
       try {
         await castSuspicion({
            gameId: game._id,
            targetId: selectedTargetId as Id<"players">,
         });
         setHasSuspected(true);
         toast.success("Sospecha enviada");
       } catch (error) {
         toast.error("Error al enviar sospecha");
       }
       return;
    }

    // Special Role Logic
    let actionType: "kill" | "heal" | "investigate" | null = null;
    if (me.role === "asesino") actionType = "kill";
    if (me.role === "curandero") actionType = "heal";
    if (me.role === "detective") actionType = "investigate";

    if (!actionType) return;

    try {
      await submitAction({
        gameId: game._id,
        targetId: selectedTargetId as Id<"players">,
        actionType,
      });
      setHasActed(true);
      toast.success("Acción enviada");
    } catch (error) {
      toast.error("Error al enviar acción");
      console.error(error);
    }
  };

  const handleRestart = async () => {
    try {
        await restartGame({ gameId: game._id });
        toast.success("Partida reiniciada");
    } catch (e) {
        toast.error("Error al reiniciar");
    }
  };

  if (!me) return <div>Error: Jugador no encontrado</div>;

  // Game Over View
  if (game.status === "finished") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <h1 className="text-5xl font-extrabold mb-6">
          {game.winner === "impostor" ? "🔪 GANA EL ASESINO" : "👨‍🌾 GANAN LOS ALDEANOS"}
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          {game.lastRoundSummary}
        </p>
        <div className="flex gap-4">
            {me.isHost && (
                <Button onClick={handleRestart} size="lg">Jugar de nuevo</Button>
            )}
            <Button variant="outline" onClick={() => window.location.href = "/"} size="lg">Salir</Button>
        </div>
      </div>
    );
  }

  // Dead View (Persistent)
  if (me.status === "dead") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-950/20 p-4">
        <div className="text-6xl mb-4">💀</div>
        <h1 className="text-4xl font-bold text-red-500 mb-4">Estás Muerto</h1>
        <p className="text-muted-foreground text-center mb-8">
          Ya no puedes realizar acciones, pero puedes observar el juego.
        </p>
        {game.lastRoundSummary && (
           <Card className="max-w-md w-full">
             <CardHeader><CardTitle>Últimos sucesos</CardTitle></CardHeader>
             <CardContent>{game.lastRoundSummary}</CardContent>
           </Card>
        )}
      </div>
    );
  }

  const targets = players.filter(p => p.status === "alive" && (p._id !== me._id || me.role === "curandero")); 
  
  // Can Act: Special roles who haven't acted, OR Villagers who haven't suspected (optional restriction, prompt implies they can just "opinar")
  // Let's allow Villagers to change their vote, but we show "Enviado" state after.
  const isVillager = me.role === "aldeano";
  const canAct = (isVillager || !hasActed) && timeLeft > 0;

  return (
    <div className="flex flex-col min-h-screen bg-muted/10 p-4 pb-20">
      
      {/* Round Summary Dialog */}
      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resumen de la Ronda {game.currentRound - 1}</AlertDialogTitle>
            <AlertDialogDescription className="text-lg text-foreground">
              {game.lastRoundSummary}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSummary(false)}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Top Bar: Timer & Round */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-lg px-4 py-1">Ronda {game.currentRound}</Badge>
        </div>
        <Progress value={(Math.min(60, timeLeft) / 60) * 100} className="h-2 w-full" />
      </div>

      {/* Role Card */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <Card className={cn("w-full max-w-sm border-2 transition-all", myRole?.color)}>
          <CardHeader className="text-center pb-2">
            <div className="text-6xl mb-4">{myRole?.emoji}</div>
            <CardTitle className="text-3xl">{myRole?.label}</CardTitle>
            <CardDescription className="text-foreground/80 font-medium text-base">
              {myRole?.description}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Action Area */}
        {canAct ? (
          <div className="w-full max-w-sm space-y-4 animate-in fade-in slide-in-from-bottom-8">
            <h3 className="text-center font-medium text-muted-foreground">
              {me.role === "curandero" ? "¿A quién quieres salvar?" : 
               me.role === "asesino" ? "¿A quién quieres eliminar?" : 
               me.role === "detective" ? "¿A quién quieres investigar?" :
               "Sospecho de..."}
            </h3>
            
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1">
                {targets.map((target) => (
                  <Card 
                    key={target._id}
                    className={cn(
                      "cursor-pointer hover:border-primary transition-all text-center p-4 relative",
                      selectedTargetId === target._id ? "border-primary ring-2 ring-primary ring-offset-2" : ""
                    )}
                    onClick={() => setSelectedTargetId(target._id)}
                  >
                    {suspiciousTargets.includes(target._id) && me.role === "detective" && (
                        <div className="absolute top-1 right-1 bg-yellow-500/20 text-yellow-600 rounded-full p-1" title="Sospechoso">
                            👁️
                        </div>
                    )}
                    <CardContent className="flex flex-col items-center p-0 gap-2">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={target.avatar} />
                        <AvatarFallback>{target.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate w-full text-sm">{target.name}</span>
                    </CardContent>
                  </Card>
                ))}
            </div>

            <Button 
              size="lg" 
              className="w-full text-lg" 
              onClick={handleAction}
              disabled={!selectedTargetId}
            >
              {isVillager ? "Sospechar 👁️" : myRole?.actionLabel}
            </Button>
          </div>
        ) : (
          <div className="text-center p-6 bg-card rounded-xl border shadow-sm max-w-sm w-full">
            {hasActed || (isVillager && hasSuspected) ? (
              <div className="flex flex-col items-center gap-2 text-green-600">
                <span className="text-2xl">✅</span>
                <p className="font-bold">{isVillager ? "Sospecha enviada" : "Acción registrada"}</p>
                <p className="text-sm text-muted-foreground">Esperando a los demás...</p>
                <Button variant="link" onClick={() => {
                  if (isVillager) setHasSuspected(false);
                  else setHasActed(false);
                }}>
                  Cambiar {isVillager ? "voto" : "selección"}
                </Button>
              </div>
            ) : (
               <p className="text-muted-foreground">Tiempo agotado</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
