import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Send, Bot, User, Sparkles, Wifi, WifiOff, ArrowDown } from "lucide-react";
import { sendChatMessage } from "@/integrations/chatApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TablesInsert } from "@/integrations/supabase/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

type ChatMessageRow = TablesInsert<"chat_messages">;

const QUICK_PROMPTS = [
  "I'm having a craving right now",
  "Give me motivation to stay strong",
  "What are the health benefits so far?",
  "Help me with stress management",
];

const ChatBot = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI recovery companion. I'm here to support you on your smoke-free journey. How are you feeling today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [userId, setUserId] = useState<string>("");
  const [conversationId] = useState<string>("default");

  // Network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll-to-bottom button visibility
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Load chat history
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          setUserId(user.id);
          try {
            await supabase
              .from("conversations")
              .upsert({ id: conversationId, user_id: user.id, title: null }, { onConflict: "id" });
          } catch { }
          const { data, error } = await supabase
            .from("chat_messages")
            .select("role, content, created_at, conversation_id")
            .eq("user_id", user.id)
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .limit(200);
          if (error) {
            console.error("Supabase history error:", error);
            toast.error("Failed to load chat history");
            setIsHistoryLoading(false);
            return;
          }
          if (data && data.length > 0) {
            const restored: Message[] = data.map((row: any) => ({
              role: row.role,
              content: row.content,
              timestamp: row.created_at ? new Date(row.created_at) : undefined,
            }));
            setMessages(restored);
          }
          setIsHistoryLoading(false);
        } else {
          setIsHistoryLoading(false);
        }
      } catch (e) {
        console.warn("Failed to initialize chat history:", e);
        setIsHistoryLoading(false);
      }
    })();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSend = async (overrideMsg?: string) => {
    const msg = overrideMsg || input;
    if (!msg.trim() || isLoading || !isOnline) return;

    const userMessage: Message = { role: "user", content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const data = await sendChatMessage(
        userMessage.content,
        userId || undefined,
        conversationId,
        { temperature: 0.3, top_k: 5 }
      );
      const tokens = data.response.split(/(\s+)/);
      const assistantEmpty: Message = { role: "assistant", content: "", timestamp: new Date() };
      setIsLoading(false);
      setMessages(prev => [...prev, assistantEmpty]);

      for (const token of tokens) {
        await new Promise(r => setTimeout(r, token.trim().length === 0 ? 10 : 30));
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + token };
          }
          return updated;
        });
      }

      // Persist
      if (userId) {
        try {
          const now = new Date();
          const rows: ChatMessageRow[] = [
            { user_id: userId, role: "user", content: userMessage.content, conversation_id: conversationId, created_at: now.toISOString() },
            { user_id: userId, role: "assistant", content: data.response, conversation_id: conversationId, created_at: new Date(now.getTime() + 1).toISOString() },
          ];
          const { error: insertErr } = await supabase.from("chat_messages").insert(rows);
          if (insertErr) console.warn("Supabase insert error:", insertErr);
        } catch (dbErr) {
          console.warn("Supabase persistence failed:", dbErr);
        }
      }
    } catch (err: any) {
      console.error("Chat API error:", err);
      let errorMessage = "Sorry, I'm having trouble right now. Please try again in a moment.";
      if (!isOnline) errorMessage = "📡 You appear to be offline. Please check your internet connection.";
      else if (err.message?.includes('Failed to fetch')) errorMessage = "🔌 Connection issue. Please check your network.";
      else if (err.message?.includes('timeout')) errorMessage = "⏰ Request timed out. Please try again.";

      setMessages(prev => [...prev, { role: "assistant", content: errorMessage, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50">
      <DashboardHeader dayNumber={1} />

      {/* ─── Chat Header ─── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-primary flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">QuitGuard AI</h1>
              <p className="text-[11px] sm:text-xs text-slate-500">
                {isOnline ? 'Online • Ready to help' : 'Offline • Limited support'}
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
            isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      {/* ─── Messages Area ─── */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3"
      >
        <div className="max-w-3xl mx-auto space-y-3">
          {isHistoryLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading conversation...</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-2.5 animate-fade-in ${
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                    message.role === "user" ? "bg-slate-700" : "bg-gradient-primary"
                  }`}>
                    {message.role === "assistant" ? (
                      <Bot className="w-4 h-4 text-white" />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`flex flex-col max-w-[80%] sm:max-w-[75%] ${
                    message.role === "user" ? "items-end" : "items-start"
                  }`}>
                    <div
                      className={`px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm ${
                        message.role === "user"
                          ? "bg-slate-800 text-white rounded-2xl rounded-tr-md"
                          : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-md"
                      }`}
                    >
                      <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-line">
                        {message.content}
                      </p>
                    </div>

                    {message.timestamp && (
                      <span className="text-[10px] mt-1 px-1 text-slate-400">
                        {formatTime(message.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex gap-2.5 animate-fade-in">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="px-4 py-3 bg-white border border-slate-200 rounded-2xl rounded-tl-md shadow-sm">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Quick prompts — only show at start */}
              {messages.length <= 1 && !isLoading && (
                <div className="pt-4 space-y-2">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider px-1">Quick start</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        className="text-xs sm:text-[13px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium hover:border-primary hover:text-primary hover:bg-primary/5 transition-all active:scale-95"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-2" />
            </>
          )}
        </div>
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="fixed bottom-36 right-4 sm:right-8 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-slate-500 hover:text-primary transition-colors z-30"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* ─── Input Area ─── */}
      <div className="bg-white border-t border-slate-200 px-3 sm:px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder={isOnline ? "Type a message..." : "Offline — limited support"}
                className="w-full min-h-[44px] max-h-[120px] px-4 py-2.5 text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none bg-slate-50 shadow-sm transition-all disabled:bg-slate-100 disabled:cursor-not-allowed placeholder:text-slate-400"
                rows={1}
                disabled={isLoading || !isOnline}
                style={{ height: 'auto' }}
              />
            </div>

            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading || !isOnline}
              className="bg-gradient-primary hover:brightness-110 text-white rounded-2xl h-[44px] w-[44px] sm:w-auto sm:px-5 shadow-sm transition-all disabled:opacity-40"
              size="lg"
            >
              <Send className="w-4 h-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2 font-semibold">Send</span>
            </Button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ChatBot;