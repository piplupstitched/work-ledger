var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WorkLedgerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/exportCsv.ts
function escapeCsvValue(value) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
function entriesToCsv(entries) {
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
  return [headers, ...rows].map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")).join("\n");
}
function todayIso() {
  const now = /* @__PURE__ */ new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function defaultExportFileName() {
  return `work-ledger-export-${todayIso()}.csv`;
}

// src/parser.ts
function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseDate(input) {
  if (typeof input !== "string" || !input.trim()) {
    return null;
  }
  const parsed = new Date(input.trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toDateString(parsed);
}
function parseDateFromFilename(baseName) {
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
function normalizeTagValue(tag) {
  const normalized = tag.trim().replace(/^['"]/, "").replace(/['"]$/, "");
  return normalized ? normalized : null;
}
function parseTags(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);
    return inner.split(",").map(normalizeTagValue).filter((tag) => Boolean(tag));
  }
  return trimmed.split(",").map(normalizeTagValue).filter((tag) => Boolean(tag));
}
function roundHours(value, increment) {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (!Number.isFinite(increment) || increment <= 0) {
    return value;
  }
  return Math.round(value / increment) * increment;
}
function parseBlockFields(block) {
  const fields = {};
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
function inferDate(fields, file, metadata, settings) {
  const explicit = parseDate(fields.date);
  if (explicit) {
    return explicit;
  }
  if (!settings.enableDateInference) {
    return toDateString(/* @__PURE__ */ new Date());
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
  return toDateString(/* @__PURE__ */ new Date());
}
function parseWorkLogEntriesFromFile(file, content, metadata, settings) {
  const entries = [];
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
    const allowedCategory = candidateCategory && (settings.allowCustomCategories || settings.categories.includes(candidateCategory)) ? candidateCategory : void 0;
    const parsedHours = fields.hours ? Number(fields.hours) : void 0;
    const hours = typeof parsedHours === "number" && Number.isFinite(parsedHours) ? roundHours(parsedHours, settings.hourRoundingIncrement) : void 0;
    entries.push({
      id: `${file.path}:${position}`,
      date: inferDate(fields, file, metadata, settings),
      project,
      category: allowedCategory,
      hours,
      tags: parseTags(fields.tags ?? ""),
      note: fields.note || void 0,
      sourcePath: file.path
    });
  }
  return entries;
}

// src/summarizer.ts
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseEntryDate(dateText) {
  const parsed = new Date(dateText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatHours(hours) {
  return Number(hours.toFixed(2)).toString();
}
function filterEntriesByRange(entries, range) {
  return entries.filter((entry) => entry.date >= range.start && entry.date <= range.end);
}
function summarizeEntries(entries) {
  const hoursByCategory = /* @__PURE__ */ new Map();
  const hoursByProject = /* @__PURE__ */ new Map();
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
function getCurrentWeekRange(referenceDate = /* @__PURE__ */ new Date()) {
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
function getCurrentQuarterRange(referenceDate = /* @__PURE__ */ new Date()) {
  const date = new Date(referenceDate);
  const quarter = Math.floor(date.getMonth() / 3);
  const start = new Date(date.getFullYear(), quarter * 3, 1);
  const end = new Date(date.getFullYear(), quarter * 3 + 3, 0);
  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}
function mapToMarkdownRows(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => `- ${label}: ${formatHours(value)}h`);
}
function buildSummaryMarkdown(title, entries, range) {
  const filtered = filterEntriesByRange(entries, range);
  const summary = summarizeEntries(filtered);
  const lines = [];
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
    for (const entry of filtered.sort((a, b) => a.date < b.date ? 1 : -1)) {
      const hours = entry.hours != null ? ` (${formatHours(entry.hours)}h)` : "";
      const category = entry.category ? ` [${entry.category}]` : "";
      const note = entry.note ? ` - ${entry.note}` : "";
      lines.push(`- ${entry.date} - ${entry.project}${category}${hours}${note}`);
    }
  }
  return lines.join("\n");
}
function quarterLabel(range) {
  const startDate = parseEntryDate(range.start);
  if (!startDate) {
    return `Quarter (${range.start} to ${range.end})`;
  }
  const quarter = Math.floor(startDate.getMonth() / 3) + 1;
  return `Quarter ${quarter} ${startDate.getFullYear()}`;
}

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  categories: ["Meetings", "Research/Analysis", "Data Requests", "Admin"],
  allowCustomCategories: true,
  hourRoundingIncrement: 0.25,
  enableDateInference: true
};
function parseCategoryList(input) {
  return input.split(/[\n,]/).map((category) => category.trim()).filter(Boolean);
}
var WorkLedgerSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Work ledger options").setHeading();
    new import_obsidian.Setting(containerEl).setName("Category list").setDesc("Comma or newline separated categories used in summaries.").addTextArea((text) => {
      text.setPlaceholder("Meetings, Research/Analysis, Data Requests, Admin").setValue(this.plugin.settings.categories.join(", ")).onChange((value) => {
        void (async () => {
          const parsed = parseCategoryList(value);
          this.plugin.settings.categories = parsed.length > 0 ? parsed : DEFAULT_SETTINGS.categories;
          await this.plugin.saveSettings();
        })().catch(() => {
        });
      });
      text.inputEl.rows = 4;
    });
    new import_obsidian.Setting(containerEl).setName("Allow custom categories").setDesc("If disabled, categories not in the list are ignored.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.allowCustomCategories).onChange((value) => {
        void (async () => {
          this.plugin.settings.allowCustomCategories = value;
          await this.plugin.saveSettings();
        })().catch(() => {
        });
      })
    );
    new import_obsidian.Setting(containerEl).setName("Hour rounding increment").setDesc("Round parsed hours to quarter, half, or whole hour.").addDropdown(
      (dropdown) => dropdown.addOption("0.25", "0.25").addOption("0.5", "0.5").addOption("1", "1.0").setValue(String(this.plugin.settings.hourRoundingIncrement)).onChange((value) => {
        void (async () => {
          this.plugin.settings.hourRoundingIncrement = Number(value);
          await this.plugin.saveSettings();
        })().catch(() => {
        });
      })
    );
    new import_obsidian.Setting(containerEl).setName("Enable date inference").setDesc("Infer date from note frontmatter, filename, or file modified time.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableDateInference).onChange((value) => {
        void (async () => {
          this.plugin.settings.enableDateInference = value;
          await this.plugin.saveSettings();
        })().catch(() => {
        });
      })
    );
  }
};

