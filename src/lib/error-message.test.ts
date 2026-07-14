import { describe, expect, it, vi } from "vitest";
import { toUserMessage } from "@/lib/error-message";

describe("toUserMessage", () => {
  it("แสดงข้อความต่อเมื่อเป็น P0001 (raise_exception จาก RPC ของแอปเอง)", () => {
    const err = { code: "P0001", message: "ผลรวมการตัดเงินไม่เท่ากับยอดจ่าย" };
    expect(toUserMessage(err)).toBe("ผลรวมการตัดเงินไม่เท่ากับยอดจ่าย");
  });

  it("แทนด้วยข้อความ generic เมื่อเป็น error อื่น (กัน info leak)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "donations_receipt_no_key"',
    };
    expect(toUserMessage(err)).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    spy.mockRestore();
  });

  it("log raw error ไว้ debug เมื่อ genericize", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = { code: "42703", message: 'column "foo" does not exist' };
    toUserMessage(err);
    expect(spy).toHaveBeenCalledWith("[db-error]", err);
    spy.mockRestore();
  });

  it("คืน fallback เมื่อ error เป็น null/undefined", () => {
    expect(toUserMessage(null)).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    expect(toUserMessage(undefined)).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  });

  it("ใช้ fallback ที่กำหนดเองได้", () => {
    expect(toUserMessage(null, "โหลดข้อมูลไม่สำเร็จ")).toBe("โหลดข้อมูลไม่สำเร็จ");
  });

  it("ใช้ fallback เมื่อ P0001 แต่ไม่มี message", () => {
    expect(toUserMessage({ code: "P0001" })).toBe(
      "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    );
  });
});
