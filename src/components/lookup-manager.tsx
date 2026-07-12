"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; name: string; active: boolean };

export default function LookupManager({
  table,
  title,
  nameField,
  items,
}: {
  table: "purposes" | "fd13_codes" | "categories";
  title: string;
  nameField: "name" | "code";
  items: Item[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => PromiseLike<{ error: { message: string; code?: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error } = await action();
    if (error) {
      setError(
        error.code === "23505"
          ? "มีชื่อนี้อยู่แล้ว"
          : error.code === "23503"
            ? "ลบไม่ได้: มีข้อมูลใช้รายการนี้อยู่ (ใช้ปิดการใช้งานแทน)"
            : error.message
      );
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = newName.trim();
    if (!value) return;
    const payload: Record<string, string> =
      nameField === "name" ? { name: value } : { code: value };
    await run(() => supabase.from(table).insert(payload));
    setNewName("");
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>

      <ul className="mb-3 divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-2">
            {editing === item.id ? (
              <form
                className="flex flex-1 gap-1.5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const value = editValue.trim();
                  const payload: Record<string, string> =
                    nameField === "name" ? { name: value } : { code: value };
                  await run(() =>
                    supabase.from(table).update(payload).eq("id", item.id)
                  );
                  setEditing(null);
                }}
              >
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-teal-700 px-2.5 py-1 text-xs text-white"
                >
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-500"
                >
                  ✕
                </button>
              </form>
            ) : (
              <>
                <span
                  className={`flex-1 text-sm ${
                    item.active ? "text-slate-700" : "text-slate-400 line-through"
                  }`}
                >
                  {item.name}
                </span>
                <button
                  onClick={() => {
                    setEditing(item.id);
                    setEditValue(item.name);
                  }}
                  className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  แก้ไข
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      supabase
                        .from(table)
                        .update({ active: !item.active })
                        .eq("id", item.id)
                    )
                  }
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    item.active
                      ? "text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                      : "text-emerald-600 hover:bg-emerald-50"
                  }`}
                >
                  {item.active ? "ปิดใช้" : "เปิดใช้"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(`ลบ "${item.name}" ?`)) return;
                    run(() => supabase.from(table).delete().eq("id", item.id));
                  }}
                  className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  ลบ
                </button>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-400">
            ยังไม่มีรายการ
          </li>
        )}
      </ul>

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={add} className="flex gap-1.5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="เพิ่มรายการใหม่..."
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          เพิ่ม
        </button>
      </form>
    </div>
  );
}
