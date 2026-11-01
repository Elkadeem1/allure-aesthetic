"use client"

import { X } from "lucide-react"
import { useEffect } from "react"
import type { KbArticle } from "./types"
import { KbArticleBody } from "./kb-article-body"

type Props = {
  article: KbArticle
  onClose: () => void
}

export function SidePanel({ article, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel — slides in from the left (content side in RTL) */}
      <div
        className="fixed top-0 start-0 bottom-0 z-50 w-full max-w-sm bg-card shadow-xl border-e border-border flex flex-col"
        dir="rtl"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">{article.title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <KbArticleBody slug={article.slug} body={article.body} />
        </div>
      </div>
    </>
  )
}
