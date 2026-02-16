import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Script {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function useScripts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const scriptsQuery = useQuery({
    queryKey: ["scripts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scripts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Script[];
    },
    enabled: !!user,
  });

  const createScript = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const { data, error } = await supabase
        .from("scripts")
        .insert({ title, content, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Script;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scripts"] }),
  });

  const updateScript = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: string }) => {
      const { data, error } = await supabase
        .from("scripts")
        .update({ title, content })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Script;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scripts"] }),
  });

  const deleteScript = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scripts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scripts"] }),
  });

  return {
    scripts: scriptsQuery.data ?? [],
    isLoading: scriptsQuery.isLoading,
    createScript,
    updateScript,
    deleteScript,
  };
}
