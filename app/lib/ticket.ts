export type AppointmentResult = {
  ticketNumber: string;
  appointmentDateStr: string;
  peopleAhead: number;
};

// The appointment date and queue position are deliberately absurd — the point
// is to make the whole exercise of finding a date of birth feel pointless.
export function generateAppointment(stats: { elapsedMs: number; pages: number }): AppointmentResult {
  const ticketNumber = `BGA-${Math.floor(100000 + Math.random() * 900000)}`;

  const yearsAhead = 40 + Math.floor(Math.random() * 260);
  const appointmentDate = new Date();
  appointmentDate.setFullYear(appointmentDate.getFullYear() + yearsAhead);
  appointmentDate.setMonth(Math.floor(Math.random() * 12));
  appointmentDate.setDate(1 + Math.floor(Math.random() * 28));

  const basePeople = 50_000_000 + Math.floor(Math.random() * 450_000_000);
  const searchPenalty = stats.pages * 137_000 + Math.floor(stats.elapsedMs / 1000) * 4_200;
  const peopleAhead = basePeople + searchPenalty;

  return {
    ticketNumber,
    appointmentDateStr: appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    peopleAhead,
  };
}
