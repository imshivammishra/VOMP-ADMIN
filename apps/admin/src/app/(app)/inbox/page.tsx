"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCheck,
  Inbox,
  Mail,
  MessageSquarePlus,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { api, apiWithMeta, queryString } from "@/lib/api";
import { useDebounced, useMediaQuery } from "@/lib/hooks";
import { useRealtime } from "@/lib/realtime";
import { useToast } from "@/lib/toast";
import type { Message, Thread, User } from "@/lib/types";
import {
  THREAD_STATUS,
  cn,
  formatDateTime,
  mailtoHref,
  timeAgo,
  toPhoneHref,
  whatsappHref,
} from "@/lib/utils";
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
  Textarea,
} from "@/components/ui";

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasMore: boolean;
  counts?: Record<string, number>;
  unread?: number;
}
type Envelope<T> = { data: T; meta?: ListMeta };
interface ThreadDetail {
  thread: Thread;
  messages: Message[];
  linkedEnquiry: { id: string; reference: string; status: string } | null;
}

function fetchEnvelope<T>(url: string) {
  return apiWithMeta<T>(url) as Promise<Envelope<T>>;
}

const QUICK_REPLIES = [
  "Thank you for reaching out. Could you share your preferred dates and guest count?",
  "I have shortlisted a few properties for you. May I call you this evening to walk through them?",
  "Holding the date provisionally — I will confirm availability and send the proposal shortly.",
];

