import { AppError } from "./domain";

// Only deliberate application exceptions may carry a database-authored message.
// Constraint, parser and infrastructure errors can contain schema names or values.
export function dbError(error: { code?: string; message: string }): never {
  switch (error.code) {
    case "PT429":
      throw new AppError(
        "Terlalu banyak request. Coba kembali sebentar lagi.",
        429,
      );
    case "P0001":
      throw new AppError(error.message, 400);
    case "42501":
      throw new AppError("Akses tidak diizinkan.", 403);
    case "40001":
    case "40P01":
      throw new AppError(
        "Data berubah. Muat ulang sebelum mencoba kembali.",
        409,
      );
    case "23505":
      throw new AppError(
        "Data sudah ada. Muat ulang sebelum mencoba kembali.",
        409,
      );
    case "23503":
    case "23514":
    case "23502":
    case "22P02":
    case "22007":
    case "22008":
      throw new AppError(
        "Data tidak valid atau referensi tidak tersedia.",
        400,
      );
    case "57014":
    case "53300":
      throw new AppError("Layanan sedang sibuk. Coba kembali.", 503);
    default:
      throw new AppError("Permintaan database gagal. Coba kembali.", 500);
  }
}
