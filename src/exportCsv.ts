import { WorkLogEntry } from "./parser";

function escapeCsvValue(value: string): string {
	if (value.includes('"') || value.includes(",") || value.includes("\n")) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

export function entriesToCsv(entries: WorkLogEntry[]): string {
	const headers = ["id", "date", "project", "category", "hours", "tags", "note", "sourcePath"];
	const rows = entries.map((entry) => [
		entry.id,
		entry.date,
		entry.project,
		entry.category ?? "",
		entry.hours != null ? String(entry.hours) : "",
		entry.tags.join("; "),
		entry.note ?? "",
		entry.sourcePath
	]);

	return [headers, ...rows]
		.map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
		.join("\n");
}

function todayIso(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function defaultExportFileName(): string {
	return `work-ledger-export-${todayIso()}.csv`;
}
