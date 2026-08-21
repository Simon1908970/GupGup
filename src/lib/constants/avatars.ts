export interface DefaultAvatar {
  id: string;
  url: string;
}

export const DEFAULT_AVATARS: DefaultAvatar[] = [
  { id: "male-1", url: "/avatars/male-1.svg" },
  { id: "male-2", url: "/avatars/male-2.svg" },
  { id: "male-3", url: "/avatars/male-3.svg" },
  { id: "male-4", url: "/avatars/male-4.svg" },
  { id: "male-5", url: "/avatars/male-5.svg" },
  { id: "female-1", url: "/avatars/female-1.svg" },
  { id: "female-2", url: "/avatars/female-2.svg" },
  { id: "female-3", url: "/avatars/female-3.svg" },
  { id: "female-4", url: "/avatars/female-4.svg" },
  { id: "female-5", url: "/avatars/female-5.svg" },
];

export function randomDefaultAvatar(): string {
  const pick = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
  return pick.url;
}
