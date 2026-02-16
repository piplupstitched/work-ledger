import { WorkLogEntry } from "./parser";

export interface DateRange {
	start: string;
	end: string;
}

export interface LedgerSummary {
	entryCount: number;
	totalHours: number;
	hoursByCategory: Map<string, number>;
	hoursByProject: Map<string, number>;
}

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function parseEntryDate(dateText: string): Date | null {
	const parsed = new Date(dateText);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatHours(hours: number): string {
	return Number(hours.toFixed(2)).toString();
}

export function filterEntriesByRange(entries: WorkLogEntry[], range: DateRange): WorkLogEntry[] {
	return entries.filter((entry) => entry.date >= range.start && entry.date <= range.end);
}

export function summarizeEntries(entries: WorkLogEntry[]): LedgerSummary {
	const hoursByCategory = new Map<string, number>();
	const hoursByProject = new Map<string, number>();
	let totalHours = 0;

	for (const entry of entries) {
		const hours = entry.hours ?? 0;
		totalHours += hours;

		const category = entry.category?.trim() || "Uncategorized";
		hoursByCategory.set(category, (hoursByCategory.get(category) ?? 0) + hours);

		const project = entry.project.trim();
		hoursByProject.set(project, (hoursByProject.get(project) ?? 0) + hours);
	}

	return {
		entryCount: entries.length,
		totalHours,
		hoursByCategory,
		hoursByProject
	};
}

export function getCurrentWeekRange(referenceDate = new Date()): DateRange {
	const date = new Date(referenceDate);
	const day = date.getDay();
	const distanceToMonday = day === 0 ? -6 : 1 - day;
	const start = new Date(date);
	start.setDate(date.getDate() + distanceToMonday);
	const end = new Date(start);
	end.setDate(start.getDate() + 6);

	return {
		start: formatDate(start),
		end: formatDate(end)
	};
}

export function getCurrentQuarterRange(referenceDate = new Date()): DateRange {
	const date = new Date(referenceDate);
	const quarter = Math.floor(date.getMonth() / 3);
	const start = new Date(date.getFullYear(), quarter * 3, 1);
	const end = new Date(date.getFullYear(), quarter * 3 + 3, 0);

	return {
		start: formatDate(start),
		end: formatDate(end)
	};
}

function mapToMarkdownRows(map: Map<string, number>): string[] {
	return [...map.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([label, value]) => `- ${label}: ${formatHours(value)}h`);
}

export function buildSummaryMarkdown(title: string, entries: WorkLogEntry[], range: DateRange): string {
	const filtered = filterEntriesByRange(entries, range);
	const summary = summarizeEntries(filtered);
	const lines: string[] = [];

	lines.push(`## ${title}`);
	lines.push(`- Range: ${range.start} to ${range.end}`);
	lines.push(`- Entries: ${summary.entryCount}`);
	lines.push(`- Total hours: ${formatHours(summary.totalHours)}h`);
	lines.push("");

	lines.push("### Hours by category");
	if (summary.hoursByCategory.size === 0) {
		lines.push("- None");
	} else {
		lines.push(...mapToMarkdownRows(summary.hoursByCategory));
	}
	lines.push("");

	lines.push("### Hours by project");
	if (summary.hoursByProject.size === 0) {
		lines.push("- None");
	} else {
		lines.push(...mapToMarkdownRows(summary.hoursByProject));
	}
	lines.push("");

	lines.push("### Entries");
	if (filtered.length === 0) {
		lines.push("- No work-log entries found in this range.");
	} else {
		for (const entry of filtered.sort((a, b) => (a.date < b.date ? 1 : -1))) {
			const hours = entry.hours != null ? ` (${formatHours(entry.hours)}h)` : "";
			const category = entry.category ? ` [${entry.category}]` : "";
			const note = entry.note ? ` - ${entry.note}` : "";
			lines.push(`- ${entry.date} - ${entry.project}${category}${hours}${note}`);
		}
	}

	return lines.join("\n");
}

export function quarterLabel(range: DateRange): string {
	const startDate = parseEntryDate(range.start);
	if (!startDate) {
		return `Quarter (${range.start} to ${range.end})`;
	}
	const quarter = Math.floor(startDate.getMonth() / 3) + 1;
	return `Quarter ${quarter} ${startDate.getFullYear()}`;
}
