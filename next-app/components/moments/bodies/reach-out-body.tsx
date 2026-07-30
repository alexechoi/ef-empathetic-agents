"use client";

import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerDurationDisplay,
  AudioPlayerElement,
  AudioPlayerPlayButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
} from "@/components/ai-elements/audio-player";

import type { MomentBodyProps } from "../decision-registry";

export function ReachOutBody({ moment, onPlaybackChange }: MomentBodyProps) {
  return (
    <div className="flex flex-col gap-2">
      {moment.audioSrc ? (
        <AudioPlayer className="rounded-md border px-2 py-1">
          <AudioPlayerElement
            // media-chrome adds tabindex to the audio element client-side
            suppressHydrationWarning
            src={moment.audioSrc}
            onPlay={() => onPlaybackChange?.(moment.id, true)}
            onPause={() => onPlaybackChange?.(moment.id, false)}
            onEnded={() => onPlaybackChange?.(moment.id, false)}
          />
          <AudioPlayerControlBar>
            <AudioPlayerPlayButton />
            <AudioPlayerTimeDisplay />
            <AudioPlayerTimeRange />
            <AudioPlayerDurationDisplay />
          </AudioPlayerControlBar>
        </AudioPlayer>
      ) : null}
      {moment.openingMessage ? (
        <p className="text-sm text-muted-foreground">
          &ldquo;{moment.openingMessage}&rdquo;
        </p>
      ) : null}
    </div>
  );
}
