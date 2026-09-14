"use client";

import { useState } from "react";
import DatePickerModal from "./components/DatePickerModal";
import ConfirmationModal from "./components/ConfirmationModal";
import { formatDate, type PickedDate } from "./lib/date";

type Stats = { elapsedMs: number; pages: number };

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
  const [pickerOrigin, setPickerOrigin] = useState<{ x: number; y: number } | null>(null);
  const [dob, setDob] = useState<PickedDate | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
            setConfirmOpen(true);
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email address">
              <input type="email" required placeholder="jane.doe@example.com" className={inputClass} />
            </Field>
            <Field label="Phone number">
              <input type="tel" required placeholder="(555) 555-0100" className={inputClass} />
            </Field>
          </div>

          <Field label="Street address">
            <input type="text" required placeholder="123 Main St" className={inputClass} />
          </Field>

          <Field label="City">
            <input type="text" required className={inputClass} />
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

          <Field label="Emergency contact name">
            <input type="text" required className={inputClass} />
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
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setPickerOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                setPickerOpen(true);
              }}
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
        </form>
      </main>

      {pickerOpen && (
        <DatePickerModal
          origin={pickerOrigin}
          onClose={() => setPickerOpen(false)}
          onComplete={(d, s) => {
            setDob(d);
            setStats(s);
            setPickerOpen(false);
          }}
        />
      )}

      {confirmOpen && dob && stats && (
        <ConfirmationModal dob={dob} stats={stats} onClose={() => setConfirmOpen(false)} />
      )}
    </div>
  );
}
