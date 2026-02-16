import { ItemView, WorkspaceLeaf } from "obsidian";
import { WorkLogEntry } from "../parser";
import { DateRange, filterEntriesByRange, formatHours, getCurrentQuarterRange, getCurrentWeekRange, summarizeEntries } from "../summarizer";
import WorkLedgerPlugin from "../main";

export const WORK_LEDGER_SUMMARY_VIEW_TYPE = "work-ledger-summary-view";
type RangePreset = "this-week" | "last-week" | "this-month" | "this-quarter" | "all" | "custom";

export class WorkLedgerSummaryView extends ItemView {
	private plugin: WorkLedgerPlugin;
	private activePreset: RangePreset = "this-week";
	private customStart: string | null = null;
	private customEnd: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: WorkLedgerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return WORK_LEDGER_SUMMARY_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Work ledger";
	}

	getIcon(): string {
		return "bar-chart-3";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("work-ledger-view");

		const header = contentEl.createDiv({ cls: "work-ledger-header" });
		header.createEl("h2", { text: "Work ledger summary" });
		const refreshButton = header.createEl("button", { text: "Refresh" });
		refreshButton.addClass("mod-cta");
		refreshButton.onclick = () => {
			void this.refresh();
		};

		const entries = await this.plugin.getEntries();
		this.renderRangeControls(contentEl, entries);
		this.renderSummary(contentEl, entries);
	}

	private renderSummary(container: HTMLElement, entries: WorkLogEntry[]): void {
		const range = this.getSelectedRange(entries);
		const filteredEntries = range ? filterEntriesByRange(entries, range) : entries;
		const summary = summarizeEntries(filteredEntries);

		const statList = container.createEl("ul", { cls: "work-ledger-summary-list" });
		const rangeLabel = range ? `${range.start} to ${range.end}` : "All dates";
		statList.createEl("li", { text: `Range: ${rangeLabel}` });
		statList.createEl("li", { text: `Entries: ${summary.entryCount}` });
		statList.createEl("li", { text: `Total hours: ${formatHours(summary.totalHours)}h` });

		container.createEl("h3", { text: "Hours by category" });
		if (summary.hoursByCategory.size === 0) {
			container.createEl("p", { text: "No category data." });
		} else {
			const list = container.createEl("ul", { cls: "work-ledger-summary-list" });
			for (const [category, hours] of [...summary.hoursByCategory.entries()].sort((a, b) => b[1] - a[1])) {
				list.createEl("li", { text: `${category}: ${formatHours(hours)}h` });
			}
		}

		container.createEl("h3", { text: "Hours by project" });
		if (summary.hoursByProject.size === 0) {
			container.createEl("p", { text: "No project data." });
		} else {
			const list = container.createEl("ul", { cls: "work-ledger-summary-list" });
			for (const [project, hours] of [...summary.hoursByProject.entries()].sort((a, b) => b[1] - a[1])) {
				list.createEl("li", { text: `${project}: ${formatHours(hours)}h` });
			}
		}

		container.createEl("h3", { text: "Most recent entries" });
		const recent = [...filteredEntries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
		if (recent.length === 0) {
			container.createEl("p", { text: "No work-log blocks found in vault." });
		} else {
			const list = container.createEl("ul", { cls: "work-ledger-summary-list" });
			for (const entry of recent) {
				const category = entry.category ? ` [${entry.category}]` : "";
				const hours = entry.hours != null ? ` (${formatHours(entry.hours)}h)` : "";
				const note = entry.note ? ` - ${entry.note}` : "";
				const item = list.createEl("li");
				const open = item.createEl("button", {
					text: `${entry.date} - ${entry.project}${category}${hours}${note}`
				});
				open.addClass("work-ledger-entry-link");
				open.onclick = () => {
					void this.plugin.openEntrySource(entry);
				};
			}
		}
	}

	private renderRangeControls(container: HTMLElement, entries: WorkLogEntry[]): void {
		const controls = container.createDiv({ cls: "work-ledger-range-controls" });
		const presets: Array<{ id: RangePreset; label: string }> = [
			{ id: "this-week", label: "This week" },
			{ id: "last-week", label: "Last week" },
			{ id: "this-month", label: "This month" },
			{ id: "this-quarter", label: "This quarter" },
			{ id: "all", label: "All" },
			{ id: "custom", label: "Custom" }
		];

		const chipRow = controls.createDiv({ cls: "work-ledger-chip-row" });
		for (const preset of presets) {
			const chip = chipRow.createEl("button", { text: preset.label });
			chip.addClass("work-ledger-chip");
			if (this.activePreset === preset.id) {
				chip.addClass("is-active");
			}
			chip.onclick = () => {
				this.activePreset = preset.id;
				if (preset.id === "custom" && entries.length > 0 && (!this.customStart || !this.customEnd)) {
					const oldest = entries[entries.length - 1]?.date ?? entries[0].date;
					const newest = entries[0].date;
					this.customStart = oldest;
					this.customEnd = newest;
				}
				void this.refresh();
			};
		}

		if (this.activePreset === "custom") {
			const row = controls.createDiv({ cls: "work-ledger-custom-range-row" });
			row.createEl("label", { text: "Start" });
			const startInput = row.createEl("input");
			startInput.type = "date";
			startInput.value = this.customStart ?? "";
			startInput.onchange = () => {
				this.customStart = startInput.value || null;
				void this.refresh();
			};

			row.createEl("label", { text: "End" });
			const endInput = row.createEl("input");
			endInput.type = "date";
			endInput.value = this.customEnd ?? "";
			endInput.onchange = () => {
				this.customEnd = endInput.value || null;
				void this.refresh();
			};
		}
	}

	private getSelectedRange(entries: WorkLogEntry[]): DateRange | null {
		const now = new Date();
		switch (this.activePreset) {
			case "this-week":
				return getCurrentWeekRange(now);
			case "last-week": {
				const previous = new Date(now);
				previous.setDate(previous.getDate() - 7);
				return getCurrentWeekRange(previous);
			}
			case "this-month":
				return {
					start: this.formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
					end: this.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
				};
			case "this-quarter":
				return getCurrentQuarterRange(now);
			case "custom":
				if (this.customStart && this.customEnd) {
					return { start: this.customStart, end: this.customEnd };
				}
				return null;
			case "all":
			default:
				if (entries.length === 0) {
					return null;
				}
				return {
					start: entries[entries.length - 1].date,
					end: entries[0].date
				};
		}
	}

	private formatDate(date: Date): string {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
			2,
			"0"
		)}`;
	}
}
