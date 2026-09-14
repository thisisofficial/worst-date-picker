"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "../lib/timing";

type Stage = "day" | "month" | "year";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const STAGE_LABEL: Record<Stage, string> = {
  day: "Day",
  month: "Month",
  year: "Year",
};

const STAGE_ORDER: Stage[] = ["day", "month", "year"];

type PickedDate = { day: number; month: string; year: number };
type Stats = { elapsedMs: number; pages: number };
type RestartReason = "manual" | "invalid";

// Interprets a raw clicked token for day/month stages. Year is handled
// separately since it builds up digits across clicks instead of resolving in one go.
function interpretPick(stage: "day" | "month", raw: string): { valid: boolean; value: number | string } {
  if (stage === "day") {
    const n = Number(raw);
    return { valid: Number.isInteger(n) && n >= 1 && n <= 31, value: n };
  }
  if (MONTHS.includes(raw)) return { valid: true, value: raw };
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return { valid: true, value: MONTHS[n - 1] };
  return { valid: false, value: raw };
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isValidCalendarDate(day: number, month: string, year: number) {
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex === -1) return false;
  const max = monthIndex === 1 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[monthIndex];
  return day >= 1 && day <= max;
}

export default function DatePickerModal({
  onComplete,
  onClose,
}: {
  onComplete: (date: PickedDate, stats: Stats) => void;
  onClose: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [interstitial, setInterstitial] = useState(false);
  const [restartReason, setRestartReason] = useState<RestartReason>("manual");
  const [restartDetail, setRestartDetail] = useState<string | null>(null);
  const [continueCountdown, setContinueCountdown] = useState(0);
  const [stage, setStage] = useState<Stage>("day");
  const [picked, setPicked] = useState<{ day: number | null; month: string | null }>({
    day: null,
    month: null,
  });
  const [yearDigits, setYearDigits] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingResult, setPendingResult] = useState<PickedDate | null>(null);

  const [pageCount, setPageCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const yearDigitsRef = useRef<string[]>([]);
  const startTimeRef = useRef<number | null>(null);

  const iframeSrc = `/api/wiki?stage=${stage}&_r=${nonce}`;

  useEffect(() => {
    if (!started || confirmOpen) return;
    const id = setInterval(() => {
      if (startTimeRef.current !== null) setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [started, confirmOpen]);

  // Annoying-but-honest: the "continue" button on the restart notice stays
  // disabled for a few seconds so the notice can't just be reflexively dismissed.
  useEffect(() => {
    if (!interstitial) return;
    const id = setInterval(() => setContinueCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [interstitial]);

  const refreshPage = useCallback(() => setNonce((n) => n + 1), []);

  const advanceStage = useCallback((current: Stage) => {
    const idx = STAGE_ORDER.indexOf(current);
    if (idx === STAGE_ORDER.length - 1) return;
    setStage(STAGE_ORDER[idx + 1]);
    setNonce((n) => n + 1);
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2200);
  };

  // Clears the in-progress day/month/year and drops the user onto the restart
  // notice. Time and page-count are deliberately left untouched — they're a
  // running tally of the whole session, not just the current attempt.
  const goToRestart = useCallback((reason: RestartReason, detail: string | null) => {
    setRestartReason(reason);
    setRestartDetail(detail);
    setContinueCountdown(4);
    setStage("day");
    setPicked({ day: null, month: null });
    yearDigitsRef.current = [];
    setYearDigits([]);
    setConfirmOpen(false);
    setPendingResult(null);
    setFlash(null);
    setStarted(false);
    setInterstitial(true);
  }, []);

  useEffect(() => {
    function handler(e: MessageEvent) {
      const data = e.data;
      if (!data || data.type !== "dp-select" || data.stage !== stage) return;
      const raw = String(data.value);

      if (stage === "year") {
        const digitsOfRaw = raw.replace(/\D/g, "");
        if (!digitsOfRaw) return;
        const remaining = 4 - yearDigitsRef.current.length;
        if (remaining <= 0) return;
        // Grab every digit of whatever was clicked, up to however many slots
        // are left — click a full 4-digit year and it fills in one go.
        const digitsToAdd = digitsOfRaw.slice(0, remaining).split("");
        const next = [...yearDigitsRef.current, ...digitsToAdd];
        yearDigitsRef.current = next;
        setYearDigits(next);

        if (next.length >= 4) {
          const year = Number(next.slice(0, 4).join(""));
          const day = picked.day as number;
          const month = picked.month as string;
          if (!isValidCalendarDate(day, month, year)) {
            goToRestart("invalid", `${month} ${day}, ${year}`);
          } else {
            setPendingResult({ day, month, year });
            setConfirmOpen(true);
          }
        } else {
          refreshPage();
        }
        return;
      }

      const result = interpretPick(stage, raw);
      if (!result.valid) {
        showFlash(`"${raw}" isn't a valid ${STAGE_LABEL[stage].toLowerCase()}. Keep looking.`);
        return;
      }
      setPicked((prev) => ({ ...prev, [stage]: result.value }));
      advanceStage(stage);
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [stage, advanceStage, refreshPage, picked.day, picked.month, goToRestart]);

  function beginSearch() {
    setStarted(true);
    setInterstitial(false);
    setStage("day");
    setPicked({ day: null, month: null });
    yearDigitsRef.current = [];
    setYearDigits([]);
    setConfirmOpen(false);
    setPendingResult(null);
    setFlash(null);
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      setElapsedMs(0);
    }
    setNonce((n) => n + 1);
  }

  function acceptResult() {
    if (!pendingResult || startTimeRef.current === null) return;
    onComplete(pendingResult, { elapsedMs: Date.now() - startTimeRef.current, pages: pageCount });
  }

  function rejectResult() {
    goToRestart("manual", pendingResult ? `${pendingResult.month} ${pendingResult.day}, ${pendingResult.year}` : null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        {interstitial ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-zinc-50 p-8 text-center">
            <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-6 py-7 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Notice · Ref {(elapsedMs % 100000).toString().padStart(5, "0")}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-900">
                {restartReason === "invalid" ? "That Date Doesn't Exist" : "Restarting Your Search"}
              </h2>
              <p className="mt-3 text-sm text-zinc-600">
                {restartReason === "invalid"
                  ? `The date you assembled${restartDetail ? ` (${restartDetail})` : ""} does not appear on any calendar, past or present. Your day and month have been cleared.`
                  : `You indicated the selected date${restartDetail ? ` (${restartDetail})` : ""} needs to be changed. Per procedure, your day, month, and year selections have been cleared.`}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                Your elapsed time and page count are not affected by this reset and will continue
                accumulating for the remainder of your session, as they are considered a permanent
                record of this attempt.
              </p>
              <button
                onClick={beginSearch}
                disabled={continueCountdown > 0}
                className="mt-5 w-full rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {continueCountdown > 0 ? `Please wait (${continueCountdown})` : "Continue"}
              </button>
            </div>
          </div>
        ) : !started ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
            <h2 className="text-2xl font-bold text-zinc-900">How to pick your date</h2>
            <ol className="max-w-md list-decimal space-y-2 pl-5 text-left text-zinc-700">
              <li>
                You&apos;ll be shown a random Wikipedia article. Highlighted{" "}
                <span className="rounded bg-yellow-200 px-1 font-semibold">yellow values</span> are
                clickable for the current step — day, then month, then year.
              </li>
              <li>
                Every other link on the page is a real Wikipedia link. You can click it and browse to
                a completely different article — you&apos;re not stuck on this one.
              </li>
              <li>Your progress carries over no matter how far you wander, so explore freely.</li>
              <li>We&apos;re timing you, and counting every page you visit. Just so you know.</li>
            </ol>
            <button
              onClick={beginSearch}
              className="mt-2 rounded-full bg-zinc-900 px-6 py-2.5 font-medium text-white hover:bg-zinc-700"
            >
              Start with the day
            </button>
            <button onClick={onClose} className="text-sm text-zinc-500 underline">
              Cancel
            </button>
          </div>
        ) : confirmOpen && pendingResult ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            <h2 className="text-xl font-semibold text-zinc-900">Confirm Your Date</h2>
            <p className="max-w-sm text-zinc-700">
              You have arrived at{" "}
              <span className="font-semibold">
                {pendingResult.month} {pendingResult.day}, {pendingResult.year}
              </span>
              . Please confirm this is not an incorrect date, unless it is, in which case please do
              not confirm it.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={rejectResult}
                className="rounded-md bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-500"
              >
                No, restart
              </button>
              <button
                onClick={acceptResult}
                className="rounded-md bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-500"
              >
                Yes, confirm
              </button>
            </div>
            <p className="text-xs text-zinc-400">Choose carefully.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="flex items-center gap-2">
                {STAGE_ORDER.map((s) => (
                  <span
                    key={s}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      s === stage
                        ? "bg-yellow-300 text-zinc-900"
                        : (s === "day" && picked.day !== null) || (s === "month" && picked.month !== null)
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                  >
                    {STAGE_LABEL[s]}
                    {s === "day" && picked.day !== null ? `: ${picked.day}` : ""}
                    {s === "month" && picked.month !== null ? `: ${picked.month}` : ""}
                    {s === "year"
                      ? `: ${yearDigits.concat(["_", "_", "_", "_"]).slice(0, 4).join("")}`
                      : ""}
                  </span>
                ))}
              </div>
              <p className="flex-1 text-xs text-zinc-500">
                Click a highlighted <span className="font-semibold text-zinc-700">{STAGE_LABEL[stage]}</span>{" "}
                value to select it. Any other link takes you to a different Wikipedia page — feel free
                to wander.
              </p>
              <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600">
                {formatDuration(elapsedMs)} · {pageCount} page{pageCount === 1 ? "" : "s"}
              </span>
              <button
                onClick={refreshPage}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100"
              >
                New random page
              </button>
              <button
                onClick={onClose}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            {flash && (
              <div className="bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-700">
                {flash}
              </div>
            )}

            <iframe
              ref={iframeRef}
              key={iframeSrc}
              src={iframeSrc}
              className="flex-1 border-0"
              title="Wikipedia date picker"
              onLoad={() => setPageCount((c) => c + 1)}
            />
          </>
        )}
      </div>
    </div>
  );
}
