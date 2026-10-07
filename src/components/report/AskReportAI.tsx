import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ReportContext = { scope: "global" | "country"; periodDays?: number; countryId?: string; countryName?: string; rows: Record<string, unknown>[]; summary?: Record<string, unknown> };

const SUGGESTIONS = {
  en: {
    global: ["Which market has the most followers?", "Compare platforms across markets", "Where are our data coverage gaps?"],
    country: ["Which platform has the most followers?", "How did followers change this period?", "What should our team investigate next?"],
  },
  zh: {
    global: ["哪个市场的粉丝数最多？", "比较各市场的平台表现", "我们的数据覆盖缺口在哪里？"],
    country: ["哪个平台的粉丝数最多？", "本周期粉丝数如何变化？", "团队下一步应该重点调查什么？"],
  },
};

type ReportLanguage = "en" | "zh";

export function AskReportAI({ context, language = "en" }: { context: ReportContext; language?: ReportLanguage }) {
  const zh = language === "zh";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const scopeKey = [context.scope, context.countryId ?? "all", context.periodDays ?? ""].join(":");

  useEffect(() => { setMessages([]); setQuestion(""); setError(""); }, [scopeKey]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  async function ask(value = question) {
    const text = value.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setQuestion("");
    setError("");
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ question: text, history: next.slice(-7, -1), report: context }),
      });
      const result = await res.json();
      if (!res.ok || !result.answer) throw new Error(result.error ?? (zh ? `请求失败（${res.status}）` : `Request failed (${res.status})`));
      setMessages([...next, { role: "assistant", content: result.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : (zh ? "暂时无法回答，请稍后再试。" : "Unable to answer right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm print:hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-4 text-left text-white">
        <span>
          <span className="block text-base font-bold">{zh ? "✦ 向 AI 询问此报告" : "✦ Ask AI about this report"}</span>
          <span className="mt-0.5 block text-xs text-blue-100">{zh ? "可使用中文或 English 提问 · 回答基于当前报告数据" : "Ask questions in English or 中文 · Answers use this report's data"}</span>
        </span>
        <span aria-hidden="true" className="text-xl">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="p-4 sm:p-5">
          <div ref={scrollRef} aria-live="polite" className="max-h-[360px] min-h-[90px] space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <p className="py-4 text-sm text-slate-500">{zh ? "可询问市场表现、粉丝增长、平台对比、数据来源及下一步行动。所有数字均基于当前显示的报告。" : "Ask about market performance, follower growth, platform comparisons, data sources and next steps. Figures are based on the report currently shown."}</p>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[94%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed sm:max-w-[85%] ${message.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {loading && <p className="text-sm text-slate-500">{zh ? "正在分析此报告…" : "Analysing this report…"}</p>}
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button className="ml-2 underline" onClick={() => ask(messages[messages.length - 1]?.content ?? "")}>{zh ? "重试" : "Retry"}</button></p>}
          {messages.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS[language][context.scope].map((item) => (
                <button type="button" key={item} onClick={() => void ask(item)} disabled={loading}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                  {item}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500}
              placeholder={zh ? "向 AI 提问…" : "Ask a question about the report…"}
              aria-label={zh ? "向报告 AI 提问" : "Question for report AI"}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            <button type="submit" disabled={loading || !question.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? (zh ? "思考中…" : "Thinking…") : (zh ? "询问 AI →" : "Ask AI →")}
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-400">{zh ? "AI 可能会出错。重要结论请结合下方表格与更新时间核对。" : "AI may make mistakes. Verify important conclusions against the tables and timestamps below."}</p>
        </div>
      )}
    </section>
  );
}
