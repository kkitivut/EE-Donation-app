"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThaiDateInput from "@/components/thai-date-input";
import MoneyInput from "@/components/money-input";
import { isSafeHttpUrl } from "@/lib/safe-url";
import type { Category, Donation, Fd13Code, Purpose } from "@/lib/types";

type Props = {
  purposes: Purpose[];
  categories: Category[];
  fd13Codes: Fd13Code[];
  donation?: Donation; // มีค่า = โหมดแก้ไข
};

export default function DonationFormButton(props: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = !!props.donation;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          isEdit
            ? "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            : "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        }
      >
        {isEdit ? "แก้ไข" : "+ เพิ่มใบเสร็จบริจาค"}
      </button>
      {open && <DonationModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function DonationModal({
  purposes,
  categories,
  fd13Codes,
  donation,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!donation;

  const [form, setForm] = useState({
    receipt_no: donation?.receipt_no ?? "",
    donor_name: donation?.donor_name ?? "",
    amount: donation?.amount ? String(donation.amount) : "",
    receipt_date: donation?.receipt_date ?? "",
    donated_date: donation?.donated_date ?? "",
    purpose_id: donation?.purpose_id ?? "",
    fd13_id: donation?.fd13_id ?? "",
    channel: donation?.channel ?? "โอนเงิน",
    account: donation?.account ?? "",
    category_id: donation?.category_id ?? "",
    drive_url: donation?.drive_url ?? "",
    note: donation?.note ?? "",
  });
  const [donorSuggestions, setDonorSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function searchDonors(q: string) {
    set("donor_name", q);
    if (q.length < 2) return;
    const { data } = await supabase
      .from("donations")
      .select("donor_name")
      .ilike("donor_name", `%${q}%`)
      .limit(10);
    setDonorSuggestions([...new Set((data ?? []).map((d) => d.donor_name))]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const driveUrl = form.drive_url.trim();
    if (driveUrl && !isSafeHttpUrl(driveUrl)) {
      setError("ลิงก์เอกสารแนบต้องขึ้นต้นด้วย http:// หรือ https:// เท่านั้น");
      setSaving(false);
      return;
    }

    const payload = {
      receipt_no: form.receipt_no.trim(),
      donor_name: form.donor_name.trim(),
      amount: Number(form.amount),
      receipt_date: form.receipt_date,
      donated_date: form.donated_date || null,
      purpose_id: form.purpose_id || null,
      fd13_id: form.fd13_id || null,
      channel: form.channel.trim() || null,
      account: form.account.trim() || null,
      category_id: form.category_id || null,
      drive_url: driveUrl || null,
      note: form.note.trim() || null,
    };

    const { error } = isEdit
      ? await supabase.from("donations").update(payload).eq("id", donation!.id)
      : await supabase.from("donations").insert(payload);

    if (error) {
      setError(
        error.code === "23505"
          ? `เลขที่ใบเสร็จ ${payload.receipt_no} มีอยู่ในระบบแล้ว`
          : error.message
      );
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    if (!donation) return;
    if (
      !confirm(
        `ลบใบเสร็จ ${donation.receipt_no} ?\n(ลบได้เฉพาะใบที่ยังไม่มีการตัดรายจ่าย)`
      )
    )
      return;
    setSaving(true);
    const { error } = await supabase
      .from("donations")
      .delete()
      .eq("id", donation.id);
    if (error) {
      setError(
        error.code === "23503"
          ? "ลบไม่ได้: ใบเสร็จนี้มีรายจ่ายตัดเงินอยู่ ต้องลบรายจ่ายก่อน"
          : error.message
      );
      setSaving(false);
      return;
    }
    router.push("/donations");
    router.refresh();
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-4 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? `แก้ไขใบเสร็จ ${donation!.receipt_no}` : "เพิ่มใบเสร็จบริจาค"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>เลขที่ใบเสร็จ *</label>
            <input
              required
              value={form.receipt_no}
              onChange={(e) => set("receipt_no", e.target.value)}
              placeholder="เช่น RC1055845"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>จำนวนเงิน (บาท) *</label>
            <MoneyInput
              required
              value={form.amount}
              onChange={(v) => set("amount", v)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ชื่อ-นามสกุล ผู้บริจาค *</label>
            <input
              required
              value={form.donor_name}
              onChange={(e) => searchDonors(e.target.value)}
              list="donor-suggestions"
              className={inputCls}
            />
            <datalist id="donor-suggestions">
              {donorSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>วันที่ในใบเสร็จ *</label>
            <ThaiDateInput
              required
              value={form.receipt_date}
              onChange={(v) => set("receipt_date", v)}
            />
          </div>
          <div>
            <label className={labelCls}>วันที่บริจาค (โอนเงิน)</label>
            <ThaiDateInput
              value={form.donated_date}
              onChange={(v) => set("donated_date", v)}
            />
          </div>
          <div>
            <label className={labelCls}>วัตถุประสงค์ในการบริจาค</label>
            <select
              value={form.purpose_id}
              onChange={(e) => set("purpose_id", e.target.value)}
              className={inputCls}
            >
              <option value="">— ไม่ระบุ —</option>
              {purposes
                .filter((p) => p.active || p.id === form.purpose_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>รหัส FD13</label>
            <select
              value={form.fd13_id}
              onChange={(e) => set("fd13_id", e.target.value)}
              className={inputCls}
            >
              <option value="">— ไม่ระบุ —</option>
              {fd13Codes
                .filter((c) => c.active || c.id === form.fd13_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>ช่องทางบริจาค</label>
            <input
              value={form.channel}
              onChange={(e) => set("channel", e.target.value)}
              list="channel-suggestions"
              className={inputCls}
            />
            <datalist id="channel-suggestions">
              <option value="โอนเงิน" />
              <option value="เงินสด" />
              <option value="เช็ค" />
            </datalist>
          </div>
          <div>
            <label className={labelCls}>ข้อมูลบัญชี</label>
            <input
              value={form.account}
              onChange={(e) => set("account", e.target.value)}
              list="account-suggestions"
              className={inputCls}
            />
            <datalist id="account-suggestions">
              <option value="EDONATION" />
              <option value="กสิกรไทย" />
              <option value="ไทยพาณิชย์" />
              <option value="กรุงไทย" />
            </datalist>
          </div>
          <div>
            <label className={labelCls}>หมวดหมู่</label>
            <select
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
              className={inputCls}
            >
              <option value="">— ไม่ระบุ —</option>
              {categories
                .filter((c) => c.active || c.id === form.category_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ลิงก์เอกสารแนบ (Google Drive)</label>
            <input
              type="url"
              value={form.drive_url}
              onChange={(e) => set("drive_url", e.target.value)}
              placeholder="https://drive.google.com/..."
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>หมายเหตุ</label>
            <textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                ลบใบเสร็จนี้
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
                disabled={saving}
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
