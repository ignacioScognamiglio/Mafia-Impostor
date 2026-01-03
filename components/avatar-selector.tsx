"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const AVATARS = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Zack",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Molly",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Bear",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Pepper",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Snowy",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Tiger",
];

interface AvatarSelectorProps {
  selected: string;
  onSelect: (avatar: string) => void;
}

export function AvatarSelector({ selected, onSelect }: AvatarSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 pt-2">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          onClick={() => onSelect(avatar)}
          className={cn(
            "rounded-full p-1 border-2 transition-all",
            selected === avatar
              ? "border-primary scale-110"
              : "border-transparent opacity-70 hover:opacity-100"
          )}
        >
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatar} />
            <AvatarFallback>?</AvatarFallback>
          </Avatar>
        </button>
      ))}
    </div>
  );
}
