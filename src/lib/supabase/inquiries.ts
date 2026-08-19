import { createClient } from "@/lib/supabase/client";

export interface InquiryRow {
  id: string;
  title: string;
  status: "pending" | "answered";
  createdAt: string;
}

export async function fetchInquiries(userId: string): Promise<InquiryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select("id, title, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    status: i.status as "pending" | "answered",
    createdAt: i.created_at,
  }));
}

export async function fetchInquiry(id: string): Promise<InquiryRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select("id, title, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    status: data.status as "pending" | "answered",
    createdAt: data.created_at,
  };
}

export interface InquiryMessageRow {
  id: string;
  senderType: "user" | "admin";
  body: string;
  createdAt: string;
}

export async function fetchInquiryMessages(inquiryId: string): Promise<InquiryMessageRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inquiry_messages")
    .select("id, sender_type, body, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    senderType: m.sender_type as "user" | "admin",
    body: m.body,
    createdAt: m.created_at,
  }));
}

export async function createInquiry(
  userId: string,
  title: string,
  body: string,
): Promise<string> {
  const supabase = createClient();
  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .insert({ user_id: userId, title })
    .select("id")
    .single();
  if (error) throw error;

  const { error: msgError } = await supabase.from("inquiry_messages").insert({
    inquiry_id: inquiry.id,
    sender_type: "user",
    sender_id: userId,
    body,
  });
  if (msgError) throw msgError;

  return inquiry.id;
}

export async function sendInquiryMessage(inquiryId: string, userId: string, body: string) {
  const supabase = createClient();
  const { error } = await supabase.from("inquiry_messages").insert({
    inquiry_id: inquiryId,
    sender_type: "user",
    sender_id: userId,
    body,
  });
  if (error) throw error;
}
