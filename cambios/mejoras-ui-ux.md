# Plan de Mejoras: Mafia Impostor

## Resumen
Mejoras de UI/UX para el juego existente sin cambiar reglas ni agregar roles.

**Problemas a resolver:**
1. Los resumenes de ronda son dificiles de entender
2. La experiencia de jugador muerto es aburrida
3. Falta pulido general de UI/UX

---

## Parte 1: Resumenes de Ronda Dramaticos

### Problema Actual
- Solo texto plano en un modal: `"El Asesino no eligio a tiempo..."`
- Sin estructura, sin drama, sin claridad

### Solucion: Revelacion Paso a Paso

**1.1 Agregar campo estructurado al schema**
```
Archivo: convex/schema.ts
Cambio: Agregar lastRoundEvents como array de objetos con type, actorName, targetName, etc.
```

**1.2 Modificar resolucion de ronda**
```
Archivo: convex/games.ts (funcion resolveRound, lineas 345-465)
Cambio: Generar array de eventos estructurados en lugar de solo texto
Eventos: attack, heal_success, death, investigate_found, etc.
```

**1.3 Nuevo componente RoundSummary**
```
Archivo: components/round-summary.tsx (NUEVO)
Funcion: Modal de pantalla completa con revelacion secuencial
- Fondo oscuro con luna animada
- Eventos mostrados uno por uno (2.5s cada uno)
- Iconos y colores segun tipo de evento
- Animaciones de entrada dramaticas
- Boton "Saltar" para impacientes
```

**1.4 Componente EventCard**
```
Archivo: components/event-card.tsx (NUEVO)
Funcion: Tarjeta individual para cada evento
- Icono grande animado (🔪 💉 🔍 💀)
- Titulo segun tipo: "El Asesino Ataca", "El Curandero Salva"
- Reveal del nombre del objetivo con delay
- Colores por rol (rojo/verde/azul)
```

---

## Parte 2: Modo Espectador para Jugadores Muertos

### Problema Actual
- Solo ven: 💀 "Estas Muerto" y nada mas
- No pueden ver que pasa en el juego
- Aburrido esperar que termine

### Solucion: Vista de Espectador

**2.1 Nueva query para datos de espectador**
```
Archivo: convex/games.ts
Funcion: getSpectatorData
- Solo para jugadores muertos
- Retorna: todos los jugadores CON sus roles revelados
- Acciones del turno actual en tiempo real
```

**2.2 Componente SpectatorView**
```
Archivo: components/spectator-view.tsx (NUEVO)
Funcion: Interfaz completa para espectadores
- Badge "Modo Espectador" con icono de ojo
- Timer de la ronda actual
- Grid de jugadores con ROLES VISIBLES
- Indicadores en vivo de quien esta actuando
- Resumen de ronda anterior
```

**2.3 Tarjeta de jugador para espectadores**
```
Archivo: components/player-spectator-card.tsx (NUEVO)
Funcion: Mostrar jugador con su rol revelado
- Emoji del rol en esquina
- Nombre y label del rol visible
- Indicador si esta actuando (pulsando)
- Overlay de 💀 si esta muerto
- Escala de grises para muertos
```

**2.4 Integracion en game-view**
```
Archivo: components/game-view.tsx (lineas 148-163)
Cambio: En lugar de mostrar "Estas Muerto" estatico, renderizar SpectatorView
```

---

## Parte 3: Pulido General de UI/UX

### 3.1 Timer Mejorado
```
Archivo: components/game-view.tsx
Cambios:
- Amarillo a 10s, rojo a 5s, GRANDE y pulsante a 3s
- Efecto glow detras del timer en momentos criticos
- Escala aumenta en ultimos segundos
```

### 3.2 Seleccion de Objetivos
```
Archivo: components/game-view.tsx (lineas 222-246)
Cambios:
- Hover scale-105 con sombra
- Colores segun rol del jugador (rojo para asesino, etc)
- Efecto ripple al seleccionar
- Crosshair overlay para asesino cuando selecciona
```

### 3.3 Estado de Confirmacion
```
Archivo: components/game-view.tsx (lineas 257-279)
Cambios:
- Colores segun rol (no solo verde generico)
- Mensajes especificos: "Objetivo Marcado" para asesino, "Protegiendo..." para curandero
- Emoji del rol animado
```

### 3.4 Animaciones CSS
```
Archivo: app/globals.css
Agregar:
- @keyframes glow-pulse (efecto resplandor)
- @keyframes heartbeat (pulso de corazon)
- Clases utilitarias: .animate-glow, .animate-heartbeat
```

### 3.5 Lobby Mejorado
```
Archivo: components/lobby-view.tsx
Cambios:
- Animacion slide-in cuando se une jugador
- Punto verde "online" en avatares
- Icono de check animado en badge "Listo"
- Mensaje "Esperando mas jugadores" con icono si hay <3
```

### 3.6 Pantalla de Fin de Juego
```
Archivo: components/game-view.tsx (lineas 126-145)
Cambios:
- Gradiente de fondo segun ganador (verde aldeanos, rojo asesino)
- Revelacion de TODOS los roles al final
- Animaciones de entrada escalonadas
- Emojis mas grandes y animados
```

---

## Archivos a Modificar

| Archivo | Accion | Prioridad |
|---------|--------|-----------|
| `convex/schema.ts` | Agregar lastRoundEvents | ALTA |
| `convex/games.ts` | Modificar resolveRound, agregar getSpectatorData | ALTA |
| `components/round-summary.tsx` | CREAR | ALTA |
| `components/event-card.tsx` | CREAR | ALTA |
| `components/spectator-view.tsx` | CREAR | MEDIA |
| `components/player-spectator-card.tsx` | CREAR | MEDIA |
| `components/game-view.tsx` | Modificar timer, acciones, estado muerto | MEDIA |
| `components/lobby-view.tsx` | Agregar animaciones | BAJA |
| `app/globals.css` | Agregar keyframes | MEDIA |

---

## Orden de Implementacion

### Fase 1: Resumenes Dramaticos
1. Modificar schema.ts (agregar lastRoundEvents)
2. Modificar games.ts (generar eventos estructurados)
3. Crear round-summary.tsx
4. Crear event-card.tsx
5. Integrar en game-view.tsx

### Fase 2: Modo Espectador
1. Agregar query getSpectatorData en games.ts
2. Crear player-spectator-card.tsx
3. Crear spectator-view.tsx
4. Modificar game-view.tsx para usar SpectatorView cuando muerto

### Fase 3: Pulido UI
1. Mejorar timer en game-view.tsx
2. Mejorar seleccion de objetivos
3. Mejorar estados de confirmacion
4. Agregar animaciones CSS
5. Mejorar lobby y pantalla final

---

## Verificacion

1. **Crear partida** - Verificar que el lobby funciona con animaciones
2. **Jugar ronda completa** - Verificar que el resumen dramatico aparece
3. **Morir en el juego** - Verificar modo espectador con roles visibles
4. **Terminar partida** - Verificar pantalla de fin con roles revelados
5. **Probar timer** - Verificar efectos visuales en ultimos segundos

---

## Notas Tecnicas

- Usar `cn()` de lib/utils.ts para clases condicionales
- Usar ROLES de lib/game-constants.ts para colores/emojis consistentes
- tw-animate-css ya instalado para animaciones de entrada
- lucide-react disponible para iconos (Eye, Radio, Crosshair, Heart, etc)
- Convex queries se actualizan en tiempo real automaticamente
