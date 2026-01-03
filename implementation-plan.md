# Implementation Plan: Mafia/Role RPG Card Game (Español)

## Contexto del Proyecto
- **Frontend:** Next.js (App Router), Tailwind CSS.
- **Backend/DB:** Convex (Base de datos en tiempo real y funciones).
- **UI Library:** Shadcn UI (Mobile-first, minimalista).
- **Idioma:** Español (Toda la interfaz y mensajes).

---

## Fase 1: Lobby y Sistema de Conexión
**Objetivo:** Permitir a los usuarios crear una partida, unirse con código y esperar en una "Sala de Espera".

### Componentes UI (Shadcn)
- `Card`: Contenedor principal del formulario de login/unirse.
- `Input`: Para ingresar nombre de usuario y código de sala.
- `Button`: Acciones "Crear Partida", "Unirse", "Comenzar".
- `Avatar`: Para listar a los jugadores conectados en la sala de espera.
- `Sonner` (Toast): Para notificaciones de error (ej. "Sala no encontrada").
- `ModeToggle`: Para cambio de tema (ya implementado).

### Backend Convex
- **Schema:**
  - `games`: `status` (waiting, in_progress, finished), `roomCode`, `hostId`.
  - `players`: `name`, `gameId`, `avatarId`, `isHost`.
- **Funciones:**
  - `createGame`: Genera código, crea juego, agrega al host.
  - `joinGame`: Agrega jugador si el status es 'waiting'.
  - `startGame`: (Solo Host) Cambia status a 'in_progress'.

### Entregable
Una Sala de Espera funcional donde los jugadores ven quién se une en tiempo real.

---

## Fase 2: Motor de Juego y Distribución de Roles
**Objetivo:** Transición de Lobby a Juego, asignación aleatoria de roles y visualización de la "Tarjeta de Identidad".

### Componentes UI
- `Card`: La tarjeta principal de identidad (Rol + Emoji).
- `Badge`: Para mostrar el estado actual o rol (si es visible).
- `Skeleton`: (Opcional) Para estados de carga.

### Backend Convex
- **Schema Update:**
  - `players`: Agregar `role` (asesino, curandero, detective, aldeano), `status` (alive, dead).
  - `games`: Agregar `currentRound` (número), `phase` (action, results).
- **Lógica:**
  - Al ejecutar `startGame`, el backend mezcla los roles según la cantidad de jugadores.
  - Distribución típica: 1 Asesino, 1 Curandero, 1 Detective, resto Aldeanos.

### Entregable
Pantalla de juego donde cada usuario ve su Carta de Rol única con su Emoji representativo.

---

## Fase 3: La Fase de Acción (La "Ronda")
**Objetivo:** Implementar el timer de 30s y la interacción específica de cada rol.

### Componentes UI
- `Progress`: Barra de progreso para los 30 segundos.
- `Carousel`: **Crucial para mobile.** Para deslizar y seleccionar el objetivo (víctima/paciente/sospechoso).
- `Button`: Botón de confirmación de acción.
- `Sonner`: Feedback inmediato ("Acción registrada").

### Lógica de Interacción
- **Turnos Simultáneos:** Todos actúan a la vez dentro de los 30s.
- **Asesino:** Ve botón "Matar". Selecciona un jugador del carrusel.
- **Curandero:** Ve botón "Curar". Selecciona un jugador.
- **Detective:** Ve botón "Investigar". Selecciona un jugador (Resultado: ¿Es el asesino? Si/No).
- **Aldeano:** Mensaje "Esperando acciones...".

### Backend Convex
- **Schema Update:**
  - `actions`: `gameId`, `round`, `actorId`, `targetId`, `actionType` (kill, heal, investigate).
- **Funciones:**
  - `submitAction`: Valida rol y guarda acción.
  - `checkRoundCompletion`: Se activa por timer o cuando todos actuaron.

### Entregable
Ronda jugable con selección de objetivos mediante Carrusel y Timer funcional.

---

## Fase 4: Resolución y Resumen de Ronda
**Objetivo:** Procesar las acciones conflictivas y mostrar resultados.

### Componentes UI
- `AlertDialog`: Para el overlay de resumen ("Murió X", "Nadie murió").
- `ScrollArea`: Para un historial/log de eventos pasados de la partida.
- `Avatar`: Visualizar estados en la lista (ej. borde rojo si está muerto).

### Lógica
- **Algoritmo de Resolución (Backend):**
  1. Obtener acciones de `currentRound`.
  2. Aplicar Muerte (Asesino -> Víctima).
  3. Aplicar Cura (Curandero -> Paciente). Si Paciente == Víctima, anula muerte.
  4. Actualizar `players` status (alive -> dead).
  5. Generar texto de resumen en Español.
- **Siguiente Ronda:** Resetear timer, incrementar ronda.

### Entregable
Ciclo completo donde las rondas se resuelven, los jugadores son eliminados y el juego avanza.

---

## Fase 5: Condiciones de Victoria y Pulido
**Objetivo:** Detectar fin del juego y pulir experiencia móvil.

### Componentes UI
- `Sonner`: Notificaciones finales.
- Animaciones CSS (vía `tw-animate-css`) para victoria/derrota.

### Lógica
- **Chequeo de Victoria:**
  - SI (Asesino muerto) -> Ganan Aldeanos.
  - SI (Cant. Vivos <= 2 Y Asesino vivo) -> Gana Asesino (1v1 gana asesino por defecto).
- **Pulido Mobile:** Asegurar targets táctiles grandes, evitar bloqueo de pantalla.

### Entregable
Juego completo funcional de principio a fin.