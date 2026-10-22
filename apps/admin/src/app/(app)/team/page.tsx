"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Check,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Role, User } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/ui";

const ROLE_INFO: Record<Role, { label: string; description: string; className: string }> = {
  admin: {
    label: "Admin",
    description: "Full control — settings, team, deletions and every lead.",
    className: "bg-ink/8 text-ink ring-[#0a0a0a]/20",
  },
  editor: {
    label: "Editor",
    description: "Manage enquiries, conversations, catalogue and media.",
    className: "bg-[#f7f7f7] text-[#525252] ring-[#a3a3a3]/30",
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to the workspace and reports.",
    className: "bg-[#f7f7f7] text-muted ring-line",
  },
};

interface TeamForm {
  id?: string;
  name: string;
  email: string;
  role: Role;
  password: string;
}

const EMPTY: TeamForm = { name: "", email: "", role: "editor", password: "" };

export default function TeamPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<TeamForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, error, mutate, isValidating } = useSWR<User[]>("/api/admin/team", (path: string) => api<User[]>(path));
  const { data: meta } = useSWR<{ owner: User | null; seatLimit: number }>(
    "/api/admin/team/meta",
    (path: string) => api(path),
    { shouldRetryOnError: false }
  );

  const members = data || [];

  async function save() {
    if (!form) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast("Add a name and email address", { tone: "error" });
      return;
    }
    if (!form.id && form.password.length < 10) {
      toast("Use a password with at least 10 characters", { tone: "error" });
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        const patch: Record<string, unknown> = { name: form.name, role: form.role };
        if (form.password) patch.password = form.password;
        await api(`/api/admin/team/${form.id}`, { method: "PATCH", body: patch });
        toast("Teammate updated", { description: form.name });
      } else {
        await api("/api/admin/team", {
          method: "POST",
          body: { name: form.name, email: form.email, role: form.role, password: form.password },
        });
        toast("Teammate invited", { description: `${form.name} can now sign in.` });
      }
      setForm(null);
      await mutate();
    } catch (error) {
      toast("Could not save teammate", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function patchMember(member: User, patch: Record<string, unknown>, message: string) {
    setBusyId(member.id);
    try {
      await api(`/api/admin/team/${member.id}`, { method: "PATCH", body: patch });
      await mutate();
      toast(message, { description: member.name });
    } catch (error) {
      toast("Could not update teammate", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(member: User) {
    setDeleting(true);
    try {
      await api(`/api/admin/team/${member.id}`, { method: "DELETE" });
      toast("Teammate removed", { description: member.name });
      setDeleteTarget(null);
      await mutate();
    } catch (error) {
      toast("Could not remove teammate", { description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const activeCount = members.filter((member) => member.status === "active").length;
  const adminCount = members.filter((member) => member.role === "admin" && member.status === "active").length;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Team & access"
        description="Give the right people the right amount of access. Every action they take is recorded in the activity log."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>Refresh</Button>
            <Button variant="primary" icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add teammate</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[9px] font-bold tracking-[0.16em] text-[#525252] uppercase">Active seats</p>
          <p className="font-display mt-1 text-[34px] leading-none font-semibold text-ink">{activeCount}<span className="ml-1 text-[15px] text-[#a3a3a3]">/ {meta?.seatLimit || 50}</span></p>
          <p className="mt-1.5 text-[10.5px] text-muted">teammates with access</p>
        </Card>
        <Card className="p-4">
          <p className="text-[9px] font-bold tracking-[0.16em] text-[#525252] uppercase">Admins</p>
          <p className="font-display mt-1 text-[34px] leading-none font-semibold text-ink">{adminCount}</p>
          <p className="mt-1.5 text-[10.5px] text-muted">full workspace control</p>
        </Card>
        <Card className="p-4">
          <p className="text-[9px] font-bold tracking-[0.16em] text-[#525252] uppercase">Workspace owner</p>
          <p className="mt-1 truncate text-[13px] font-semibold text-ink">{meta?.owner?.name || me?.name || "—"}</p>
          <p className="mt-1 truncate text-[10.5px] text-muted">{meta?.owner?.email || me?.email}</p>
        </Card>
      </div>

      {error && (
        <Card className="mb-4 border-line-strong bg-[#f7f7f7] p-4">
          <p className="text-[12px] font-semibold text-ink">Team management is limited to admins.</p>
          <p className="mt-1 text-[11px] text-muted">{error instanceof Error ? error.message : "You do not have permission to view this page."}</p>
        </Card>
      )}

      {!data && !error && <div className="space-y-3">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-20 " />)}</div>}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-ink/6 px-5 py-4">
            <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#525252] uppercase">Workspace members</p>
            <h2 className="font-display mt-0.5 text-[26px] leading-none font-semibold text-ink">People with access</h2>
          </div>
          <div className="divide-y divide-black/5">
            {members.map((member) => {
              const self = member.id === me?.id;
              return (
                <div key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <Avatar name={member.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold text-ink">
                      {member.name}
                      {self && <Badge className="bg-[#f7f7f7] text-muted ring-ink/6">you</Badge>}
                    </p>
                    <p className="truncate text-[10.5px] text-muted">{member.email}</p>
                  </div>
                  <div className="hidden items-center gap-3 text-[10px] text-muted md:flex">
                    <span className="flex items-center gap-1"><UserRound size={10} /> {member.assignedCount || 0} leads</span>
                    <span className="flex items-center gap-1"><ShieldCheck size={10} /> {member.activeSessions || 0} sessions</span>
                  </div>
                  <Select
                    value={member.role}
                    disabled={self || busyId === member.id}
                    onChange={(event) => patchMember(member, { role: event.target.value }, "Role updated")}
                    className="h-8 w-auto min-w-[100px] py-0 text-[11px]"
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </Select>
                  <Badge className={member.status === "active" ? "bg-ink text-white ring-ink" : "bg-[#f7f7f7] text-[#6b6b6b] ring-line"}>
                    {member.status}
                  </Badge>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={self || busyId === member.id}
                      onClick={() => patchMember(member, { status: member.status === "active" ? "suspended" : "active" }, member.status === "active" ? "Access suspended" : "Access restored")}
                      className={cn(
                        "grid h-7 w-7 place-items-center  transition-colors disabled:opacity-30",
                        member.status === "active" ? "text-[#a3a3a3] hover:bg-[#f7f7f7] hover:text-ink" : "text-[#a3a3a3] hover:bg-[#f7f7f7] hover:text-ink"
                      )}
                      title={member.status === "active" ? "Suspend access" : "Restore access"}
                    >
                      {member.status === "active" ? <ShieldX size={13} /> : <Check size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ id: member.id, name: member.name, email: member.email, role: member.role, password: "" })}
                      className="grid h-7 w-7 place-items-center  text-[#a3a3a3] hover:bg-[#f7f7f7] hover:text-[#525252]"
                      title="Edit teammate"
                    >
                      <KeyRound size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={self}
                      onClick={() => setDeleteTarget(member)}
                      className="grid h-7 w-7 place-items-center  text-[#a3a3a3] transition-colors hover:bg-[#f7f7f7] hover:text-ink disabled:opacity-30"
                      title="Remove teammate"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
            {data && members.length === 0 && <EmptyState icon={Users} title="No teammates" description="Add someone to share the workspace." action={<Button variant="primary" size="sm" icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add teammate</Button>} />}
          </div>
        </Card>

        <div className="space-y-4">
          {(Object.keys(ROLE_INFO) as Role[]).map((role) => (
            <Card key={role} className="p-4">
              <div className="flex items-center justify-between">
                <Badge className={ROLE_INFO[role].className}>{ROLE_INFO[role].label}</Badge>
                <span className="text-[10px] font-bold text-[#a3a3a3]">{members.filter((member) => member.role === role).length}</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{ROLE_INFO[role].description}</p>
            </Card>
          ))}
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.14em] text-[#525252] uppercase"><Mail size={11} /> Last sign-ins</p>
            <div className="mt-2 space-y-2">
              {members.filter((member) => member.lastLoginAt).slice(0, 4).map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2 text-[10.5px]">
                  <span className="truncate font-medium text-[#525252]">{member.name}</span>
                  <span className="shrink-0 text-[#a3a3a3]">{timeAgo(member.lastLoginAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit teammate" : "Add a teammate"}
        description={form?.id ? "Update their role, name or set a new password." : "They will sign in with this email and a password you set now."}
        size="md"
        footer={<><Button variant="secondary" size="sm" onClick={() => setForm(null)}>Cancel</Button><Button variant="primary" size="sm" loading={saving} icon={Check} onClick={save}>{form?.id ? "Save changes" : "Add teammate"}</Button></>}
      >
        {form && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ananya Mehta" /></Field>
            <Field label="Work email" required><Input type="email" value={form.email} disabled={Boolean(form.id)} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="ananya@venueonmyplate.in" /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </Select>
            </Field>
            <Field label={form.id ? "New password" : "Password"} hint={form.id ? "Leave blank to keep the current password." : "At least 10 characters."}>
              <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="••••••••••" autoComplete="new-password" />
            </Field>
            <p className="text-[10.5px] leading-relaxed text-muted sm:col-span-2">
              {form.id ? "Changing the password or suspending access signs the teammate out of every device." : `${ROLE_INFO[form.role].description} You can change this at any time.`}
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Remove this teammate?"
        description={deleteTarget ? `${deleteTarget.name} · ${deleteTarget.email}` : ""}
        loading={deleting}
      />
    </div>
  );
}
