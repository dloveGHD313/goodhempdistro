"use client";
import { useEffect, useState } from "react";

function setCookie(name: string, value: string, days: number) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "; expires=" + date.toUTCString();
  document.cookie = name + "=" + value + expires + "; path=/";
}

function hasCookie(name: string): boolean {
  return document.cookie.split(";").some(c => c.trim().startsWith(name + "="));
}

export default function AgeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const ts = localStorage.getItem("ghd_age_verified_ts");
      const cookieOk = hasCookie("ghd_age_verified");
      const now = Date.now();
      const valid = ts ? now - Number(ts) < 30 * 24 * 60 * 60 * 1000 : false;
      if (!valid || !cookieOk) {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  async function handleEnter() {
    try {
      localStorage.setItem("ghd_age_verified_ts", String(Date.now()));
      setCookie("ghd_age_verified", "true", 30);
      // Attempt to persist on profile if logged in
      await fetch("/api/age/verify", { method: "POST" }).catch(() => {});
      setShow(false);
    } catch {
      setShow(false);
    }
  }

  function handleExit() {
    window.location.assign("https://google.com");
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="card max-w-md w-full p-6 text-white">
        <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--accent-green)" }}>You must be 21+ to enter.</h2>
        <p className="text-gray-300 mb-6">By entering, you confirm you are 21 years of age or older.</p>
        <div className="flex gap-3">
          <button onClick={handleEnter} className="btn-primary">I'm 21+ / Enter</button>
          <button onClick={handleExit} className="btn-cta">Exit</button>
        </div>
      </div>
    </div>
  );
}
