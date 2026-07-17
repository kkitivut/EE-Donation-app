import { describe, expect, it } from "vitest";
import { isSafeHttpUrl } from "@/lib/safe-url";

describe("isSafeHttpUrl", () => {
  it("อนุญาต http และ https", () => {
    expect(isSafeHttpUrl("https://drive.google.com/file/d/abc")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
  });

  it("ปฏิเสธ javascript: (stored XSS)", () => {
    expect(isSafeHttpUrl("javascript:alert(document.cookie)")).toBe(false);
    expect(isSafeHttpUrl("JavaScript:alert(1)")).toBe(false);
  });

  it("ปฏิเสธ data: และ scheme อื่น", () => {
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("ปฏิเสธ relative / ผิดรูปแบบ / ว่าง", () => {
    expect(isSafeHttpUrl("/local/path")).toBe(false);
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
  });
});
