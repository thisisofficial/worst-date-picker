"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { formatDate, type PickedDate } from "../lib/date";
import { buildQuip } from "../lib/timing";
import { generateAppointment, type AppointmentResult } from "../lib/ticket";

type Stats = { elapsedMs: number; pages: number };

const FIELDS = [
  "Email address",
  "Preferred department",
  "Reason for appointment",
  "First name",
  "Last name",
  "Date of birth",
];

export default function ConfirmationModal({
  dob,
  stats,
  onClose,
}: {
  dob: PickedDate;
  stats: Stats;
  onClose: () => void;
}) {
  const [entered, setEntered] = useState(false);
  const [phase, setPhase] = useState<"validating" | "done">("validating");
  const [fieldIndex, setFieldIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AppointmentResult | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Slowly "validates" one field at a time before revealing the result —
  // there's nothing to actually check, it's purely theatrical friction.
  useEffect(() => {
    if (phase !== "validating") return;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      setFieldIndex(step);
      setProgress(Math.min(100, Math.round((step / FIELDS.length) * 100)));
      if (step >= FIELDS.length) {
        clearInterval(id);
        setTimeout(() => {
          setResult(generateAppointment(stats));
          setPhase("done");
        }, 350);
      }
    }, 420);
    return () => clearInterval(id);
  }, [phase, stats]);

  useEffect(() => {
    if (phase !== "done") return;
    confetti({ particleCount: 140, spread: 85, origin: { y: 0.7 } });
    const t = setTimeout(
      () => confetti({ particleCount: 90, spread: 110, origin: { y: 0.6 } }),
      250
    );
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/50 transition-opacity duration-300 ease-out ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`w-full max-w-lg rounded-t-xl bg-white p-6 shadow-2xl transition-transform duration-400 ease-out ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {phase === "validating" ? (
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Validating your information…</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Checking: {FIELDS[Math.min(fieldIndex, FIELDS.length - 1)]}
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-900 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          result && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Appointment Confirmed
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900">You&apos;re on the list.</h2>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm text-zinc-700">
                <dt className="font-medium text-zinc-500">Ticket number</dt>
                <dd className="font-mono">{result.ticketNumber}</dd>
                <dt className="font-medium text-zinc-500">Appointment date</dt>
                <dd>{result.appointmentDateStr}</dd>
                <dt className="font-medium text-zinc-500">Position in queue</dt>
                <dd>{result.peopleAhead.toLocaleString("en-US")} people ahead of you</dd>
              </dl>
              <p className="mt-3 text-xs italic text-zinc-500">
                Date of birth on file: {formatDate(dob)}. {buildQuip(stats.elapsedMs, stats.pages)}
              </p>
              <button
                onClick={onClose}
                className="mt-5 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Done
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
