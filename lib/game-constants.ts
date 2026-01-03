export const ROLES = {
  asesino: {
    label: "Asesino",
    emoji: "🔪",
    description: "Elige a una víctima para eliminarla.",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    actionLabel: "Matar",
  },
  curandero: {
    label: "Curandero",
    emoji: "💉",
    description: "Elige a alguien para protegerlo de la muerte.",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    actionLabel: "Curar",
  },
  detective: {
    label: "Detective",
    emoji: "🕵️",
    description: "Investiga a un sospechoso para revelar su identidad.",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    actionLabel: "Investigar",
  },
  aldeano: {
    label: "Aldeano",
    emoji: "👨‍🌾",
    description: "Eres inocente. Intenta sobrevivir.",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    actionLabel: null,
  },
};
