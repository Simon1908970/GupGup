import { extractEmbeds } from "@/lib/embeds";
import { EmbedFrame } from "./EmbedFrame";

export function PostBody({ displayText, rawBody }: { displayText: string; rawBody: string }) {
  const embeds = extractEmbeds(rawBody);

  return (
    <>
      <div className="min-h-32 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {displayText}
      </div>
      {embeds.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {embeds.map((embed) => (
            <EmbedFrame key={embed.embedUrl} provider={embed.provider} embedUrl={embed.embedUrl} />
          ))}
        </div>
      )}
    </>
  );
}
