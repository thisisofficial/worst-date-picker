"use client";

import { useState } from "react";
import DatePickerModal from "./components/DatePickerModal";
import { buildQuip } from "./lib/timing";
import { generateAppointment, type AppointmentResult } from "./lib/ticket";

type PickedDate = { day: number; month: string; year: number };
type Stats = { elapsedMs: number; pages: number };

function formatDate(d: PickedDate) {
  return `${d.month} ${d.day}, ${d.year}`;
}

const DEPARTMENTS = [
  "General Inquiries",
  "Records Request",
  "Permit Renewal",
  "Miscellaneous Affairs",
  "Undetermined",
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500";

export default function Home() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dob, setDob] = useState<PickedDate | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [result, setResult] = useState<AppointmentResult | null>(null);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 font-sans">
      <main className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Bureau of General Appointments
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Appointment Request Form</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Please complete every field below. All fields are required.
        </p>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dob || !stats) return;
            setResult(generateAppointment(stats));
          }}
        >
          <Field label="Email address">
            <input type="email" required placeholder="jane.doe@example.com" className={inputClass} />
          </Field>

          <Field label="Preferred department">
            <select required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Select a department
              </option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reason for appointment">
            <textarea
              required
              rows={3}
              placeholder="Briefly describe your reason for this appointment"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input type="text" required placeholder="Jane" className={inputClass} />
            </Field>
            <Field label="Last name">
              <input type="text" required placeholder="Doe" className={inputClass} />
            </Field>
          </div>

          <Field label="Date of birth">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-left text-sm text-zinc-900 hover:border-zinc-400"
            >
              {dob ? formatDate(dob) : "Click to select a date"}
            </button>
          </Field>

          <button
            type="submit"
            disabled={!dob}
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Request appointment
          </button>

          {result && dob && stats && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">Your appointment has been scheduled.</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-emerald-800">
                <dt className="font-medium">Ticket number</dt>
                <dd className="font-mono">{result.ticketNumber}</dd>
                <dt className="font-medium">Appointment date</dt>
                <dd>{result.appointmentDateStr}</dd>
                <dt className="font-medium">Position in queue</dt>
                <dd>{result.peopleAhead.toLocaleString("en-US")} people ahead of you</dd>
              </dl>
              <p className="mt-3 text-xs italic text-emerald-700">
                Date of birth on file: {formatDate(dob)}. {buildQuip(stats.elapsedMs, stats.pages)}
              </p>
            </div>
          )}
        </form>
      </main>

      {pickerOpen && (
        <DatePickerModal
          onClose={() => setPickerOpen(false)}
          onComplete={(d, s) => {
            setDob(d);
            setStats(s);
            setResult(null);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
