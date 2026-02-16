import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 32, md: 40, lg: 64 };

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#F47B67', '#7289DA'];
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const px = sizeMap[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={px}
        height={px}
        className={`rounded-full object-cover ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold ${className}`}
      style={{ width: px, height: px, backgroundColor: hashColor(name), fontSize: px * 0.4 }}
    >
      {getInitials(name)}
    </div>
  );
}
