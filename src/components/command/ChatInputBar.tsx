import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, Mic, MicOff, X, Image, FileText, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface Attachment {
  file?: File;
  url?: string;
  name: string;
  type: "image" | "document" | "link";
}

interface ChatInputBarProps {
  input: string;
  setInput: (val: string) => void;
  onSend: (text: string, attachments?: Attachment[]) => void;
  disabled: boolean;
  placeholder: string;
}

export function ChatInputBar({ input, setInput, onSend, disabled, placeholder }: ChatInputBarProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const [plusOpen, setPlusOpen] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en-SG" | "zh-CN">("en-SG");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!plusOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-plus-menu]")) {
        setPlusOpen(false);
        setLinkMode(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [plusOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || disabled) return;
    onSend(input, attachments.length > 0 ? attachments : undefined);
    setAttachments([]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map(f => ({ file: f, name: f.name, type: "image" as const }));
      setAttachments(prev => [...prev, ...newAttachments]);
      setPlusOpen(false);
    }
    e.target.value = "";
  };

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map(f => ({ file: f, name: f.name, type: "document" as const }));
      setAttachments(prev => [...prev, ...newAttachments]);
      setPlusOpen(false);
    }
    e.target.value = "";
  };

  const handleLinkSubmit = () => {
    if (linkInput.trim()) {
      setAttachments(prev => [...prev, { url: linkInput.trim(), name: linkInput.trim(), type: "link" }]);
      setLinkInput("");
      setLinkMode(false);
      setPlusOpen(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not Supported", description: "Voice input is not supported in this browser. Try Chrome or Edge.", variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onend = () => { setIsRecording(false); recognitionRef.current = null; };
    recognition.onerror = (event: any) => {
      setIsRecording(false);
      recognitionRef.current = null;
      if (event.error !== "no-speech") {
        toast({ title: "Voice Error", description: `Speech recognition error: ${event.error}`, variant: "destructive" });
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [voiceLang, toast, setInput]);

  const stopRecording = useCallback(() => { recognitionRef.current?.stop(); setIsRecording(false); }, []);

  const toggleVoice = () => { isRecording ? stopRecording() : startRecording(); };

  const switchLang = (lang: "en-SG" | "zh-CN") => {
    setVoiceLang(lang);
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setTimeout(() => startRecording(), 100);
    }
  };

  return (
    <div className="px-3 py-3 border-t border-gold/10 shrink-0">
      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {attachments.map((att, i) => {
            const icon = att.type === "image" ? "🖼" : att.type === "link" ? "🔗" : "📄";
            return (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gold/40 bg-navy text-cream font-body text-xs max-w-full">
                <span>{icon}</span>
                <span className="truncate max-w-[140px]">{att.name}</span>
                <button onClick={() => removeAttachment(i)} className="text-cream/50 hover:text-cream ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Language toggle when recording */}
      {isRecording && (
        <div className="mb-2 flex items-center gap-1.5 justify-center">
          <button onClick={() => switchLang("en-SG")} className={`px-2 py-0.5 rounded text-[11px] font-body font-semibold transition-colors ${voiceLang === "en-SG" ? "bg-gold text-navy" : "bg-navy-light text-cream/50 hover:text-cream"}`}>EN</button>
          <button onClick={() => switchLang("zh-CN")} className={`px-2 py-0.5 rounded text-[11px] font-body font-semibold transition-colors ${voiceLang === "zh-CN" ? "bg-gold text-navy" : "bg-navy-light text-cream/50 hover:text-cream"}`}>中文</button>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {/* Plus button */}
        <div className="relative shrink-0" data-plus-menu>
          <button
            onClick={() => { setPlusOpen(!plusOpen); setLinkMode(false); }}
            className="w-9 h-9 rounded-full border border-gold/60 flex items-center justify-center transition-colors shrink-0"
            style={{ background: "rgba(201,168,76,0.15)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,168,76,0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(201,168,76,0.15)")}
          >
            <Plus className="w-4 h-4 text-gold" />
          </button>
          {plusOpen && (
            <div className="absolute bottom-11 left-0 w-48 bg-navy border border-gold/20 rounded-lg shadow-lg py-1 z-50">
              {linkMode ? (
                <div className="p-2">
                  <p className="text-[11px] text-cream/50 font-body mb-1.5">Paste a link</p>
                  <div className="flex gap-1">
                    <input type="text" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLinkSubmit()} placeholder="https://..." className="flex-1 bg-navy-light border border-gold/10 rounded px-2 py-1 text-xs text-cream font-body placeholder:text-cream/30 focus:outline-none focus:border-gold/30" autoFocus />
                    <button onClick={handleLinkSubmit} className="text-gold hover:text-gold-light text-xs font-body font-semibold px-1.5">Add</button>
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={() => fileRef.current?.click()} className="w-full px-3 py-2 text-left text-sm font-body text-cream/80 hover:bg-gold/10 hover:text-cream flex items-center gap-2 transition-colors">
                    <Image className="w-4 h-4 text-gold/70" /> Upload Photo
                  </button>
                  <button onClick={() => docRef.current?.click()} className="w-full px-3 py-2 text-left text-sm font-body text-cream/80 hover:bg-gold/10 hover:text-cream flex items-center gap-2 transition-colors">
                    <FileText className="w-4 h-4 text-gold/70" /> Upload Document
                  </button>
                  <button onClick={() => setLinkMode(true)} className="w-full px-3 py-2 text-left text-sm font-body text-cream/80 hover:bg-gold/10 hover:text-cream flex items-center gap-2 transition-colors">
                    <Link2 className="w-4 h-4 text-gold/70" /> Share Link
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={isRecording ? "Listening..." : placeholder} rows={1} className="flex-1 resize-none bg-navy-light border border-gold/10 rounded-lg px-3 py-2 text-sm text-cream font-body placeholder:text-cream/30 focus:outline-none focus:border-gold/30 max-h-24 overflow-y-auto" />

        {/* Mic */}
        <button
          onClick={toggleVoice}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all shrink-0 ${isRecording ? "border-red-500 bg-red-500/20 animate-pulse" : "border-gold/60"}`}
          style={isRecording ? {} : { background: "rgba(201,168,76,0.15)" }}
          onMouseEnter={(e) => { if (!isRecording) e.currentTarget.style.background = "rgba(201,168,76,0.25)"; }}
          onMouseLeave={(e) => { if (!isRecording) e.currentTarget.style.background = "rgba(201,168,76,0.15)"; }}
        >
          {isRecording ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-gold" />}
        </button>

        {/* Send */}
        <button onClick={handleSend} disabled={(!input.trim() && attachments.length === 0) || disabled} className="w-9 h-9 rounded-lg bg-gold hover:bg-gold-light disabled:opacity-30 flex items-center justify-center transition-colors shrink-0">
          <Send className="w-4 h-4 text-navy" />
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.txt" multiple className="hidden" onChange={handleDocSelect} />
    </div>
  );
}
