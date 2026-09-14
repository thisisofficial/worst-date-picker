export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : `0:${seconds.toString().padStart(2, "0")}`;
}

export function buildQuip(elapsedMs: number, pages: number): string {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const timePhrase =
    minutes > 0
      ? `${minutes} minute${minutes === 1 ? "" : "s"}${
          seconds ? ` and ${seconds} second${seconds === 1 ? "" : "s"}` : ""
        }`
      : `${seconds} second${seconds === 1 ? "" : "s"}`;
  const pagePhrase = `${pages} Wikipedia page${pages === 1 ? "" : "s"}`;

  let tone: string;
  if (minutes >= 5 || pages >= 20) {
    tone =
      "We've taken the liberty of not notifying your manager. This time.";
  } else if (minutes >= 2 || pages >= 10) {
    tone = "Thorough. Unnecessary, but thorough.";
  } else if (totalSeconds < 10 && pages <= 2) {
    tone = "Impressively fast — or you simply guessed. We'll note it as the former.";
  } else {
    tone = "Adequate. We've seen worse. We've also seen better.";
  }

  return `That took ${timePhrase} across ${pagePhrase}. ${tone}`;
}
