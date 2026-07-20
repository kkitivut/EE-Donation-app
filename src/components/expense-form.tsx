"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThaiDateInput from "@/components/thai-date-input";
import MoneyInput from "@/components/money-input";
import { formatMoney, formatThaiDate } from "@/lib/format";
import {
  allocationSumMatches,
  findOverAllocated,
  suggestAllocationAmount,
} from "@/lib/allocation";
import { orIlikeFilter } from "@/lib/search";
import { toUserMessage } from "@/lib/error-message";
import { isSafeHttpUrl } from "@/lib/safe-url";
import type { Expense } from "@/lib/types";

type ExpenseWithAllocations = Expense & {
  expense_allocations: {
    id: string;
    amount: number;
    donation_id: string;
    donations: { id: string; receipt_no: string; donor_name: string };
  }[];
};

type AllocationDraft = {
  donation_id: string;
  receipt_no: string;
  donor_name: string;
  available: number; // ยอดที่ตัดได้สูงสุดจากใบนี้
  amount: string;
};

type SearchResult = {
  id: string;
  receipt_no: string;
  donor_name: string;
  receipt_date: string;
  purpose_name: string | null;
  balance: number;
};

export default function ExpenseFormButton({
  expense,
}: {
  expense?: ExpenseWithAllocations;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!expense;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          isEdit
            ? "rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
            : "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        }
      >
        {isEdit ? "แก้ไข" : "+ เพิ่มรายจ่าย"}
      </button>
      {open && <ExpenseModal expense={expense} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExpenseModal({
  expense,
  onClose,
}: {
  expense?: ExpenseWithAllocations;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!expense;

  const [form, setForm] = useState({
    doc_no: expense?.doc_no ?? "",
    paid_date: expense?.paid_date ?? "",
    description: expense?.description ?? "",
    total_amount: expense?.total_amount ? String(expense.total_amount) : "",
    drive_url: expense?.drive_url ?? "",
    note: expense?.note ?? "",
  });

  const [allocations, setAllocations] = useState<AllocationDraft[]>(
    (expense?.expense_allocations ?? []).map((a) => ({
      donation_id: a.donation_id,
      receipt_no: a.donations.receipt_no,
      donor_name: a.donations.donor_name,
      available: Number.MAX_SAFE_INTEGER, // เติมจริงตอนค้นหา; ใบเดิมให้ DB ตรวจ
      amount: String(a.amount),
    }))
  );

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function runSearch(q: string) {
    setSearch(q);
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data: donations } = await supabase
      .from("donations")
      .select("id, receipt_no, donor_name, receipt_date, purposes(name)")
      .or(orIlikeFilter(["donor_name", "receipt_no"], term))
      .order("receipt_date", { ascending: false })
      .limit(20);

    const list = donations ?? [];
    if (list.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }

    const { data: balances } = await supabase
      .from("donation_balances")
      .select("*")
      .in(
        "donation_id",
        list.map((d) => d.id)
      );
    const balMap = new Map(
      (balances ?? []).map((b) => [b.donation_id, Number(b.balance)])
    );

    // ในโหมดแก้ไข ยอดที่ตัดจากใบเดิมอยู่แล้วต้องบวกกลับเป็น "ตัดได้"
    const own = new Map(
      (expense?.expense_allocations ?? []).map((a) => [
        a.donation_id,
        Number(a.amount),
      ])
    );

    setResults(
      list
        .map((d) => ({
          id: d.id,
          receipt_no: d.receipt_no,
          donor_name: d.donor_name,
          receipt_date: d.receipt_date,
          purpose_name:
            (d.purposes as unknown as { name: string } | null)?.name ?? null,
          balance: (balMap.get(d.id) ?? 0) + (own.get(d.id) ?? 0),
        }))
        .filter((d) => d.balance > 0)
    );
    setSearching(false);
  }

  function addAllocation(r: SearchResult) {
    if (allocations.some((a) => a.donation_id === r.id)) return;
    const totalNeeded = Number(form.total_amount) || 0;
    const allocated = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const suggested = suggestAllocationAmount(totalNeeded, allocated, r.balance);
    setAllocations((list) => [
      ...list,
      {
        donation_id: r.id,
        receipt_no: r.receipt_no,
        donor_name: r.donor_name,
        available: r.balance,
        amount: suggested > 0 ? String(suggested) : "",
      },
    ]);
    setSearch("");
    setResults([]);
  }

  function removeAllocation(donationId: string) {
    setAllocations((list) => list.filter((a) => a.donation_id !== donationId));
  }

  function setAllocationAmount(donationId: string, value: string) {
    setAllocations((list) =>
      list.map((a) =>
        a.donation_id === donationId ? { ...a, amount: value } : a
      )
    );
  }

  const totalAmount = Number(form.total_amount) || 0;
  const allocatedSum = allocations.reduce(
    (s, a) => s + (Number(a.amount) || 0),
    0
  );
  const sumMatches = allocationSumMatches(allocatedSum, totalAmount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (allocations.length === 0) {
      setError("ต้องเลือกใบเสร็จที่จะตัดเงินอย่างน้อย 1 ใบ");
      return;
    }
    if (!sumMatches) {
      setError(
        `ผลรวมการตัดเงิน (${formatMoney(allocatedSum)}) ไม่เท่ากับยอดจ่าย (${formatMoney(totalAmount)})`
      );
      return;
    }
    const over = findOverAllocated(
      allocations.map((a) => ({ ...a, amount: Number(a.amount) || 0 }))
    );
    if (over) {
      setError(
        `ใบเสร็จ ${over.receipt_no} มียอดให้ตัดได้เพียง ${formatMoney(over.available)} บาท`
      );
      return;
    }

    const driveUrl = form.drive_url.trim();
    if (driveUrl && !isSafeHttpUrl(driveUrl)) {
      setError("ลิงก์เอกสารแนบต้องขึ้นต้นด้วย http:// หรือ https:// เท่านั้น");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("save_expense", {
      p_expense_id: expense?.id ?? null,
      p_doc_no: form.doc_no.trim() || null,
      p_paid_date: form.paid_date,
      p_description: form.description.trim(),
      p_total_amount: totalAmount,
      p_drive_url: driveUrl || null,
      p_note: form.note.trim() || null,
      p_allocations: allocations.map((a) => ({
        donation_id: a.donation_id,
        amount: Number(a.amount),
      })),
    });

    if (error) {
      setError(toUserMessage(error));
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    if (!expense) return;
    if (
      !confirm(
        `ลบรายจ่าย "${expense.description}" ?\nยอดที่ตัดไว้จะถูกคืนกลับให้ใบเสร็จ`
      )
    )
      return;
    setSaving(true);
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id);
    if (error) {
      setError(toUserMessage(error));
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-4 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? "แก้ไขรายจ่าย" : "เพิ่มรายจ่าย"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>รายการ *</label>
              <input
                required
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="เช่น ทุนการศึกษา เดือนมิถุนายน 2569"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>วันที่จ่ายเงิน *</label>
              <ThaiDateInput
                required
                value={form.paid_date}
                onChange={(v) => set("paid_date", v)}
              />
            </div>
            <div>
              <label className={labelCls}>ยอดจ่ายรวม (บาท) *</label>
              <MoneyInput
                required
                value={form.total_amount}
                onChange={(v) => set("total_amount", v)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>เลขที่ส่งออก</label>
              <input
                value={form.doc_no}
                onChange={(e) => set("doc_no", e.target.value)}
                placeholder="เช่น ท.13/69"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>ลิงก์เอกสารแนบ (Google Drive)</label>
              <input
                type="url"
                value={form.drive_url}
                onChange={(e) => set("drive_url", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* เลือกใบเสร็จที่จะตัดเงิน */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">
              ตัดเงินจากใบเสร็จ *
            </p>

            {allocations.length > 0 && (
              <div className="mb-3 space-y-2">
                {allocations.map((a) => (
                  <div
                    key={a.donation_id}
                    className="flex items-center gap-2 rounded-lg bg-white p-2.5 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {a.receipt_no}
                        <span className="ml-2 font-normal text-slate-500">
                          {a.donor_name}
                        </span>
                      </p>
                      {a.available !== Number.MAX_SAFE_INTEGER && (
                        <p className="text-xs text-slate-400">
                          ตัดได้สูงสุด {formatMoney(a.available)} บาท
                        </p>
                      )}
                    </div>
                    <MoneyInput
                      required
                      value={a.amount}
                      onChange={(v) => setAllocationAmount(a.donation_id, v)}
                      className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => removeAllocation(a.donation_id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="เอาออก"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <p
                  className={`text-right text-sm font-medium ${
                    sumMatches ? "text-emerald-700" : "text-amber-600"
                  }`}
                >
                  รวมตัดเงิน {formatMoney(allocatedSum)} / ยอดจ่าย{" "}
                  {formatMoney(totalAmount)} บาท{" "}
                  {sumMatches ? "✓" : `(ต่างกัน ${formatMoney(Math.abs(totalAmount - allocatedSum))})`}
                </p>
              </div>
            )}

            <input
              value={search}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="ค้นหาใบเสร็จ — พิมพ์เลขที่ใบเสร็จ หรือชื่อผู้บริจาค (เฉพาะใบที่มียอดคงเหลือ)"
              className={inputCls}
            />
            {searching && (
              <p className="mt-2 text-xs text-slate-400">กำลังค้นหา...</p>
            )}
            {results.length > 0 && (
              <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {results.map((r) => {
                  const already = allocations.some(
                    (a) => a.donation_id === r.id
                  );
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => addAllocation(r)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-teal-50 disabled:opacity-40"
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-slate-700">
                            {r.receipt_no}
                          </span>
                          <span className="ml-2 text-slate-500">
                            {r.donor_name}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {formatThaiDate(r.receipt_date)}
                            {r.purpose_name ? ` · ${r.purpose_name}` : ""}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-right text-emerald-700">
                          คงเหลือ {formatMoney(r.balance)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {search.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="mt-2 text-xs text-slate-400">
                ไม่พบใบเสร็จที่มียอดคงเหลือตรงกับ &quot;{search}&quot;
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>หมายเหตุ</label>
            <textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                ลบรายจ่ายนี้
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving || !sumMatches || allocations.length === 0}
                className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
