import { CachedMetadata, TFile } from "obsidian";
import { WorkLedgerSettings } from "./settings";

export interface WorkLogEntry {
	id: string;
	date: string;
	project: string;
	category?: string;
	hours?: number;
	tags: string[];
	note?: string;
	sourcePath: string;
}

function toDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseDate(input: unknown): string | null {
	if (typeof input !== "string" || !input.trim()) {
		return null;
	}

	const parsed = new Date(input.trim());
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return toDateString(parsed);
}

function parseDateFromFilename(baseName: string): string | null {
	const ymdDash = baseName.match(/(20\d{2}|19\d{2})-(\d{2})-(\d{2})/);
	if (ymdDash) {
		return parseDate(`${ymdDash[1]}-${ymdDash[2]}-${ymdDash[3]}`);
	}

	const ymdUnderscore = baseName.match(/(20\d{2}|19\d{2})_(\d{2})_(\d{2})/);
	if (ymdUnderscore) {
		return parseDate(`${ymdUnderscore[1]}-${ymdUnderscore[2]}-${ymdUnderscore[3]}`);
	}

	const mdyDash = baseName.match(/(\d{2})-(\d{2})-(20\d{2}|19\d{2})/);
	if (mdyDash) {
		return parseDate(`${mdyDash[3]}-${mdyDash[1]}-${mdyDash[2]}`);
	}

	return null;
}

function normalizeTagValue(tag: string): string | null {
	const normalized = tag.trim().replace(/^['"]/, "").replace(/['"]$/, "");
	return normalized ? normalized : null;
}

export function parseTags(raw: string): string[] {
	const trimmed = raw.trim();
	if (!trimmed) {
		return [];
	}

	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		const inner = trimmed.slice(1, -1);
		return inner
			.split(",")
			.map(normalizeTagValue)
			.filter((tag): tag is string => Boolean(tag));
	}

	return trimmed
		.split(",")
		.map(normalizeTagValue)
		.filter((tag): tag is string => Boolean(tag));
}

function roundHours(value: number, increment: number): number {
	if (!Number.isFinite(value)) {
		return value;
	}
	if (!Number.isFinite(increment) || increment <= 0) {
		return value;
	}
	return Math.round(value / increment) * increment;
}

function parseBlockFields(block: string): Record<string, string> {
	const fields: Record<string, string> = {};
	const lines = block.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const kv = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
		if (!kv) {
			continue;
		}

		const key = kv[1].toLowerCase();
		const value = kv[2].trim();
		fields[key] = value;
	}

	return fields;
}

function inferDate(
	fields: Record<string, string>,
	file: TFile,
	metadata: CachedMetadata | null,
	settings: WorkLedgerSettings
): string {
	const explicit = parseDate(fields.date);
	if (explicit) {
		return explicit;
	}

	if (!settings.enableDateInference) {
		return toDateString(new Date());
	}

	const frontmatterDate = parseDate(metadata?.frontmatter?.date) ?? parseDate(metadata?.frontmatter?.created);
	if (frontmatterDate) {
		return frontmatterDate;
	}

	const fromFilename = parseDateFromFilename(file.basename);
	if (fromFilename) {
		return fromFilename;
	}

	const modifiedDate = new Date(file.stat.mtime);
	if (!Number.isNaN(modifiedDate.getTime())) {
		return toDateString(modifiedDate);
	}

	return toDateString(new Date());
}

export function parseWorkLogEntriesFromFile(
	file: TFile,
	content: string,
	metadata: CachedMetadata | null,
	settings: WorkLedgerSettings
): WorkLogEntry[] {
	const entries: WorkLogEntry[] = [];
	const blockRegex = /```work-log\s*\n([\s\S]*?)```/g;

	for (const match of content.matchAll(blockRegex)) {
		const blockContent = match[1] ?? "";
		const position = match.index ?? 0;
		const fields = parseBlockFields(blockContent);
		const project = fields.project?.trim();

		if (!project) {
			continue;
		}

		const candidateCategory = fields.category?.trim();
		const allowedCategory =
			candidateCategory && (settings.allowCustomCategories || settings.categories.includes(candidateCategory))
				? candidateCategory
				: undefined;

		const parsedHours = fields.hours ? Number(fields.hours) : undefined;
		const hours =
			typeof parsedHours === "number" && Number.isFinite(parsedHours)
				? roundHours(parsedHours, settings.hourRoundingIncrement)
				: undefined;

		entries.push({
			id: `${file.path}:${position}`,
			date: inferDate(fields, file, metadata, settings),
			project,
			category: allowedCategory,
			hours,
			tags: parseTags(fields.tags ?? ""),
			note: fields.note || undefined,
			sourcePath: file.path
		});
	}

	return entries;
}

/*
Example parsing checks:
- tags: [scd, manuscript] => ["scd", "manuscript"]
- tags: scd, manuscript => ["scd", "manuscript"]
- date inference order:
  block date > frontmatter date/created > filename date > mtime > today
*/
