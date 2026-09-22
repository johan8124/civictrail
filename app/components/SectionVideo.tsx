"use client";

import { useEffect, useRef } from "react";

/**
 * Cinematic full-bleed section background video (presentation only).
 * Autoplays, loops, muted, playsInline — and pauses under
 * prefers-reduced-motion so animation is never forced.
 */
export function SectionVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true; // React does not server-render the muted attribute.
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (media.matches) {
        video.pause();
      } else {
        void video.play().catch(() => undefined);
      }
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={videoRef}
      className="ct-video absolute inset-0 -z-10 h-full w-full object-cover"
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
