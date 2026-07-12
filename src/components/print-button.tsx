"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
    >
      🖨 พิมพ์
    </button>
  );
}
