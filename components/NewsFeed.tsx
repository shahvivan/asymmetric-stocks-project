"use client";

import useSWR from "swr";
import { useApp } from "@/app/providers";
import { FinnhubNewsArticle } from "@/lib/types";
import { getRelativeTime } from "@/lib/utils";
import SetupPrompt from "./SetupPrompt";

interface NewsFeedProps {
  ticker: string;
}

export default function NewsFeed({ ticker }: NewsFeedProps) {
  const { settings } = useApp();

  const { data: articles, isLoading } = useSWR<FinnhubNewsArticle[]>(
    settings.finnhubApiKey
      ? `/api/finnhub/news?symbol=${ticker}&token=${settings.finnhubApiKey}`
      : null,
    { refreshInterval: 60000, revalidateOnFocus: false }
  );

  if (!settings.finnhubApiKey) return <SetupPrompt variant="finnhub" size="compact" />;

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-3">
        <div className="text-sm font-bold text-white mb-2">News</div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="w-1.5 h-1.5 bg-buy rounded-full animate-pulse" />
          Loading news...
        </div>
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-3">
        <div className="text-sm font-bold text-white mb-2">News</div>
        <p className="text-xs text-muted">No recent news</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="text-sm font-bold text-white mb-2">News</div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {articles.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 rounded-lg hover:bg-white/5 transition-colors group"
          >
            <div className="text-xs text-white group-hover:text-buy transition-colors line-clamp-2">
              {article.headline}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted">{article.source}</span>
              <span className="text-[10px] text-muted-2">
                {getRelativeTime(article.datetime * 1000)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
