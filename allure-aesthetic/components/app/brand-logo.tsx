"use client"

import { useState } from "react"
import { cn } from "cn"

/**
 * Renders a brand logo image with a graceful text-wordmark fallback — a
 * missing or broken file never shows a broken image.
 */
export function BrandLogo({
  src,
  alt,
  wordmark,
  imgClassName,
  wordmarkClassName,
}: {
  src?: string | null
  alt: string
  wordmark: string
  imgClassName?: string
  wordmarkClassName?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span className={cn("font-black tracking-tight text-foreground select-none", wordmarkClassName)}>
        {wordmark}
      </span>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={cn("select-none", imgClassName)}
      onError={() => setFailed(true)}
      draggable={false}
    />
  )
}
