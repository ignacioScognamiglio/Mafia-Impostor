# Mafia Impostor

Un juego de rol y deduccion en tiempo real inspirado en Mafia/Werewolf. Los jugadores deben descubrir quien es el asesino antes de que sea demasiado tarde.

## Roles

- **Asesino**: Elimina a un jugador cada noche. Gana si queda solo con 1 aldeano o si el detective muere.
- **Detective**: Investiga a un jugador cada noche. Si descubre al asesino, los aldeanos ganan.
- **Curandero**: Protege a un jugador cada noche. Si elige correctamente, salva a la victima.
- **Aldeano**: Vota sospechas para ayudar al detective a identificar al asesino.

## Reglas del juego

1. Se necesitan al menos 3 jugadores para comenzar
2. Cada ronda dura 15 segundos
3. Si el asesino no elige victima, ataca al azar
4. El detective ve las sospechas de los aldeanos como pistas
5. Si el detective y el asesino actuan uno contra el otro, gana el mas rapido

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Convex (base de datos reactiva + funciones serverless)
- **Auth**: Clerk
- **UI Components**: Radix UI, shadcn/ui

## Instalacion

```bash
# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev
```

## Variables de entorno

Crea un archivo `.env.local` con:

```env
NEXT_PUBLIC_CONVEX_URL=tu_url_de_convex
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=tu_clerk_key
CLERK_SECRET_KEY=tu_clerk_secret
```

## Scripts disponibles

- `npm run dev` - Inicia frontend y backend en paralelo
- `npm run build` - Build de produccion
- `npm run lint` - Ejecuta ESLint

## Estructura del proyecto

```
mafia-impostor/
├── app/                  # Paginas de Next.js
├── components/           # Componentes React
│   ├── ui/              # Componentes base (shadcn)
│   ├── game-view.tsx    # Vista del juego en progreso
│   └── lobby-view.tsx   # Vista de la sala de espera
├── convex/              # Backend de Convex
│   ├── schema.ts        # Esquema de la base de datos
│   └── games.ts         # Logica del juego
└── lib/                 # Utilidades
```

## Licencia

MIT
