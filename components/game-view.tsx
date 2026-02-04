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
  const restartGame = useMutation(api.games.restartGame);
  const castSuspicion = useMutation(api.games.castSuspicion);
  
  const me = players.find((p) => p._id === currentPlayerId);
  const myRole = me?.role ? ROLES[me.role as keyof typeof ROLES] : null;

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);
  const [hasSuspected, setHasSuspected] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Timer Logic based on roundEndTime
  useEffect(() => {
    if (game.status !== "in_progress" || !game.roundEndTime) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((game.roundEndTime! - now) / 1000));
      setTimeLeft(diff);
    };

    const interval = setInterval(updateTimer, 500);
    updateTimer(); 

    return () => clearInterval(interval);
  }, [game.status, game.roundEndTime]);

  // Reset local state when round changes
  useEffect(() => {
    setHasActed(false);
    setHasSuspected(false);
    setSelectedTargetId(null);
    if (game.lastRoundSummary && game.currentRound > 1) {
      setShowSummary(true);
    }
  }, [game.currentRound]);

  // Handle Action
  const handleAction = async () => {
    if (!selectedTargetId) return toast.error("Selecciona un objetivo");
    if (!me?.role) return;

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
    }
  };

  const handleRestart = async () => {
    try {
        await restartGame({ gameId: game._id });
        toast.success("Esperando a los demás...");
    } catch (e) {
        toast.error("Error al reiniciar");
    }
  };

  if (!me) return <div>Error: Jugador no encontrado</div>;

  // Game Over View
  if (game.status === "finished") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <h1 className="text-5xl font-extrabold mb-6 animate-bounce">
          {game.winner === "impostor" ? "🔪 GANA EL ASESINO" : "👨‍🌾 GANAN LOS ALDEANOS"}
        </h1>
        <div className="bg-muted p-6 rounded-xl border-l-4 border-primary max-w-lg mb-8">
            <p className="text-xl text-foreground font-medium italic">
              "{game.lastRoundSummary}"
            </p>
        </div>
        <div className="flex gap-4">
            {me.isHost && (
                <Button onClick={handleRestart} size="lg" className="h-14 px-8 text-lg font-bold">Jugar de nuevo</Button>
            )}
            <Button variant="outline" onClick={() => window.location.href = "/"} size="lg" className="h-14 px-8 text-lg">Salir</Button>
        </div>
      </div>
    );
  }

  // Dead View
  if (me.status === "dead") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-950/20 p-4">
        <div className="text-6xl mb-4">💀</div>
        <h1 className="text-4xl font-bold text-red-500 mb-4">Estás Muerto</h1>
        <p className="text-muted-foreground text-center mb-8">
          Ya no puedes actuar, pero el juego sigue...
        </p>
        {game.lastRoundSummary && (
           <Card className="max-w-md w-full">
             <CardHeader><CardTitle>Últimos sucesos</CardTitle></CardHeader>
             <CardContent className="italic">"{game.lastRoundSummary}"</CardContent>
           </Card>
        )}
      </div>
    );
  }

  const targets = players.filter(p => p.status === "alive" && (p._id !== me._id || me.role === "curandero")); 
  const isVillager = me.role === "aldeano";
  const hasFinishedAction = hasActed || (isVillager && hasSuspected);

  return (
    <div className="flex flex-col min-h-screen bg-muted/10 p-4 pb-20">
      
      {/* Summary Dialog */}
      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Noche {game.currentRound - 1}</AlertDialogTitle>
            <AlertDialogDescription className="text-lg text-foreground">
              {game.lastRoundSummary}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSummary(false)}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Top Bar with 15s Countdown */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-lg px-4 py-1">Ronda {game.currentRound}</Badge>
          {timeLeft !== null && (
            <div className={`text-2xl font-black px-4 py-1 rounded-lg border-2 ${timeLeft <= 5 ? 'text-red-500 border-red-500 animate-pulse' : 'text-primary border-primary'}`}>
              {timeLeft}s
            </div>
          )}
        </div>
        <Progress value={(Math.min(15, timeLeft || 0) / 15) * 100} className="h-3 w-full" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <Card className={cn("w-full max-w-sm border-2 transition-all shadow-lg", myRole?.color)}>
          <CardHeader className="text-center pb-2">
            <div className="text-6xl mb-4">{myRole?.emoji}</div>
            <CardTitle className="text-3xl">{myRole?.label}</CardTitle>
            <CardDescription className="text-foreground/80 font-medium text-base">
              {myRole?.description}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Action Area */}
        {!hasFinishedAction ? (
          <div className="w-full max-w-sm space-y-4 animate-in fade-in slide-in-from-bottom-8">
            <h3 className="text-center font-bold uppercase tracking-widest text-muted-foreground text-xs">
              {me.role === "curandero" ? "¿A quién quieres salvar?" : 
               me.role === "asesino" ? "¿A quién quieres eliminar?" : 
               me.role === "detective" ? "¿A quién quieres investigar?" :
               "¿De quién sospechas?"}
            </h3>
            
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1">
                {targets.map((target) => (
                  <Card 
                    key={target._id}
                    className={cn(
                      "cursor-pointer hover:border-primary transition-all text-center p-3 relative bg-card",
                      selectedTargetId === target._id ? "border-primary ring-2 ring-primary bg-primary/5" : ""
                    )}
                    onClick={() => setSelectedTargetId(target._id)}
                  >
                    {suspiciousTargets.includes(target._id) && me.role === "detective" && (
                        <div className="absolute top-1 right-1 text-xl drop-shadow" title="Los aldeanos sospechan">
                            👁️
                        </div>
                    )}
                    <CardContent className="flex flex-col items-center p-0 gap-2">
                      <Avatar className="h-12 w-12 border">
                        <AvatarImage src={target.avatar} />
                        <AvatarFallback>{target.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-bold truncate w-full text-xs">{target.name}</span>
                    </CardContent>
                  </Card>
                ))}
            </div>

            <Button 
              size="lg" 
              className="w-full text-lg h-14 font-bold" 
              onClick={handleAction}
              disabled={!selectedTargetId || timeLeft === 0}
            >
              {isVillager ? "Confirmar Sospecha" : myRole?.actionLabel}
            </Button>
          </div>
        ) : (
          <div className="text-center p-8 bg-card rounded-2xl border-2 border-green-500/20 shadow-xl max-w-sm w-full">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl animate-pulse">
                ✅
              </div>
              <div>
                <p className="font-black text-xl text-green-600 uppercase tracking-tight">
                  {isVillager ? "Sospecha Enviada" : "Acción Registrada"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Puedes cambiar tu elección antes de que termine el tiempo
                </p>
              </div>
              <Button variant="outline" className="mt-2" onClick={() => {
                if (isVillager) setHasSuspected(false);
                else setHasActed(false);
              }}>
                🔄 Cambiar Selección
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

