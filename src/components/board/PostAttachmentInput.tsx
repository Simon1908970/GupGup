"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Film } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getErrorMessage } from "@/lib/utils";
import {
  ATTACHMENT_IMAGE_TYPES,
  ATTACHMENT_VIDEO_TYPES,
  MAX_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  type Attachment,
} from "@/lib/types";

const IMAGE_TYPES: readonly string[] = ATTACHMENT_IMAGE_TYPES;
const VIDEO_TYPES: readonly string[] = ATTACHMENT_VIDEO_TYPES;
const ACCEPT = [...ATTACHMENT_IMAGE_TYPES, ...ATTACHMENT_VIDEO_TYPES].join(",");
const BUCKET = "post-media";

export function PostAttachmentInput({
  value,
  onChange,
  onError,
}: {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  onError: (message: string) => void;
}) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadOne(file: File): Promise<Attachment> {
    const res = await fetch("/api/post-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "upload failed");

    const supabase = createClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });
    if (error) throw error;

    return { url: data.publicUrl as string, type: data.type as Attachment["type"] };
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length === 0) return;

    if (value.length + picked.length > MAX_ATTACHMENTS) {
      onError(t("write.attachmentLimit"));
      return;
    }

    const valid: File[] = [];
    for (const file of picked) {
      const isImage = IMAGE_TYPES.includes(file.type);
      const isVideo = VIDEO_TYPES.includes(file.type);
      if (!isImage && !isVideo) {
        onError(t("write.attachmentType"));
        return;
      }
      if (
        (isImage && file.size > MAX_IMAGE_BYTES) ||
        (isVideo && file.size > MAX_VIDEO_BYTES)
      ) {
        onError(t("write.attachmentTooLarge"));
        return;
      }
      valid.push(file);
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(valid.map(uploadOne));
      onChange([...value, ...uploaded]);
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const atLimit = value.length >= MAX_ATTACHMENTS;

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((a, i) => (
            <li
              key={a.url}
              className="relative h-20 w-20 overflow-hidden rounded-md border border-[var(--color-border-gray)] bg-black/5"
            >
              {a.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <>
                  <video src={a.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <Film
                    size={16}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={t("common.delete")}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || atLimit}
        className="flex w-fit items-center gap-1.5 rounded-md border border-[var(--color-border-gray)] px-3 py-2 text-sm text-[var(--color-text-muted)] disabled:opacity-50"
      >
        <ImagePlus size={16} />
        {uploading
          ? t("write.attachmentUploading")
          : `${t("write.attachmentAdd")} (${value.length}/${MAX_ATTACHMENTS})`}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
