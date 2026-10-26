"use client";
import { useState, useEffect } from "react";
import {
  Plane,
  ArrowRight,
  ShieldCheck,
  MapPin,
  ArrowUpRight,
  CircleHelp,
  Check,
} from "lucide-react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { ProductBrand, CompanyIdentity } from "./brand";
import { PlatformFooter } from "./platform-credit";
export function Auth({ passwordMode = false }: { passwordMode?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [recover, setRecover] = useState(false),
    [emailRecovery, setEmailRecovery] = useState(false),
    [configured, setConfigured] = useState(true);
  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured);
        setEmailRecovery(d.emailRecovery);
      });
    const e = new URLSearchParams(location.search).get("error");
    if (e) setError(e);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordMode && password !== confirm) {
      setError("Password confirmation tidak cocok.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const generation =
        new URLSearchParams(location.search).get("generation") || undefined;
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: passwordMode ? "password" : recover ? "recover" : "login",
          email: email || undefined,
          password: recover ? undefined : password,
          generation,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (recover) setMessage(d.message);
      else {
        router.replace("/home");
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page-frame">
      <div className="auth-layout">
        <section className="auth-story">
          <a href="/login" className="brand">
            <ProductBrand />
          </a>
          <CompanyIdentity large />
          <div className="story-main">
            <h1>
              Perjalanan hebat <br />
              dimulai dari <br />
              <em>tim yang selaras.</em>
            </h1>
            <p>
              Dari percakapan pertama hingga perjalanan selesai. Kelola setiap
              detail, bersama.
            </p>
            <div className="route-art">
              <div className="route-dot">
                <MapPin size={18} />
              </div>
              <div className="route-line" />
              <Plane size={26} />
              <div className="route-line" />
              <div className="route-dot">
                <Check size={16} />
              </div>
            </div>
          </div>
          <small>SALES · TRIPS · TASKS · FINANCE</small>
        </section>
        <section className="auth-form">
          <div className="auth-form-inner">
            <h2>
              {passwordMode
                ? "Buat password Anda"
                : recover
                  ? "Pulihkan akses"
                  : "Selamat datang kembali."}
            </h2>
            <p>
              {passwordMode
                ? "Selesaikan aktivasi akun untuk bergabung dengan tim."
                : recover
                  ? emailRecovery
                    ? "Kami akan mengirim link ke email yang terdaftar."
                    : "Pemulihan email belum diaktifkan. Hubungi admin workspace."
                  : "Masuk dan lanjutkan perjalanan tim Anda."}
            </p>
            {!configured && (
              <div className="notice">
                Supabase belum terhubung. Lengkapi konfigurasi proyek dan
                bootstrap admin sesuai README untuk menggunakan aplikasi.
              </div>
            )}
            <form onSubmit={submit}>
              {!passwordMode && (
                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.com"
                    autoComplete="email"
                  />
                </label>
              )}
              {!recover && (
                <label>
                  {passwordMode ? "Password baru" : "Password"}
                  <input
                    required
                    type="password"
                    minLength={passwordMode ? 12 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 12 karakter"
                    autoComplete={
                      passwordMode ? "new-password" : "current-password"
                    }
                  />
                </label>
              )}
              {passwordMode && (
                <label>
                  Konfirmasi password
                  <input
                    required
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              )}
              {error && (
                <div role="alert" className="error-box">
                  {error}
                </div>
              )}
              {message && (
                <div role="status" className="notice">
                  {message}
                </div>
              )}
              <Button
                disabled={busy || !configured || (recover && !emailRecovery)}
                className="full"
              >
                {busy
                  ? "Memproses…"
                  : passwordMode
                    ? "Aktifkan akun"
                    : recover
                      ? "Kirim link recovery"
                      : "Masuk ke workspace"}
                <ArrowRight size={16} />
              </Button>
            </form>
            {!passwordMode && (
              <button
                className="text-button"
                onClick={() => {
                  setRecover(!recover);
                  setError("");
                  setMessage("");
                }}
              >
                {recover ? "Kembali ke login" : "Lupa password?"}
                <ArrowUpRight size={14} />
              </button>
            )}
            <div className="auth-foot">
              Akses melalui invitation. Hubungi admin tim Anda untuk bergabung.
              <PlatformFooter />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
