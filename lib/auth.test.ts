import { describe, it, expect, vi, beforeEach } from "vitest";

// translateError()는 export되지 않은 내부 함수라, 이를 사용하는 signUp/signIn을 통해
// 매핑/미매핑 케이스를 간접 검증한다. supabase 클라이언트는 env var 없이 만들면 throw하므로
// 모듈 전체를 모킹한다.
const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const insertMock = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
    },
    from: () => ({ insert: (...args: unknown[]) => insertMock(...args) }),
  },
}));

import { signUp, signIn } from "./auth";

describe("translateError (signUp/signIn을 통한 간접 검증)", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    signInWithPasswordMock.mockReset();
    insertMock.mockReset();
  });

  it("'already registered' 포함 → 이미 가입된 이메일 안내", async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: { message: "User already registered" } });
    const result = await signUp({ name: "a", email: "a@a.com", password: "123456" });
    expect(result.error).toBe("이미 가입된 이메일입니다.");
  });

  it("'Invalid login credentials' → 이메일/비밀번호 불일치 안내", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
    const result = await signIn("a@a.com", "wrong");
    expect(result.error).toBe("이메일 또는 비밀번호가 올바르지 않습니다.");
  });

  it("'Password should be at least 6 characters' → 비밀번호 길이 안내", async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: { message: "Password should be at least 6 characters" } });
    const result = await signUp({ name: "a", email: "a@a.com", password: "123" });
    expect(result.error).toBe("비밀번호는 6자 이상이어야 합니다.");
  });

  it("'Unable to validate email' 포함 → 이메일 형식 안내", async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: { message: "Unable to validate email address: invalid format" } });
    const result = await signUp({ name: "a", email: "bad", password: "123456" });
    expect(result.error).toBe("올바른 이메일 형식이 아닙니다.");
  });

  it("'Email not confirmed' → 이메일 인증 필요 안내", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: {}, error: { message: "Email not confirmed" } });
    const result = await signIn("a@a.com", "123456");
    expect(result.error).toBe("이메일 인증이 필요합니다.");
  });

  it("매핑되지 않은 메시지는 원본을 그대로 반환한다", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: {}, error: { message: "Some unknown supabase error" } });
    const result = await signIn("a@a.com", "123456");
    expect(result.error).toBe("Some unknown supabase error");
  });

  it("에러가 없으면 signUp은 user를 반환하고 profiles insert를 호출한다", async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    insertMock.mockResolvedValue({ error: null });
    const result = await signUp({ name: "a", email: "a@a.com", password: "123456" });
    expect(result.error).toBeNull();
    expect(result.user).toEqual({ id: "u1" });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", name: "a" }));
  });
});