// src/ui/summaryView.ts
var import_obsidian2 = require("obsidian");
var WORK_LEDGER_SUMMARY_VIEW_TYPE = "work-ledger-summary-view";
var WorkLedgerSummaryView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.activePreset = "this-week";
    this.customStart = null;
    this.customEnd = null;
    this.plugin = plugin;
  }
  getViewType() {
    return WORK_LEDGER_SUMMARY_VIEW_TYPE;
  }
  getDisplayText() {
    return "Work ledger";
  }
  getIcon() {
    return "bar-chart-3";
  }
  async onOpen() {
    await this.refresh();
  }
  async refresh() {
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
  renderSummary(container, entries) {
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
    const recent = [...filteredEntries].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 20);
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
  renderRangeControls(container, entries) {
    const controls = container.createDiv({ cls: "work-ledger-range-controls" });
    const presets = [
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
  getSelectedRange(entries) {
    const now = /* @__PURE__ */ new Date();
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
  formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
      2,
      "0"
    )}`;
  }
};

// src/main.ts
var WorkLedgerPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
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
        })().catch(() => {
        });
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
          editor.replaceSelection(`${markdown}
`);
        })().catch(() => {
        });
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
          editor.replaceSelection(`${markdown}
`);
        })().catch(() => {
        });
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
  onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async getEntries() {
    return this.collectEntriesAcrossVault();
  }
  async openEntrySource(entry) {
    const abstractFile = this.app.vault.getAbstractFileByPath(entry.sourcePath);
    if (!(abstractFile instanceof import_obsidian3.TFile)) {
      new import_obsidian3.Notice(`Source note not found: ${entry.sourcePath}`);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(abstractFile);
    const view = this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
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
  async collectEntriesAcrossVault() {
    const files = this.app.vault.getMarkdownFiles();
    const allEntries = [];
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
  async exportCsv(entries) {
    const csv = entriesToCsv(entries);
    const targetPath = await this.getAvailableExportPath(defaultExportFileName());
    await this.app.vault.create(targetPath, csv);
    new import_obsidian3.Notice(`Work ledger exported ${entries.length} entries to ${targetPath}`);
  }
  async getAvailableExportPath(initialPath) {
    const adapter = this.app.vault.adapter;
    if (!await adapter.exists(initialPath)) {
      return initialPath;
    }
    const stamp = Date.now();
    const dotIndex = initialPath.lastIndexOf(".");
    if (dotIndex === -1) {
      return (0, import_obsidian3.normalizePath)(`${initialPath}-${stamp}`);
    }
    const base = initialPath.slice(0, dotIndex);
    const ext = initialPath.slice(dotIndex);
    return (0, import_obsidian3.normalizePath)(`${base}-${stamp}${ext}`);
  }
  async activateSummaryView() {
    const existingLeaf = this.app.workspace.getLeavesOfType(WORK_LEDGER_SUMMARY_VIEW_TYPE)[0];
    const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new import_obsidian3.Notice("Unable to open work ledger view.");
      return;
    }
    await leaf.setViewState({
      type: WORK_LEDGER_SUMMARY_VIEW_TYPE,
      active: true
    });
    void this.app.workspace.revealLeaf(leaf);
  }
  refreshSummaryViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(WORK_LEDGER_SUMMARY_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof WorkLedgerSummaryView) {
        void view.refresh();
      }
    }
  }
  getOffsetFromEntryId(entryId) {
    const separator = entryId.lastIndexOf(":");
    if (separator === -1) {
      return null;
    }
    const offsetText = entryId.slice(separator + 1);
    const offset = Number(offsetText);
    return Number.isFinite(offset) ? offset : null;
  }
  buildWorkLogTemplate() {
    const today = /* @__PURE__ */ new Date();
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
};
