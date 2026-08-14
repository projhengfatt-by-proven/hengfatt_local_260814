const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aria-chat`;
const CLASSIFY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classify-intent`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

interface StreamChatParams {
  messages: ChatMessage[];
  agentContext?: any;
  onDelta: (text: string) => void;
  onDone: (cleanText: string, toolCalls: ToolCall[], stopReason: string | null) => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
}

// Tracks one in-progress content block (text or tool_use) while its
// deltas stream in. Anthropic streams tool-call arguments as raw JSON
// *fragments* (`input_json_delta`) — these are buffered as a plain string
// and only JSON.parse'd once the block closes, since a partial fragment
// isn't valid JSON on its own.
interface BlockState {
  type: string;
  textBuf: string;
  jsonBuf: string;
  name?: string;
  id?: string;
}

export async function streamARIA({
  messages,
  agentContext,
  onDelta,
  onDone,
  onError,
  signal,
}: StreamChatParams) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, agentContext }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    if (resp.status === 401 || resp.status === 403) {
      onError?.("ARIA couldn't authenticate with the AI provider. Please contact support.");
      return;
    }
    if (resp.status === 429) {
      onError?.("Rate limit exceeded. Please wait a moment and try again.");
      return;
    }
    if (resp.status === 529) {
      onError?.("The AI is temporarily overloaded. Please try again in a moment.");
      return;
    }
    onError?.("Failed to connect to ARIA.");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const blocks: Record<number, BlockState> = {};
  let cleanText = "";
  const toolCalls: ToolCall[] = [];
  let stopReason: string | null = null;
  let done = false;
  let streamError: string | null = null;
  let gotMessageStop = false;

  function handleEvent(parsed: any) {
    switch (parsed.type) {
      // Anthropic can send this mid-stream (model overload, internal error,
      // etc.) independent of the initial HTTP status, which was already 200
      // by this point. Previously unhandled — the stream would just end
      // with empty cleanText and no tool calls, silently, with no toast.
      case "error": {
        streamError = parsed.error?.message || "The AI hit an error mid-response.";
        done = true;
        break;
      }
      case "content_block_start": {
        const block = parsed.content_block;
        blocks[parsed.index] = {
          type: block.type,
          textBuf: "",
          jsonBuf: "",
          name: block.name,
          id: block.id,
        };
        break;
      }
      case "content_block_delta": {
        const block = blocks[parsed.index];
        if (!block) break;
        if (parsed.delta.type === "text_delta") {
          block.textBuf += parsed.delta.text;
          cleanText += parsed.delta.text;
          onDelta(parsed.delta.text);
        } else if (parsed.delta.type === "input_json_delta") {
          block.jsonBuf += parsed.delta.partial_json;
        }
        // thinking_delta and any other delta types are intentionally
        // ignored — never rendered, never forwarded.
        break;
      }
      case "content_block_stop": {
        const block = blocks[parsed.index];
        if (block?.type === "tool_use" && block.name && block.id) {
          try {
            const input = block.jsonBuf ? JSON.parse(block.jsonBuf) : {};
            toolCalls.push({ id: block.id, name: block.name, input });
          } catch (e) {
            console.error("Failed to parse tool_use input JSON:", e, block.jsonBuf);
          }
        }
        break;
      }
      case "message_delta": {
        if (parsed.delta?.stop_reason) stopReason = parsed.delta.stop_reason;
        break;
      }
      case "message_stop": {
        done = true;
        gotMessageStop = true;
        break;
      }
      // message_start and any unrecognized event types need no handling.
    }
  }

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const json = line.slice(6).trim();
      try {
        handleEvent(JSON.parse(json));
      } catch {
        // Incomplete JSON split across a chunk boundary — put the line
        // back and wait for more data.
        buf = line + "\n" + buf;
        break;
      }
      if (done) break;
    }
  }

  if (streamError) {
    onError?.(streamError);
    return;
  }
  // The connection can also just drop (network hiccup, edge function
  // timeout, upstream cutting the socket) without ever sending a clean
  // `error` event OR a `message_stop` — reader.read() just reports done.
  // Previously this fell straight through to onDone with empty content
  // and no error shown, the "thinks, then silently nothing" symptom.
  // Only treat it as an error if nothing usable was ever produced —
  // if some text already streamed via onDelta, let it stand rather than
  // erroring out a partial-but-real answer.
  if (!gotMessageStop && !cleanText && toolCalls.length === 0) {
    onError?.("Connection to ARIA closed unexpectedly before a response arrived. Please try again.");
    return;
  }
  onDone(cleanText, toolCalls, stopReason);
}

export interface ClassifyIntentResult {
  intent: string | null;
  confidence: number;
  threshold: number | null;
}

// Fails open on any error — a broken classifier must never break the chat,
// it should just be treated as "no match" and fall through to the AI.
export async function classifyIntent(text: string, signal?: AbortSignal): Promise<ClassifyIntentResult> {
  try {
    const resp = await fetch(CLASSIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!resp.ok) return { intent: null, confidence: 0, threshold: null };
    return (await resp.json()) as ClassifyIntentResult;
  } catch {
    return { intent: null, confidence: 0, threshold: null };
  }
}
