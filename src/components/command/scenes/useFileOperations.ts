import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useFileOperations(agentId: string | null, onRefresh: () => Promise<void>) {
  const { toast } = useToast();

  const renameFolder = useCallback(async (oldSlug: string, newSlug: string) => {
    if (!agentId || !newSlug || newSlug === oldSlug) return;

    const { error } = await supabase
      .from("agent_files")
      .update({ folder_name: newSlug })
      .eq("folder_name", oldSlug)
      .eq("agent_id", agentId);

    if (error) {
      toast({ title: "Rename failed", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from("file_activity_log").insert({
      agent_id: agentId,
      action: "RENAME_FOLDER",
      folder_name: newSlug,
      old_value: { folder_name: oldSlug },
      new_value: { folder_name: newSlug },
      source: "ui",
    });

    toast({ title: "Folder renamed" });
    await onRefresh();
  }, [agentId, onRefresh, toast]);

  const deleteFolder = useCallback(async (folderName: string) => {
    if (!agentId) return;

    // Get all files in folder to remove from storage
    const { data: files } = await supabase
      .from("agent_files")
      .select("id, storage_path, file_type")
      .eq("agent_id", agentId)
      .eq("folder_name", folderName);

    if (files && files.length > 0) {
      const storagePaths = files
        .filter((f) => f.file_type !== "placeholder" && f.file_type !== "note" && f.storage_path)
        .map((f) => f.storage_path);

      if (storagePaths.length > 0) {
        await supabase.storage.from("agent-uploads").remove(storagePaths);
      }

      await supabase
        .from("agent_files")
        .delete()
        .eq("folder_name", folderName)
        .eq("agent_id", agentId);
    }

    await supabase.from("file_activity_log").insert({
      agent_id: agentId,
      action: "DELETE_FOLDER",
      folder_name: folderName,
      source: "ui",
    });

    toast({ title: "Folder deleted" });
    await onRefresh();
  }, [agentId, onRefresh, toast]);

  const deleteFile = useCallback(async (fileId: string, storagePath: string, folderName: string | null) => {
    if (!agentId) return;

    await supabase.storage.from("agent-uploads").remove([storagePath]);

    const { error } = await supabase
      .from("agent_files")
      .delete()
      .eq("id", fileId);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from("file_activity_log").insert({
      agent_id: agentId,
      action: "DELETE_FILE",
      file_id: fileId,
      folder_name: folderName,
      source: "ui",
    });

    toast({ title: "File removed" });
    await onRefresh();
  }, [agentId, onRefresh, toast]);

  const moveFile = useCallback(async (fileId: string, oldFolder: string | null, newFolder: string) => {
    if (!agentId || oldFolder === newFolder) return;

    const { error } = await supabase
      .from("agent_files")
      .update({ folder_name: newFolder })
      .eq("id", fileId);

    if (error) {
      toast({ title: "Move failed", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from("file_activity_log").insert({
      agent_id: agentId,
      action: "MOVE_FILE",
      file_id: fileId,
      old_value: { folder_name: oldFolder },
      new_value: { folder_name: newFolder },
      source: "ui",
    });

    toast({ title: "File moved" });
    await onRefresh();
  }, [agentId, onRefresh, toast]);

  const addNote = useCallback(async (folderName: string, noteText: string) => {
    if (!agentId || !noteText.trim()) return;

    const { data, error } = await supabase
      .from("agent_files")
      .insert({
        agent_id: agentId,
        file_name: `note-${Date.now()}`,
        file_url: "",
        file_type: "note",
        file_size: 0,
        storage_path: "",
        folder_name: folderName,
        category: "listing",
        processing_status: "complete",
        aria_extracted: { raw_text: noteText },
      })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Note save failed", description: error.message, variant: "destructive" });
      return;
    }

    // Sync to rag_documents for ARIA search
    if (data?.id) {
      await supabase.from("rag_documents").insert({
        agent_id: agentId,
        source_type: "note",
        source_id: data.id,
        content: noteText,
        is_public: false,
        metadata: { folder_name: folderName, source: "note" },
      });
    }

    toast({ title: "Note saved" });
    await onRefresh();
  }, [agentId, onRefresh, toast]);

  const updateNote = useCallback(async (fileId: string, noteText: string) => {
    if (!agentId || !noteText.trim()) return;

    const { error } = await supabase
      .from("agent_files")
      .update({ aria_extracted: { raw_text: noteText } })
      .eq("id", fileId);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    // Update rag_documents
    await supabase
      .from("rag_documents")
      .update({ content: noteText, updated_at: new Date().toISOString() })
      .eq("source_id", fileId)
      .eq("source_type", "note");

    toast({ title: "Note updated" });
    await onRefresh();
  }, [agentId, onRefresh, toast]);

  const deleteNote = useCallback(async (fileId: string, folderName: string | null) => {
    if (!agentId) return;

    const { error } = await supabase
      .from("agent_files")
      .delete()
      .eq("id", fileId);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    // Remove from rag_documents
    await supabase
      .from("rag_documents")
      .delete()
      .eq("source_id", fileId)
      .eq("source_type", "note");

    await supabase.from("file_activity_log").insert({
      agent_id: agentId,
      action: "DELETE_NOTE",
      file_id: fileId,
      folder_name: folderName,
      source: "ui",
    });

    toast({ title: "Note deleted" });
    await onRefresh();
  }, [agentId, onRefresh, toast]);

  return { renameFolder, deleteFolder, deleteFile, moveFile, addNote, updateNote, deleteNote };
}
