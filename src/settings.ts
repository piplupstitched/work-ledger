import { PluginSettingTab, Setting, App } from "obsidian";

export interface WorkLedgerSettings {
	categories: string[];
	allowCustomCategories: boolean;
	hourRoundingIncrement: number;
	enableDateInference: boolean;
}

export const DEFAULT_SETTINGS: WorkLedgerSettings = {
	categories: ["Meetings", "Research/Analysis", "Data Requests", "Admin"],
	allowCustomCategories: true,
	hourRoundingIncrement: 0.25,
	enableDateInference: true
};

export function parseCategoryList(input: string): string[] {
	return input
		.split(/[\n,]/)
		.map((category) => category.trim())
		.filter(Boolean);
}

interface WorkLedgerSettingsHost {
	settings: WorkLedgerSettings;
	saveSettings(): Promise<void>;
}

export class WorkLedgerSettingTab extends PluginSettingTab {
	private plugin: WorkLedgerSettingsHost;

	constructor(app: App, plugin: WorkLedgerSettingsHost) {
		super(app, plugin as never);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Work ledger settings").setHeading();

		new Setting(containerEl)
			.setName("Category list")
			.setDesc("Comma or newline separated categories used in summaries.")
			.addTextArea((text) => {
				text
					.setPlaceholder("Meetings, Research/Analysis, Data Requests, Admin")
					.setValue(this.plugin.settings.categories.join(", "))
					.onChange((value) => {
						void (async () => {
							const parsed = parseCategoryList(value);
							this.plugin.settings.categories = parsed.length > 0 ? parsed : DEFAULT_SETTINGS.categories;
							await this.plugin.saveSettings();
						})().catch(() => {});
					});
				text.inputEl.rows = 4;
			});

		new Setting(containerEl)
			.setName("Allow custom categories")
			.setDesc("If disabled, categories not in the list are ignored.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.allowCustomCategories).onChange((value) => {
					void (async () => {
						this.plugin.settings.allowCustomCategories = value;
						await this.plugin.saveSettings();
					})().catch(() => {});
				})
			);

		new Setting(containerEl)
			.setName("Hour rounding increment")
			.setDesc("Round parsed hours to quarter, half, or whole hour.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("0.25", "0.25")
					.addOption("0.5", "0.5")
					.addOption("1", "1.0")
					.setValue(String(this.plugin.settings.hourRoundingIncrement))
					.onChange((value) => {
						void (async () => {
							this.plugin.settings.hourRoundingIncrement = Number(value);
							await this.plugin.saveSettings();
						})().catch(() => {});
					})
			);

		new Setting(containerEl)
			.setName("Enable date inference")
			.setDesc("Infer date from note frontmatter, filename, or file modified time.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enableDateInference).onChange((value) => {
					void (async () => {
						this.plugin.settings.enableDateInference = value;
						await this.plugin.saveSettings();
					})().catch(() => {});
				})
			);
	}
}
