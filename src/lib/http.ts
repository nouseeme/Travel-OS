import { NextResponse } from "next/server";
import { AppError } from "./domain";
import { ZodError } from "zod";
export function originCheck(request: Request) {
  const expected = new URL(process.env.APP_URL || request.url).origin;
  const incoming = request.headers.get("origin");
  if (!incoming || incoming !== expected)
    throw new AppError("Origin request tidak diizinkan.", 403);
}
export function failure(error: unknown) {
  const known = error instanceof AppError;
  return NextResponse.json(
    {
      error: known
        ? error.message
        : error instanceof ZodError
          ? "Input tidak valid."
          : "Permintaan gagal. Coba kembali.",
    },
    {
      status: known ? error.status : error instanceof ZodError ? 400 : 500,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 512000)
    throw new AppError("Payload terlalu besar.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Body wajib.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512000) {
      await reader.cancel();
      throw new AppError("Payload terlalu besar.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("JSON tidak valid.", 400);
  }
}
