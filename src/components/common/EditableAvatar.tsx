"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { getErrorMessage } from "@/lib/utils";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif";

export function EditableAvatar({
  nickname,
  avatarUrl,
  size = 64,
  onUploaded,
  onError,
}: {
  nickname: string;
  avatarUrl?: string;
  size?: number;
  onUploaded: (url: string) => void;
  onError?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "upload failed");
      onUploaded(data.avatarUrl);
    } catch (err) {
      onError?.(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <Avatar nickname={nickname} avatarUrl={avatarUrl} size={size} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-red)] text-white ring-2 ring-white disabled:opacity-60"
      >
        <Camera size={12} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />
      {uploading && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[10px] text-white">
          ...
        </span>
      )}
    </span>
  );
}
