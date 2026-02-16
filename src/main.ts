import { MarkdownView, Notice, Plugin, TFile, normalizePath } from "obsidian";
import { defaultExportFileName, entriesToCsv } from "./exportCsv";
import { parseWorkLogEntriesFromFile, WorkLogEntry } from "./parser";
import {
	buildSummaryMarkdown,
	getCurrentQuarterRange,
	getCurrentWeekRange,
	quarterLabel
} from "./summarizer";
import { DEFAULT_SETTINGS, WorkLedgerSettingTab, WorkLedgerSettings } from "./settings";
import { WorkLedgerSummaryView, WORK_LEDGER_SUMMARY_VIEW_TYPE } from "./ui/summaryView";

export default class WorkLedgerPlugin extends Plugin {
	settings: WorkLedgerSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			WORK_LEDGER_SUMMARY_VIEW_TYPE,
			(leaf) => new WorkLedgerSummaryView(leaf, this)
		);

		this.addRibbonIcon("bar-chart-3", "Open work ledger summary", () => {
			void this.activateSummaryView();
		});

		this.addSettingTab(new WorkLedgerSettingTab(this.app, this));

		this.addCommand({
			id: "work-ledger-open-summary",
			name: "Open summary",
			callback: () => {
				void this.activateSummaryView();
			}
		});

		this.addCommand({
			id: "work-ledger-export-csv",
			name: "Export csv",
			callback: () => {
				void (async () => {
					const entries = await this.collectEntriesAcrossVault();
					await this.exportCsv(entries);
				})().catch(() => {});
			}
		});

		this.addCommand({
			id: "work-ledger-generate-weekly-summary",
			name: "Generate weekly summary",
			editorCallback: (editor) => {
				void (async () => {
					const entries = await this.collectEntriesAcrossVault();
					const range = getCurrentWeekRange();
					const markdown = buildSummaryMarkdown("Weekly work summary", entries, range);
					editor.replaceSelection(`${markdown}\n`);
				})().catch(() => {});
			}
		});

		this.addCommand({
			id: "work-ledger-generate-quarterly-summary",
			name: "Generate quarterly summary",
			editorCallback: (editor) => {
				void (async () => {
					const entries = await this.collectEntriesAcrossVault();
					const range = getCurrentQuarterRange();
					const title = `${quarterLabel(range)} work summary`;
					const markdown = buildSummaryMarkdown(title, entries, range);
					editor.replaceSelection(`${markdown}\n`);
				})().catch(() => {});
			}
		});

		this.addCommand({
			id: "work-ledger-insert-work-log-template",
			name: "Insert work log template",
			editorCallback: (editor) => {
				editor.replaceSelection(this.buildWorkLogTemplate());
			}
		});

		this.registerEvent(this.app.vault.on("modify", () => this.refreshSummaryViews()));
		this.registerEvent(this.app.vault.on("create", () => this.refreshSummaryViews()));
		this.registerEvent(this.app.vault.on("delete", () => this.refreshSummaryViews()));
		this.registerEvent(this.app.vault.on("rename", () => this.refreshSummaryViews()));
	}

	onunload(): void {
		// Preserve user-arranged leaf placement across plugin reloads.
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	public async getEntries(): Promise<WorkLogEntry[]> {
		return this.collectEntriesAcrossVault();
	}

	public async openEntrySource(entry: WorkLogEntry): Promise<void> {
		const abstractFile = this.app.vault.getAbstractFileByPath(entry.sourcePath);
		if (!(abstractFile instanceof TFile)) {
			new Notice(`Source note not found: ${entry.sourcePath}`);
			return;
		}

		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(abstractFile);

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = view?.editor;
		if (!editor) {
			return;
		}

		const offset = this.getOffsetFromEntryId(entry.id);
		if (offset == null || offset < 0) {
			return;
		}

		const position = editor.offsetToPos(offset);
		editor.setCursor(position);
		editor.scrollIntoView({ from: position, to: position }, true);
	}

	private async collectEntriesAcrossVault(): Promise<WorkLogEntry[]> {
		const files = this.app.vault.getMarkdownFiles();
		const allEntries: WorkLogEntry[] = [];

		for (const file of files) {
			const content = await this.app.vault.cachedRead(file);
			const metadata = this.app.metadataCache.getFileCache(file);
			const fileEntries = parseWorkLogEntriesFromFile(file, content, metadata, this.settings);
			allEntries.push(...fileEntries);
		}

		return allEntries.sort((a, b) => {
			if (a.date === b.date) {
				return a.id.localeCompare(b.id);
			}
			return a.date < b.date ? 1 : -1;
		});
	}

	private async exportCsv(entries: WorkLogEntry[]): Promise<void> {
		const csv = entriesToCsv(entries);
		const targetPath = await this.getAvailableExportPath(defaultExportFileName());
		await this.app.vault.create(targetPath, csv);
		new Notice(`Work Ledger exported ${entries.length} entries to ${targetPath}`);
	}

	private async getAvailableExportPath(initialPath: string): Promise<string> {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(initialPath))) {
			return initialPath;
		}

		const stamp = Date.now();
		const dotIndex = initialPath.lastIndexOf(".");
		if (dotIndex === -1) {
			return normalizePath(`${initialPath}-${stamp}`);
		}

		const base = initialPath.slice(0, dotIndex);
		const ext = initialPath.slice(dotIndex);
		return normalizePath(`${base}-${stamp}${ext}`);
	}

	private async activateSummaryView(): Promise<void> {
		const existingLeaf = this.app.workspace.getLeavesOfType(WORK_LEDGER_SUMMARY_VIEW_TYPE)[0];
		const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice("Unable to open Work Ledger view.");
			return;
		}

		await leaf.setViewState({
			type: WORK_LEDGER_SUMMARY_VIEW_TYPE,
			active: true
		});
		this.app.workspace.revealLeaf(leaf);
	}

	private refreshSummaryViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(WORK_LEDGER_SUMMARY_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof WorkLedgerSummaryView) {
				void view.refresh();
			}
		}
	}

	private getOffsetFromEntryId(entryId: string): number | null {
		const separator = entryId.lastIndexOf(":");
		if (separator === -1) {
			return null;
		}

		const offsetText = entryId.slice(separator + 1);
		const offset = Number(offsetText);
		return Number.isFinite(offset) ? offset : null;
	}

	private buildWorkLogTemplate(): string {
		const today = new Date();
		const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
			today.getDate()
		).padStart(2, "0")}`;

		return [
			"```work-log",
			"project: ",
			"category: ",
			"hours: ",
			"tags: []",
			"note: ",
			`date: ${date}`,
			"```",
			""
		].join("\n");
	}
}
