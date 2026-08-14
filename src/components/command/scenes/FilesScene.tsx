import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCommand } from "../CommandContext";
import {
  FolderOpen, Sparkles, FileText, ArrowLeft, Plus, Upload,
  Image as ImageIcon, Clock, MoreVertical, Pencil, Trash2, FolderInput, Send, X,
  StickyNote, Camera, Loader2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFileOperations } from "./useFileOperations";

// ─── Types ──────────────────────────────────────────────
interface AgentFile {
  id: string;
  agent_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  storage_path: string;
  folder_name: string | null;
  category: string | null;
  created_at: string | null;
  processing_status: string | null;
  aria_extracted: any;
}

interface FolderSummary {
  name: string;
  fileCount: number;
  category: string;
  latestDate: string;
}

// ─── Constants ──────────────────────────────────────────
const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "listing", label: "Property" },
  { value: "client", label: "Client" },
  { value: "personal", label: "Personal" },
] as const;

// ─── Helpers ────────────────────────────────────────────
const toTitleCase = (s: string) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const toSlug = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const formatSize = (bytes: number | null) => {
  if (!bytes) return "0 KB";
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

const formatDate = (d: string | null) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
};

const categoryBadge = (cat: string) => {
  switch (cat) {
    case "listing":
      return { label: "Property", cls: "bg-blue-500/20 text-blue-300" };
    case "client":
      return { label: "Client", cls: "bg-green-500/20 text-green-300" };
    default:
      return { label: "Personal", cls: "bg-muted text-muted-foreground" };
  }
};

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function FilesScene({ sceneParams }: { sceneParams?: Record<string, any> }) {
  const { dispatch } = useCommand();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"grid" | "detail">(sceneParams?.folder_name ? "detail" : "grid");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(sceneParams?.folder_name || null);
  const [allFiles, setAllFiles] = useState<AgentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

  // Rename state
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete folder confirm
  const [deletingFolder, setDeletingFolder] = useState<{ name: string; fileCount: number } | null>(null);

  // Delete file confirm
  const [deletingFile, setDeletingFile] = useState<AgentFile | null>(null);

  // Move file state
  const [movingFile, setMovingFile] = useState<AgentFile | null>(null);

  // Note state
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [deletingNote, setDeletingNote] = useState<AgentFile | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  // New folder dialog state
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCategory, setNewFolderCategory] = useState("listing");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Analyse state
  const [analysing, setAnalysing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // ─── Fetch files ──────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setAgentId(session.user.id);

    const { data, error } = await supabase
      .from("agent_files")
      .select("*")
      .eq("agent_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const withUrls = await Promise.all(
        (data as AgentFile[]).map(async (f) => {
          if ((f.file_type === "image" || f.file_type === "document") && f.storage_path) {
            const { data: signed } = await supabase.storage
              .from("agent-uploads")
              .createSignedUrl(f.storage_path, 3600);
            if (signed?.signedUrl) return { ...f, file_url: signed.signedUrl };
          }
          return f;
        })
      );
      setAllFiles(withUrls);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  useEffect(() => {
    const handler = () => fetchFiles();
    window.addEventListener("folder_created", handler);
    return () => window.removeEventListener("folder_created", handler);
  }, [fetchFiles]);

  useEffect(() => {
    const channel = supabase
      .channel("files-scene-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_files" }, () => fetchFiles())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "agent_files" }, () => fetchFiles())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchFiles]);

  // ─── File operations hook ────────────────────────────
  const { renameFolder, deleteFolder, deleteFile, moveFile, addNote, updateNote, deleteNote } = useFileOperations(agentId, fetchFiles);

  // ─── Computed: folders ────────────────────────────────
  const folders: FolderSummary[] = (() => {
    const map: Record<string, { count: number; category: string; latest: string }> = {};
    for (const f of allFiles) {
      const key = f.folder_name || "unassigned";
      if (!map[key]) map[key] = { count: 0, category: f.category || "personal", latest: f.created_at || "" };
      if (f.file_type !== "placeholder") map[key].count++;
      if (f.created_at && f.created_at > map[key].latest) map[key].latest = f.created_at;
    }
    return Object.entries(map).map(([name, v]) => ({
      name,
      fileCount: v.count,
      category: v.category,
      latestDate: v.latest,
    }));
  })();

  // ─── Filtered folders by category ────────────────────
  const filteredFolders = activeCategory === "all"
    ? folders
    : folders.filter((f) => f.category === activeCategory);

  // ─── Computed: folder detail files ────────────────────
  const folderFiles = selectedFolder
    ? allFiles.filter((f) => f.folder_name === selectedFolder && f.file_type !== "placeholder")
    : [];

  const folderNotes = selectedFolder
    ? allFiles.filter((f) => f.folder_name === selectedFolder && f.file_type === "note")
    : [];

  const folderPhotos = selectedFolder
    ? allFiles.filter((f) => f.folder_name === selectedFolder && f.file_type === "image")
    : [];

  const folderDocs = folderFiles.filter((f) => f.file_type !== "note" && f.file_type !== "image");

  // ─── Upload handler (generic) ─────────────────────────
  const handleUpload = async (files: FileList, forceType?: string) => {
    if (!agentId || !selectedFolder) return;
    setIsUploading(true);
    for (const file of Array.from(files)) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
      const storagePath = `${agentId}/${selectedFolder}/${Date.now()}-${cleanName}`;
      const fileType = forceType || (
        file.type.startsWith("image/") ? "image"
        : file.type === "application/pdf" ? "document"
        : "text"
      );

      const { error } = await supabase.storage.from("agent-uploads").upload(storagePath, file);
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from("agent-uploads").getPublicUrl(storagePath);
      await supabase.from("agent_files").insert({
        agent_id: agentId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: fileType,
        file_size: file.size,
        storage_path: storagePath,
        folder_name: selectedFolder,
        processing_status: "pending",
      });
    }
    setIsUploading(false);
    toast({ title: "Upload complete" });
    await fetchFiles();
  };

  // ─── Photo upload handler ─────────────────────────────
  const handlePhotoUpload = (files: FileList) => handleUpload(files, "image");

  // ─── New Folder (manual dialog) ────────────────────────
  const handleNewFolder = () => {
    setNewFolderName("");
    setNewFolderCategory("listing");
    setShowNewFolderDialog(true);
  };

  const confirmCreateFolder = async () => {
    if (!agentId || !newFolderName.trim()) return;
    setCreatingFolder(true);
    const slug = toSlug(newFolderName);
    if (!slug) { setCreatingFolder(false); return; }

    // Insert a placeholder file to create the folder
    const { error } = await supabase.from("agent_files").insert({
      agent_id: agentId,
      file_name: `folder-placeholder`,
      file_url: "",
      file_type: "placeholder",
      file_size: 0,
      storage_path: "",
      folder_name: slug,
      category: newFolderCategory,
      processing_status: "complete",
    });

    if (error) {
      toast({ title: "Failed to create folder", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Folder created" });
      await fetchFiles();
      window.dispatchEvent(new CustomEvent("folder_created"));
    }
    setCreatingFolder(false);
    setShowNewFolderDialog(false);
  };

  // ─── Rename handlers ─────────────────────────────────
  const startRename = (folderName: string) => {
    setRenamingFolder(folderName);
    setRenameValue(toTitleCase(folderName));
  };

  const confirmRename = async () => {
    if (!renamingFolder) return;
    const newSlug = toSlug(renameValue);
    if (!newSlug) { setRenamingFolder(null); return; }
    await renameFolder(renamingFolder, newSlug);
    if (selectedFolder === renamingFolder) setSelectedFolder(newSlug);
    setRenamingFolder(null);
  };

  // ─── Analyse folder with ARIA ─────────────────────────
  const handleAnalyse = async () => {
    if (!agentId || !selectedFolder) return;
    setAnalysing(true);
    setAnalysisResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyse-agent-files", {
        body: { folder_name: selectedFolder, agent_id: agentId, category: "listing" },
      });
      if (error) throw error;
      if (data?.success && data?.extracted) {
        setAnalysisResult(data.extracted);
        toast({ title: "Analysis complete", description: `Confidence: ${data.extracted.confidence || 0}%` });
      } else {
        toast({ title: "Analysis note", description: data?.error || "No data could be extracted.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalysing(false);
    }
  };

  const handlePrefillListing = () => {
    if (!analysisResult) return;
    dispatch({
      type: "NAVIGATE",
      scene: "listing_form",
      params: {
        prefill: {
          ...analysisResult,
          folder_name: selectedFolder,
        },
      },
    });
  };

  // ─── Loading ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  //  DETAIL VIEW
  // ═══════════════════════════════════════════════════════
  if (view === "detail" && selectedFolder) {
    const badge = categoryBadge(
      folders.find((f) => f.name === selectedFolder)?.category || "personal"
    );

    return (
      <div className="p-6 h-full flex flex-col overflow-hidden">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <button
            onClick={() => { setView("grid"); setSelectedFolder(null); setAnalysisResult(null); }}
            className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm text-muted-foreground font-body">Files</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground font-body">
            {toTitleCase(selectedFolder)}
          </span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0 gap-2">
          <h2 className="font-heading text-2xl text-navy font-bold truncate">
            {toTitleCase(selectedFolder)}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyse}
              disabled={analysing}
              className="font-body text-xs border-gold/30 text-gold hover:bg-gold/10"
            >
              {analysing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
              {analysing ? "Analysing..." : "Analyse"}
            </Button>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-gold hover:bg-gold-dark text-navy font-body"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {isUploading ? "Uploading..." : "Add Files"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </div>
        </div>

        {/* Analysis Result Banner */}
        {analysisResult && (
          <div className="mb-4 p-4 rounded-xl border border-gold/30 bg-gold/5 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-heading font-semibold text-foreground mb-1">
                  <Sparkles className="w-4 h-4 inline mr-1 text-gold" />
                  ARIA Analysis — {analysisResult.confidence || 0}% confidence
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs font-body text-muted-foreground mt-2">
                  {analysisResult.property_name && <span><b className="text-foreground">Name:</b> {analysisResult.property_name}</span>}
                  {analysisResult.property_type && <span><b className="text-foreground">Type:</b> {analysisResult.property_type}</span>}
                  {analysisResult.transaction_type && <span><b className="text-foreground">Transaction:</b> {analysisResult.transaction_type}</span>}
                  {analysisResult.price && <span><b className="text-foreground">Price:</b> ${Number(analysisResult.price).toLocaleString()}</span>}
                  {analysisResult.size_sqft && <span><b className="text-foreground">Size:</b> {analysisResult.size_sqft} sqft</span>}
                  {analysisResult.bedrooms && <span><b className="text-foreground">Beds:</b> {analysisResult.bedrooms}</span>}
                  {analysisResult.tenure && <span><b className="text-foreground">Tenure:</b> {analysisResult.tenure}</span>}
                  {analysisResult.district && <span><b className="text-foreground">District:</b> D{analysisResult.district}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={handlePrefillListing}
                  className="bg-gold hover:bg-gold-dark text-navy font-body text-xs"
                >
                  Pre-fill Listing
                </Button>
                <button onClick={() => setAnalysisResult(null)} className="p-1 hover:bg-muted/40 rounded">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="photos" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-muted/30 shrink-0">
            <TabsTrigger value="photos" className="font-body text-xs">
              <Camera className="w-3.5 h-3.5 mr-1" />
              Photos ({folderPhotos.length})
            </TabsTrigger>
            <TabsTrigger value="files" className="font-body text-xs">
              <FileText className="w-3.5 h-3.5 mr-1" />
              Files ({folderDocs.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="font-body text-xs">
              <StickyNote className="w-3.5 h-3.5 mr-1" />
              Notes ({folderNotes.length})
            </TabsTrigger>
          </TabsList>

          {/* ─── Photos Tab ──────────────────────────── */}
          <TabsContent value="photos" className="flex-1 overflow-y-auto mt-4">
            <div className="mb-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploading}
                className="font-body text-xs"
              >
                <Camera className="w-4 h-4 mr-1.5" />
                {isUploading ? "Uploading..." : "Upload Photos"}
              </Button>
              <input
                ref={photoInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handlePhotoUpload(e.target.files)}
              />
            </div>
            {folderPhotos.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-10 font-body">
                No photos yet. Upload property images above.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {folderPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group/photo rounded-lg overflow-hidden border border-border bg-muted/20 aspect-square"
                  >
                    <img
                      src={photo.file_url}
                      alt={photo.file_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/30 transition-colors flex items-end justify-between p-2 opacity-0 group-hover/photo:opacity-100">
                      <span className="text-[10px] text-white font-body truncate max-w-[70%]">{photo.file_name}</span>
                      <button
                        onClick={() => setDeletingFile(photo)}
                        className="p-1 bg-black/50 rounded hover:bg-destructive/80 transition-colors"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Files Tab ───────────────────────────── */}
          <TabsContent value="files" className="flex-1 overflow-y-auto mt-4">
            {folderDocs.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-10 font-body">
                No documents in this folder yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {folderDocs.map((file) => (
                  <div
                    key={file.id}
                    className="bg-surface border border-border rounded-xl p-4 shadow-card hover:shadow-lg transition-all relative group/file"
                  >
                    {/* File ⋮ menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover/file:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-md hover:bg-muted/60 transition-colors">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[140px]">
                          <DropdownMenuItem onClick={() => setMovingFile(file)}>
                            <FolderInput className="w-4 h-4 mr-2" /> Move to folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingFile(file)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="w-full h-32 rounded-lg mb-3 bg-muted/20 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-body font-medium text-foreground truncate">
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-body">
                      <span>{formatSize(file.file_size)}</span>
                      <span>·</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Notes Tab ───────────────────────────── */}
          <TabsContent value="notes" className="flex-1 flex flex-col overflow-hidden mt-4">
            <div className="flex-1 overflow-y-auto">
              {folderNotes.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-10 font-body">
                  No notes yet. Add one below.
                </p>
              )}
              <div className="space-y-3">
                {folderNotes.map((note) => {
                  const noteText = (note.aria_extracted as any)?.raw_text || note.file_name;
                  const isEditing = editingNoteId === note.id;

                  return (
                    <div
                      key={note.id}
                      className="bg-surface border border-border rounded-lg p-4 group/note"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editNoteText}
                            onChange={(e) => setEditNoteText(e.target.value)}
                            className="text-sm font-body min-h-[80px]"
                            autoFocus
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs font-body"
                              onClick={() => setEditingNoteId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs font-body bg-gold hover:bg-gold-dark text-navy"
                              onClick={async () => {
                                await updateNote(note.id, editNoteText);
                                setEditingNoteId(null);
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-body text-foreground whitespace-pre-wrap">
                            {noteText}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground font-body">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {formatDate(note.created_at)}
                            </p>
                            <div className="flex gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditNoteText(noteText);
                                }}
                                className="p-1 rounded hover:bg-muted/60 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => setDeletingNote(note)}
                                className="p-1 rounded hover:bg-destructive/20 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add note textarea */}
            <div className="shrink-0 mt-3 border-t border-border pt-3">
              <div className="flex gap-2">
                <Textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add a note..."
                  className="text-sm font-body min-h-[60px] resize-none flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && newNoteText.trim()) {
                      e.preventDefault();
                      setSavingNote(true);
                      addNote(selectedFolder!, newNoteText.trim()).then(() => {
                        setNewNoteText("");
                        setSavingNote(false);
                      });
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={!newNoteText.trim() || savingNote}
                  className="bg-gold hover:bg-gold-dark text-navy font-body self-end"
                  onClick={async () => {
                    setSavingNote(true);
                    await addNote(selectedFolder!, newNoteText.trim());
                    setNewNoteText("");
                    setSavingNote(false);
                  }}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground font-body mt-1">⌘+Enter to save</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Move File Dialog */}
        <AlertDialog open={!!movingFile} onOpenChange={(o) => !o && setMovingFile(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading">Move File</AlertDialogTitle>
              <AlertDialogDescription className="font-body">
                Move <span className="font-medium text-foreground">{movingFile?.file_name}</span> to another folder.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Select
              onValueChange={async (val) => {
                if (movingFile) {
                  await moveFile(movingFile.id, movingFile.folder_name, val);
                  setMovingFile(null);
                }
              }}
            >
              <SelectTrigger className="font-body">
                <SelectValue placeholder="Choose folder..." />
              </SelectTrigger>
              <SelectContent>
                {folders
                  .filter((f) => f.name !== movingFile?.folder_name)
                  .map((f) => (
                    <SelectItem key={f.name} value={f.name} className="font-body">
                      {toTitleCase(f.name)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete File Dialog */}
        <AlertDialog open={!!deletingFile} onOpenChange={(o) => !o && setDeletingFile(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading">Remove File</AlertDialogTitle>
              <AlertDialogDescription className="font-body">
                Delete <span className="font-medium text-foreground">{deletingFile?.file_name}</span>? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
                onClick={async () => {
                  if (deletingFile) {
                    await deleteFile(deletingFile.id, deletingFile.storage_path, deletingFile.folder_name);
                    setDeletingFile(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Note Dialog */}
        <AlertDialog open={!!deletingNote} onOpenChange={(o) => !o && setDeletingNote(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading">Delete Note</AlertDialogTitle>
              <AlertDialogDescription className="font-body">
                Delete this note? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
                onClick={async () => {
                  if (deletingNote) {
                    await deleteNote(deletingNote.id, deletingNote.folder_name);
                    setDeletingNote(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  //  GRID VIEW
  // ═══════════════════════════════════════════════════════
  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="font-heading text-2xl text-navy font-bold">My Files</h2>
        <Button
          size="sm"
          onClick={handleNewFolder}
          className="bg-gold hover:bg-gold-dark text-navy font-body"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Folder
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 mb-4 shrink-0 overflow-x-auto">
        {CATEGORIES.map((cat) => {
          const count = cat.value === "all"
            ? folders.length
            : folders.filter((f) => f.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-colors whitespace-nowrap ${
                activeCategory === cat.value
                  ? "bg-gold text-navy"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Folder cards */}
      <div className="flex-1 overflow-y-auto">
        {filteredFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Sparkles className="w-12 h-12 text-gold/40 mb-4" />
            <h3 className="font-heading text-lg text-navy font-semibold mb-2">
              {activeCategory === "all" ? "No folders yet" : `No ${CATEGORIES.find(c => c.value === activeCategory)?.label} folders`}
            </h3>
            <p className="text-sm text-muted-foreground font-body max-w-sm">
              Ask ARIA to create one — try:{" "}
              <span className="text-gold italic">"create a folder for Nassim Hill"</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFolders.map((folder) => {
              const badge = categoryBadge(folder.category);
              const isRenaming = renamingFolder === folder.name;

              return (
                <div
                  key={folder.name}
                  onClick={() => {
                    if (!isRenaming) {
                      setSelectedFolder(folder.name);
                      setView("detail");
                    }
                  }}
                  className="bg-surface border border-border rounded-xl p-5 shadow-card hover:shadow-lg cursor-pointer transition-all group relative"
                >
                  {/* Folder ⋮ menu */}
                  <div
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-md hover:bg-muted/60 transition-colors">
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[140px]">
                        <DropdownMenuItem onClick={() => startRename(folder.name)}>
                          <Pencil className="w-4 h-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingFolder({ name: folder.name, fileCount: folder.fileCount })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-start justify-between mb-3">
                    <FolderOpen className="w-8 h-8 text-gold group-hover:scale-110 transition-transform" />
                    <span className={`text-[10px] font-body font-medium px-2 py-0.5 rounded-full capitalize ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {isRenaming ? (
                    <div className="flex gap-1.5 items-center" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename();
                          if (e.key === "Escape") setRenamingFolder(null);
                        }}
                        autoFocus
                        className="h-7 text-sm font-body"
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-body" onClick={confirmRename}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <h3 className="font-body font-semibold text-foreground text-sm mb-1">
                      {toTitleCase(folder.name)}
                    </h3>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-body mt-1">
                    <span>{folder.fileCount} file{folder.fileCount !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{formatDate(folder.latestDate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Folder Dialog */}
      <AlertDialog open={!!deletingFolder} onOpenChange={(o) => !o && setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Delete Folder</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Delete <span className="font-medium text-foreground">{deletingFolder && toTitleCase(deletingFolder.name)}</span> and all{" "}
              {deletingFolder?.fileCount} file{deletingFolder?.fileCount !== 1 ? "s" : ""}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
              onClick={async () => {
                if (deletingFolder) {
                  await deleteFolder(deletingFolder.name);
                  setDeletingFolder(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Create New Folder</DialogTitle>
            <DialogDescription className="font-body text-muted-foreground">
              Give your folder a name and choose a category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-body font-medium text-foreground">Folder Name</label>
              <Input
                placeholder="e.g. Nassim Hill Condo"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmCreateFolder()}
                autoFocus
                className="font-body"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-body font-medium text-foreground">Category</label>
              <Select value={newFolderCategory} onValueChange={setNewFolderCategory}>
                <SelectTrigger className="font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="listing">Property</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)} className="font-body">
              Cancel
            </Button>
            <Button
              onClick={confirmCreateFolder}
              disabled={!newFolderName.trim() || creatingFolder}
              className="bg-gold hover:bg-gold-dark text-navy font-body"
            >
              {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
