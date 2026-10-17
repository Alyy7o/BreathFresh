export type ChatModelParams = {
  temperature?: number;
  top_k?: number;
};

export type ChatMessageRequest = {
  message: string;
  user_id?: string;
  conversation_id?: string;
  model_params?: ChatModelParams;
};

export type ChatMessageResponse = {
  success: boolean;
  response: string;
  intent: string;
  confidence: number;
  used_retrieval: boolean;
  used_refinement: boolean;
  processing_time: number;
  chunks_retrieved: number;
  error?: string | null;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export async function sendChatMessage(
  message: string,
  userId?: string,
  conversationId?: string,
  modelParams?: ChatModelParams,
): Promise<ChatMessageResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, user_id: userId, conversation_id: conversationId, model_params: modelParams } satisfies ChatMessageRequest),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ChatMessageResponse;
  return data;
}

export type ChatLogItem = {
  role: "user" | "assistant";
  content: string;
  created_at: number; // epoch seconds
  conversation_id?: string | null;
};

export type ChatLogResponse = {
  items: ChatLogItem[];
};

export async function getChatHistory(userId: string, limit = 50): Promise<ChatLogResponse> {
  const url = new URL(`${API_BASE}/chats`, window.location.origin);
  url.searchParams.set("user_id", userId);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`History API error ${res.status}: ${text}`);
  }
  return (await res.json()) as ChatLogResponse;
}