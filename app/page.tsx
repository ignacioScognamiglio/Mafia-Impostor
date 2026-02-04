"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModeToggle } from "@/components/mode-toggle";
import { toast } from "sonner";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const createGame = useMutation(api.games.createGame);
  const joinGame = useMutation(api.games.joinGame);

  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createGame({}); // Auth info handled by backend
      router.push(`/room/${result.roomCode}`);
    } catch (error) {
      toast.error("Error al crear la partida");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!roomCode.trim()) return toast.error("Ingresa el código de la sala");
    if (roomCode.length !== 4) return toast.error("El código debe tener 4 letras");

    setLoading(true);
    try {
      const result = await joinGame({ 
        roomCode: roomCode.toUpperCase(), 
      });
      router.push(`/room/${roomCode.toUpperCase()}`);
    } catch (error: any) {
      toast.error(error.message || "Error al unirse");
      setRoomCode(""); // Clear input on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/20">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <ModeToggle />
        <UserButton />
      </div>
      
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-2">Mafia Impostor</h1>
        <p className="text-muted-foreground">El juego de rol y deducción</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bienvenido</CardTitle>
          <CardDescription>
            {isSignedIn ? `Hola, ${user.firstName}` : "Inicia sesión para jugar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoaded ? (
            <div className="flex justify-center p-4">Cargando...</div>
          ) : !isSignedIn ? (
            <div className="flex flex-col gap-4">
               <SignInButton mode="modal">
                 <Button className="w-full" size="lg">Iniciar Sesión con Clerk</Button>
               </SignInButton>
            </div>
          ) : (
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="create">Crear Sala</TabsTrigger>
                <TabsTrigger value="join">Unirse</TabsTrigger>
              </TabsList>
              
              <TabsContent value="create" className="space-y-4">
                <div className="p-4 text-center bg-muted/50 rounded-lg text-sm mb-4">
                  Crearás una nueva sala y serás el anfitrión.
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={loading}>
                  {loading ? "Creando..." : "Crear Partida"}
                </Button>
              </TabsContent>

              <TabsContent value="join" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código de Sala</label>
                  <Input 
                    placeholder="ABCD" 
                    value={roomCode} 
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())} 
                    maxLength={4}
                  />
                </div>
                <Button className="w-full" onClick={handleJoin} disabled={loading}>
                  {loading ? "Uniéndose..." : "Unirse a Partida"}
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