function InboxView() {
  const params = useSearchParams();
  const { toast } = useToast();
  const { seq } = useRealtime();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("thread"));
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [newThread, setNewThread] = useState({ customerName: "", phone: "", email: "", city: "", message: "" });
  const readRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const listUrl = `/api/admin/threads${queryString({ q: debounced, status, limit: 40 })}`;
  const { data: list, mutate: mutateList, isValidating } = useSWR<Envelope<Thread[]>>(listUrl, fetchEnvelope);
  const { data: team } = useSWR<User[]>("/api/admin/team/assignees", (path: string) => api<User[]>(path));
  const detailKey = selectedId ? `/api/admin/threads/${selectedId}` : null;
  const { data: detail, mutate: mutateDetail } = useSWR<ThreadDetail>(detailKey, (path: string) => api<ThreadDetail>(path));

  useEffect(() => {
    if (seq > 0) {
      mutateList();
      if (detailKey) mutateDetail();
    }
  }, [seq, mutateList, mutateDetail, detailKey]);

  useEffect(() => {
    if (!selectedId && isDesktop && list?.data?.length) {
      setSelectedId(list.data[0].id);
    }
  }, [selectedId, isDesktop, list]);

  useEffect(() => {
    const thread = detail?.thread;
    if (!thread || readRef.current === thread.id) return;
    readRef.current = thread.id;
    if (thread.unreadAdmin > 0) {
      api(`/api/admin/threads/${thread.id}/read`, { method: "POST" })
        .then(() => {
          mutateList();
          mutateDetail();
        })
        .catch(() => undefined);
    }
  }, [detail, mutateList, mutateDetail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [detail?.messages.length, selectedId]);

  async function sendReply() {
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    try {
      await api<Message>(`/api/admin/threads/${selectedId}/messages`, {
        method: "POST",
        body: { body: reply.trim() },
      });
      setReply("");
      await Promise.all([mutateDetail(), mutateList()]);
      toast("Reply sent", { description: "The conversation is now marked as waiting for the customer." });
    } catch (error) {
      toast("Could not send reply", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSending(false);
    }
  }

  async function updateThread(patch: Record<string, unknown>, message: string) {
    if (!detail?.thread) return;
    try {
      await api<Thread>(`/api/admin/threads/${detail.thread.id}`, { method: "PATCH", body: patch });
      await Promise.all([mutateDetail(), mutateList()]);
      toast(message);
    } catch (error) {
      toast("Could not update conversation", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    }
  }

  async function removeThread(thread: Thread) {
    setDeleting(true);
    try {
      await api(`/api/admin/threads/${thread.id}`, { method: "DELETE" });
      toast("Conversation removed", { description: thread.reference });
      setDeleteTarget(null);
      if (selectedId === thread.id) setSelectedId(null);
      await mutateList();
    } catch (error) {
      toast("Could not remove conversation", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function createThread() {
    if (!newThread.customerName.trim() || !newThread.phone.trim() || !newThread.message.trim()) {
      toast("Add a name, phone and first message", { tone: "error" });
      return;
    }
    setCreating(true);
    try {
      const result = await api<{ thread: Thread }>("/api/admin/threads", {
        method: "POST",
        body: newThread,
      });
      toast("Conversation started", { description: result.thread.reference });
      setNewOpen(false);
      setNewThread({ customerName: "", phone: "", email: "", city: "", message: "" });
      await mutateList();
      setSelectedId(result.thread.id);
    } catch (error) {
      toast("Could not start conversation", {
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  const counts = list?.meta?.counts || {};
  const tabs = [
    { value: "all", label: "All", count: counts.all || 0 },
    { value: "open", label: "Open", count: counts.open || 0 },
    { value: "waiting", label: "Waiting", count: counts.waiting || 0 },
    { value: "resolved", label: "Resolved", count: counts.resolved || 0 },
  ];

  const messagesByDay = useMemo(() => {
    const groups: { day: string; messages: Message[] }[] = [];
    for (const message of detail?.messages || []) {
      const day = new Date(message.createdAt).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.messages.push(message);
      else groups.push({ day, messages: [message] });
    }
    return groups;
  }, [detail?.messages]);

  return (
    <div>
      <PageHeader
        eyebrow="Realtime inbox"
        title="Conversations"
        description="Every website chat in one thread — reply, assign and keep the customer context beside the conversation."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={() => mutateList()} loading={isValidating}>
              Refresh
            </Button>
            <Button variant="primary" icon={MessageSquarePlus} onClick={() => setNewOpen(true)}>
              New conversation
            </Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[315px_minmax(0,1fr)] xl:grid-cols-[315px_minmax(0,1fr)_270px]">
        <Card className={cn("flex h-[calc(100vh-245px)] min-h-[540px] flex-col overflow-hidden", selectedId && "hidden lg:flex")}>
          <div className="border-b border-ink/6 p-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search conversations…" />
            <div className="mt-2.5">
              <Tabs tabs={tabs} value={status} onChange={setStatus} className="flex-wrap" />
            </div>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {(list?.data || []).map((thread) => {
              const active = thread.id === selectedId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(thread.id);
                    setShowInfo(true);
                  }}
                  className={cn(
                    "relative flex w-full gap-2.5 border-b border-ink/4 px-3.5 py-3.5 text-left transition",
                    active ? "bg-cream-soft" : "hover:bg-cream-soft"
                  )}
                >
                  {active && <span className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full bg-[#525252]" />}
                  <div className="relative">
                    <Avatar name={thread.customerName} size="sm" />
                    {thread.unreadAdmin > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#171717] px-1 text-[8px] font-bold text-white ring-2 ring-white">
                        {thread.unreadAdmin}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11.5px] font-bold text-ink">{thread.customerName}</p>
                      <span className="shrink-0 text-[9px] text-[#a79b88]">{timeAgo(thread.lastMessageAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] leading-relaxed text-muted">{thread.lastMessage || "No messages yet"}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          thread.status === "open" ? "bg-ink" : thread.status === "waiting" ? "bg-[#b1a48f]" : "bg-[#d7ccba]"
                        )}
                      />
                      <span className="text-[8.5px] font-semibold tracking-[0.06em] text-[#a79b88] uppercase">{thread.status}</span>
                      {thread.city && <span className="text-[8.5px] text-[#a79b88]">· {thread.city}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
            {!list && <div className="space-y-3 p-3">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-16" />)}</div>}
            {list && list.data.length === 0 && (
              <EmptyState icon={Inbox} title="No conversations" description="Try another filter. New chat threads arrive here in realtime." />
            )}
          </div>
        </Card>

        <Card className={cn("flex h-[calc(100vh-245px)] min-h-[540px] flex-col overflow-hidden", !selectedId && "hidden lg:flex")}>
          {!selectedId && (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={Inbox}
                title="Choose a conversation"
                description="Select a thread on the left to read the history and reply. Every message syncs in realtime."
              />
            </div>
          )}

          {selectedId && !detail && (
            <div className="space-y-4 p-5">
              <Skeleton className="h-12 w-56" />
              <Skeleton className="h-20 w-3/4" />
              <Skeleton className="h-20 w-2/3" />
              <Skeleton className="h-24" />
            </div>
          )}

          {detail && (
            <>
              <div className="flex items-center gap-2.5 border-b border-ink/6 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#5f574a] hover:bg-ink/5 lg:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={16} />
                </button>
                <Avatar name={detail.thread.customerName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-ink">{detail.thread.customerName}</p>
                  <p className="text-[9.5px] text-muted">
                    {detail.thread.reference} · {detail.thread.phone || "No phone"} · {detail.thread.city || "City not shared"}
                  </p>
                </div>
                <StatusPill value={detail.thread.status} map={THREAD_STATUS} />
                <Select
                  value={detail.thread.status}
                  onChange={(event) => updateThread({ status: event.target.value }, "Conversation status updated")}
                  className="hidden h-8 w-auto min-w-[110px] py-0 text-[11px] sm:block"
                >
                  <option value="open">Open</option>
                  <option value="waiting">Waiting</option>
                  <option value="resolved">Resolved</option>
                </Select>
                <button
                  type="button"
                  onClick={() => setShowInfo((value) => !value)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#5f574a] hover:bg-ink/5 xl:hidden"
                  aria-label="Toggle contact details"
                >
                  <MoreHorizontal size={16} />
                </button>
                <div className="hidden items-center gap-1 xl:flex">
                  <a href={toPhoneHref(detail.thread.phone)} className="grid h-8 w-8 place-items-center rounded-full text-[#5f574a] hover:bg-ink/5" title="Call">
                    <Phone size={14} />
                  </a>
                  <a href={whatsappHref(detail.thread.phone, `Hi ${detail.thread.customerName.split(" ")[0]}, this is Venue On My Plate.`)} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full text-[#5f574a] hover:bg-ink/5" title="WhatsApp">
                    <Send size={14} />
                  </a>
                  <a href={mailtoHref(detail.thread.email)} className="grid h-8 w-8 place-items-center rounded-full text-[#5f574a] hover:bg-ink/5" title="Email">
                    <Mail size={14} />
                  </a>
                </div>
              </div>

              <div className="scrollbar-thin flex-1 overflow-y-auto bg-cream-soft px-4 py-4">
                {messagesByDay.map((group) => (
                  <div key={group.day}>
                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-ink/6" />
                      <span className="text-[8.5px] font-bold tracking-[0.14em] text-[#a79b88] uppercase">
                        {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(group.day))}
                      </span>
                      <span className="h-px flex-1 bg-ink/6" />
                    </div>
                    <div className="space-y-3">
                      {group.messages.map((message) => {
                        const mine = message.sender === "admin";
                        const bot = message.sender === "bot";
                        return (
                          <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                            <div className={cn("max-w-[82%]", mine && "items-end")}>
                              <div
                                className={cn(
                                  "rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed shadow-sm",
                                  mine
                                    ? "rounded-br-md bg-ink text-[#fafafa]"
                                    : bot
                                      ? "rounded-bl-md border border-line bg-cream-soft text-[#5f574a]"
                                      : "rounded-bl-md border border-ink/6 bg-white text-[#171717]"
                                )}
                              >
                                {bot && (
                                  <p className="mb-1 flex items-center gap-1 text-[8.5px] font-bold tracking-[0.1em] text-[#5f574a] uppercase">
                                    <Sparkles size={9} /> Plate concierge
                                  </p>
                                )}
                                {message.body}
                              </div>
                              <div className={cn("mt-1 flex items-center gap-1 text-[8.5px] text-[#a79b88]", mine && "justify-end")}>
                                {mine ? "You" : bot ? "Concierge" : detail.thread.customerName} · {formatDateTime(message.createdAt)}
                                {mine && <CheckCheck size={10} className="text-[#5f574a]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-ink/6 bg-white p-3">
                <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK_REPLIES.map((text, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setReply(text)}
                      className="shrink-0 rounded-full border border-ink/8 bg-cream-soft px-2.5 py-1 text-[9.5px] font-medium text-[#5f574a] transition hover:border-line-strong hover:text-ink"
                    >
                      {text.length > 46 ? `${text.slice(0, 46)}…` : text}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendReply();
                      }
                    }}
                    rows={2}
                    placeholder="Write a reply… (Enter to send, Shift+Enter for a new line)"
                    className="min-h-[54px] text-[12.5px]"
                  />
                  <Button variant="primary" icon={Send} loading={sending} onClick={sendReply} disabled={!reply.trim()} className="mb-0.5 h-[54px] px-5">
                    Send
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={detail.thread.assignee}
                      onChange={(event) => updateThread({ assignee: event.target.value }, "Assignment updated")}
                      className="h-7 w-auto min-w-[135px] py-0 text-[10.5px]"
                    >
                      <option value="">Unassigned</option>
                      {(team || []).map((member) => (
                        <option key={member.id} value={member.name}>
                          {member.name}
                        </option>
                      ))}
                    </Select>
                    {detail.linkedEnquiry && (
                      <Link
                        href={`/enquiries?focus=${detail.linkedEnquiry.id}`}
                        className="flex items-center gap-1 rounded-full bg-cream-soft px-2.5 py-1 text-[9.5px] font-semibold text-[#5f574a] hover:underline"
                      >
                        Linked {detail.linkedEnquiry.reference} <ArrowUpRight size={10} />
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(detail.thread)}
                    className="flex items-center gap-1 text-[9.5px] font-medium text-[#a79b88] hover:text-ink"
                  >
                    <Trash2 size={10} /> Remove thread
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className={cn("hidden h-[calc(100vh-245px)] min-h-[540px] flex-col overflow-hidden xl:flex", !showInfo && "xl:hidden")}>
          {detail ? (
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              <div className="border-b border-ink/6 p-4">
                <p className="text-[9px] font-bold tracking-[0.18em] text-[#5f574a] uppercase">Contact card</p>
                <div className="mt-3 flex flex-col items-center text-center">
                  <Avatar name={detail.thread.customerName} size="lg" />
                  <p className="mt-2 text-[13px] font-bold text-ink">{detail.thread.customerName}</p>
                  <p className="text-[10px] text-muted">{detail.thread.city || "City not shared"}</p>
                </div>
                <div className="mt-4 space-y-2">
                  <a href={toPhoneHref(detail.thread.phone)} className="flex items-center gap-2 rounded-lg bg-cream-soft px-2.5 py-2 text-[11px] font-medium text-[#5f574a] hover:bg-cream-soft">
                    <Phone size={12} className="text-[#5f574a]" /> {detail.thread.phone || "No phone"}
                  </a>
                  <a href={mailtoHref(detail.thread.email)} className="flex items-center gap-2 truncate rounded-lg bg-cream-soft px-2.5 py-2 text-[11px] font-medium text-[#5f574a] hover:bg-cream-soft">
                    <Mail size={12} className="shrink-0 text-[#5f574a]" /> <span className="truncate">{detail.thread.email || "No email"}</span>
                  </a>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-[9px] font-bold tracking-[0.12em] text-[#a79b88] uppercase">Conversation</p>
                  <div className="mt-1.5 space-y-1.5 text-[10.5px] text-[#5f574a]">
                    <p className="flex items-center justify-between"><span className="text-muted">Reference</span> <span className="font-semibold">{detail.thread.reference}</span></p>
                    <p className="flex items-center justify-between"><span className="text-muted">Channel</span> <span className="font-semibold">{detail.thread.channel}</span></p>
                    <p className="flex items-center justify-between"><span className="text-muted">Started</span> <span className="font-semibold">{formatDateTime(detail.thread.createdAt)}</span></p>
                    <p className="flex items-center justify-between"><span className="text-muted">Messages</span> <span className="font-semibold">{detail.messages.length}</span></p>
                  </div>
                </div>
                {detail.linkedEnquiry && (
                  <div className="rounded-xl border border-line bg-cream-soft p-3">
                    <p className="flex items-center gap-1 text-[9px] font-bold tracking-[0.12em] text-[#5f574a] uppercase">
                      <UserRound size={10} /> Linked enquiry
                    </p>
                    <p className="mt-1 text-[11.5px] font-semibold text-ink">{detail.linkedEnquiry.reference}</p>
                    <Link href={`/enquiries?focus=${detail.linkedEnquiry.id}`} className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#5f574a] hover:underline">
                      Open lead <ArrowUpRight size={10} />
                    </Link>
                  </div>
                )}
                <div>
                  <p className="text-[9px] font-bold tracking-[0.12em] text-[#a79b88] uppercase">Assignment</p>
                  <Select
                    value={detail.thread.assignee}
                    onChange={(event) => updateThread({ assignee: event.target.value }, "Assignment updated")}
                    className="mt-1.5 h-8 py-0 text-[11px]"
                  >
                    <option value="">Unassigned</option>
                    {(team || []).map((member) => (
                      <option key={member.id} value={member.name}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-5 text-center text-[11px] text-[#a79b88]">
              Contact details appear when a conversation is open.
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Start a conversation"
        description="Log an offline conversation so the full customer history stays in one place."
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={creating} onClick={createThread}>Create thread</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer name" required>
            <Input value={newThread.customerName} onChange={(event) => setNewThread({ ...newThread, customerName: event.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Phone" required>
            <Input value={newThread.phone} onChange={(event) => setNewThread({ ...newThread, phone: event.target.value })} placeholder="+91…" />
          </Field>
          <Field label="Email">
            <Input type="email" value={newThread.email} onChange={(event) => setNewThread({ ...newThread, email: event.target.value })} placeholder="name@email.com" />
          </Field>
          <Field label="City">
            <Input value={newThread.city} onChange={(event) => setNewThread({ ...newThread, city: event.target.value })} placeholder="Udaipur" />
          </Field>
          <Field label="First message" required className="sm:col-span-2">
            <Textarea rows={4} value={newThread.message} onChange={(event) => setNewThread({ ...newThread, message: event.target.value })} placeholder="Summary of the conversation or the message you sent…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeThread(deleteTarget)}
        title="Remove this conversation?"
        description={deleteTarget ? `${deleteTarget.reference} · ${deleteTarget.customerName}` : ""}
        loading={deleting}
      />
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <InboxView />
    </Suspense>
  );
}
