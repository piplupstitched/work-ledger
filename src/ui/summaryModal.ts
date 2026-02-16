import { App, Modal } from "obsidian";
import { WorkLogEntry } from "../parser";
import { formatHours, summarizeEntries } from "../summarizer";

export class SummaryModal extends Modal {
	private entries: WorkLogEntry[];

	constructor(app: App, entries: WorkLogEntry[]) {
		super(app);
		this.entries = entries;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Work ledger summary" });
		const summary = summarizeEntries(this.entries);

		const statList = contentEl.createEl("ul");
		statList.createEl("li", { text: `Entries: ${summary.entryCount}` });
		statList.createEl("li", { text: `Total hours: ${formatHours(summary.totalHours)}h` });

		contentEl.createEl("h3", { text: "Hours by category" });
		if (summary.hoursByCategory.size === 0) {
			contentEl.createEl("p", { text: "No category data." });
		} else {
			const list = contentEl.createEl("ul");
			for (const [category, hours] of [...summary.hoursByCategory.entries()].sort((a, b) => b[1] - a[1])) {
				list.createEl("li", { text: `${category}: ${formatHours(hours)}h` });
			}
		}

		contentEl.createEl("h3", { text: "Hours by project" });
		if (summary.hoursByProject.size === 0) {
			contentEl.createEl("p", { text: "No project data." });
		} else {
			const list = contentEl.createEl("ul");
			for (const [project, hours] of [...summary.hoursByProject.entries()].sort((a, b) => b[1] - a[1])) {
				list.createEl("li", { text: `${project}: ${formatHours(hours)}h` });
			}
		}

		contentEl.createEl("h3", { text: "Most recent entries" });
		const recent = [...this.entries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
		if (recent.length === 0) {
			contentEl.createEl("p", { text: "No work-log blocks found in vault." });
		} else {
			const list = contentEl.createEl("ul");
			for (const entry of recent) {
				const category = entry.category ? ` [${entry.category}]` : "";
				const hours = entry.hours != null ? ` (${formatHours(entry.hours)}h)` : "";
				list.createEl("li", { text: `${entry.date} - ${entry.project}${category}${hours}` });
			}
		}
	}
}
