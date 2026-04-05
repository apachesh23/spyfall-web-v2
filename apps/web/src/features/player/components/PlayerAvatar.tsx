// /components/player/PlayerAvatar.tsx
// Аватар игрока (только id + image)
// Используется в списках игроков, карточках, везде в игре
// GPT: МОЖНО менять стили, НЕ менять использование lib/avatars

'use client';

import { AvatarId, getAvatarImage, getAvatar } from '@/lib/avatars';

type PlayerAvatarProps = {
  avatarId: AvatarId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_PX = { sm: 32, md: 48, lg: 64 } as const;

export function PlayerAvatar({ avatarId, size = "md", className = "" }: PlayerAvatarProps) {
  const avatar = getAvatar(avatarId);
  const px = SIZE_PX[size];

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: px,
        height: px,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
      }}
      title={avatar.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAvatarImage(avatarId)}
        alt={avatar.name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}