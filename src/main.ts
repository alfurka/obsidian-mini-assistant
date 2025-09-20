import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { ChatModal, PromptModal, SpeechModal } from "./modal";
import { AnthropicAssistant, OpenAIAssistant } from "./openai_api";
import {
	DEFAULT_API_BASE_URL,
	DEFAULT_MAX_TOKENS,
	DEFAULT_SPEECH_MODEL,
	DEFAULT_TEXT_MODEL,
} from "./settings";

type Capability = "text" | "speech";
type ProviderSlot = 1 | 2;

interface AiAssistantSettings {
	apiKey1: string;
	apiBaseUrl1: string;
	apiKey2: string;
	apiBaseUrl2: string;
	textProvider: number;
	speechProvider: number;
	modelName: string;
	speechModelName: string;
	maxTokens: number;
	replaceSelection: boolean;
	language: string;
}

const DEFAULT_SETTINGS: AiAssistantSettings = {
	apiKey1: "",
	apiBaseUrl1: DEFAULT_API_BASE_URL,
	apiKey2: "",
	apiBaseUrl2: "",
	textProvider: 1,
	speechProvider: 1,
	modelName: DEFAULT_TEXT_MODEL,
	speechModelName: DEFAULT_SPEECH_MODEL,
	maxTokens: DEFAULT_MAX_TOKENS,
	replaceSelection: true,
	language: "",
};

export default class AiAssistantPlugin extends Plugin {
	settings: AiAssistantSettings;
	assistants: Partial<
		Record<Capability, OpenAIAssistant | AnthropicAssistant>
	> = {};

	buildAssistants() {
		const slotCache = new Map<
			ProviderSlot,
			OpenAIAssistant | AnthropicAssistant | undefined
		>();
		const resolveSlot = (slot: ProviderSlot) => {
			if (slotCache.has(slot)) {
				return slotCache.get(slot);
			}
			const config = this.getProviderConfig(slot);
			if (!config.apiKey) {
				slotCache.set(slot, undefined);
				return undefined;
			}

			const assistant = this.createAssistant(config.apiKey, config.baseUrl);
			slotCache.set(slot, assistant);
			return assistant;
		};

		this.assistants = {};
		const textSlot = this.normalizeProviderSlot(this.settings.textProvider);
		const speechSlot = this.normalizeProviderSlot(this.settings.speechProvider);

		this.assistants.text = resolveSlot(textSlot);
		this.assistants.speech = resolveSlot(speechSlot);
	}

	private createAssistant(
		apiKey: string,
		baseUrl: string,
	): OpenAIAssistant | AnthropicAssistant {
		const effectiveBase = baseUrl || DEFAULT_API_BASE_URL;
		if (/anthropic\.com/i.test(effectiveBase)) {
			return new AnthropicAssistant(
				apiKey,
				effectiveBase,
				this.settings.modelName,
				this.settings.maxTokens,
			);
		}

		return new OpenAIAssistant(
			apiKey,
			effectiveBase,
			this.settings.modelName,
			this.settings.maxTokens,
			this.settings.speechModelName,
		);
	}

	private getProviderConfig(slot: ProviderSlot) {
		const keyField = `apiKey${slot}` as const;
		const urlField = `apiBaseUrl${slot}` as const;
		const apiKey = (this.settings[keyField] || "").trim();
		let baseUrl = (this.settings[urlField] || "").trim();
		if (!baseUrl && slot === 1) {
			baseUrl = DEFAULT_API_BASE_URL;
		}
		return { apiKey, baseUrl: baseUrl || "" };
	}

	private normalizeProviderSlot(value: number | string | undefined): ProviderSlot {
		const numeric = Number.parseInt(String(value ?? ""), 10);
		if (numeric === 2) {
			return 2;
		}
		return 1;
	}

	private getAssistant(capability: Capability) {
		return this.assistants[capability];
	}

	async onload() {
		await this.loadSettings();
		this.buildAssistants();

		this.addCommand({
			id: "chat-mode",
			name: "Open Assistant Chat",
			callback: () => {
				const assistant = this.getAssistant("text");
				if (!assistant) {
					new Notice("Configure a provider for chat in mini assistant settings.");
					return;
				}
				new ChatModal(this.app, assistant).open();
			},
		});

		this.addCommand({
			id: "prompt-mode",
			name: "Open Assistant Prompt",
			editorCallback: async (editor: Editor) => {
				const assistant = this.getAssistant("text");
				if (!assistant) {
					new Notice("Configure a provider for chat in mini assistant settings.");
					return;
				}
				const selected_text = editor.getSelection().toString().trim();
				new PromptModal(
					this.app,
					async (x: { [key: string]: string }) => {
						let answer = await assistant.text_api_call([
							{
								role: "user",
								content:
									x["prompt_text"] + " : " + selected_text,
							},
						]);
						answer = answer!;
						if (!this.settings.replaceSelection) {
							answer = selected_text + "\n" + answer.trim();
						}
						if (answer) {
							editor.replaceSelection(answer.trim());
						}
					},
					false,
					{},
				).open();
			},
		});

		this.addCommand({
			id: "speech-to-text",
			name: "Open Speech to Text",
			editorCallback: (editor: Editor) => {
				const assistant = this.getAssistant("speech");
				if (!assistant) {
					new Notice("Configure a provider for speech-to-text in mini assistant settings.");
					return;
				}
				new SpeechModal(
					this.app,
					assistant,
					this.settings.language,
					editor,
				).open();
			},
		});

		this.addSettingTab(new AiAssistantSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		const loaded = await this.loadData();
		const migrated = this.migrateSettings(loaded);
		this.settings = Object.assign({}, DEFAULT_SETTINGS, migrated);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private migrateSettings(data: any): Partial<AiAssistantSettings> {
		if (!data) {
			return {};
		}
		const migrated: Partial<AiAssistantSettings> = { ...data };

		const legacyKey = [
			data.apiKey,
			data.openAIapiKey,
			data.anthropicApiKey,
		].find((value) => typeof value === "string" && value.trim());

		if (typeof migrated.apiKey1 !== "string") {
			migrated.apiKey1 = legacyKey ? legacyKey.trim() : "";
		}
		migrated.apiKey1 = (migrated.apiKey1 ?? "").toString().trim();
		migrated.apiKey2 = (migrated.apiKey2 ?? "").toString().trim();

		const legacyBase =
			typeof data.apiBaseUrl === "string" && data.apiBaseUrl.trim()
				? data.apiBaseUrl.trim()
				: DEFAULT_API_BASE_URL;

		if (typeof migrated.apiBaseUrl1 !== "string") {
			migrated.apiBaseUrl1 = legacyBase;
		}
		migrated.apiBaseUrl1 = (migrated.apiBaseUrl1 ?? "").toString().trim();
		migrated.apiBaseUrl2 = (migrated.apiBaseUrl2 ?? "").toString().trim();

		if (!migrated.apiBaseUrl1) {
			migrated.apiBaseUrl1 = DEFAULT_API_BASE_URL;
		}

		migrated.textProvider = this.normalizeProviderSlot(
			migrated.textProvider,
		);
		migrated.speechProvider = this.normalizeProviderSlot(
			migrated.speechProvider,
		);

		if (typeof migrated.speechModelName !== "string" || !migrated.speechModelName) {
			migrated.speechModelName = DEFAULT_SPEECH_MODEL;
		}

		const parsedTokens = Number.parseInt(
			String(data?.maxTokens ?? migrated.maxTokens ?? ""),
			10,
		);
		if (Number.isNaN(parsedTokens) || parsedTokens < 0) {
			migrated.maxTokens = DEFAULT_MAX_TOKENS;
		} else {
			migrated.maxTokens = parsedTokens;
		}

		delete (migrated as any).openAIapiKey;
		delete (migrated as any).anthropicApiKey;
		delete (migrated as any).apiKey;
		delete (migrated as any).apiBaseUrl;
		delete (migrated as any).apiKey3;
		delete (migrated as any).apiBaseUrl3;
		delete (migrated as any).imageProvider;
		delete (migrated as any).imageModelName;
		delete (migrated as any).imgFolder;
		delete (migrated as any).mySetting;

		return migrated;
	}
}

class AiAssistantSettingTab extends PluginSettingTab {
	plugin: AiAssistantPlugin;

	constructor(app: App, plugin: AiAssistantPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Settings for mini assistant." });

		const supportEl = containerEl.createDiv();
		supportEl.style.marginBottom = "1rem";
		const supportLink = supportEl.createEl("a", {
			href: "https://www.buymeacoffee.com/alfurkat",
			attr: { target: "_blank" },
		});
		const supportImg = supportLink.createEl("img");
		supportImg.setAttr(
			"src",
			"https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png",
		);
		supportImg.setAttr("alt", "Buy Me A Coffee");
		supportImg.setAttr(
			"style",
			"height: 60px !important;width: 217px !important;",
		);
		containerEl.createEl("h3", { text: "Providers" });
		const providerSlots: ProviderSlot[] = [1, 2];
		providerSlots.forEach((slot) => this.renderProviderSlot(containerEl, slot));

		containerEl.createEl("h3", { text: "Text Assistant" });
		this.renderProviderPicker(
			containerEl,
			"Chat Provider",
			"textProvider",
			"Choose which provider slot handles chat completions",
		);

		new Setting(containerEl)
			.setName("Chat Model")
			.setDesc("Type the exact model identifier from your provider")
			.addText((text) => {
				text.setPlaceholder(DEFAULT_TEXT_MODEL);
				text.setValue(this.plugin.settings.modelName);
				text.onChange(async (value) => {
					this.plugin.settings.modelName = value.trim();
					await this.plugin.saveSettings();
					this.plugin.buildAssistants();
				});
			});

		new Setting(containerEl)
			.setName("Max Tokens")
			.addText((text) => {
				text.setPlaceholder("Leave blank to use provider default");
				text.setValue(
					this.plugin.settings.maxTokens > 0
						? this.plugin.settings.maxTokens.toString()
						: "",
				);
				text.onChange(async (value) => {
					const trimmed = value.trim();
					if (trimmed === "") {
						this.plugin.settings.maxTokens = 0;
						await this.plugin.saveSettings();
						this.plugin.buildAssistants();
						return;
					}

					const intValue = Number.parseInt(trimmed, 10);
					if (Number.isNaN(intValue) || intValue < 0) {
						new Notice("Max tokens must be a positive number or blank.");
						return;
					}

					this.plugin.settings.maxTokens = intValue;
					await this.plugin.saveSettings();
					this.plugin.buildAssistants();
				});
			});

		new Setting(containerEl)
			.setName("Prompt behavior")
			.setDesc("Replace selection")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.replaceSelection);
				toggle.onChange(async (value) => {
					this.plugin.settings.replaceSelection = value;
					await this.plugin.saveSettings();
				});
			});

		containerEl.createEl("h3", { text: "Speech to Text" });
		this.renderProviderPicker(
			containerEl,
			"Speech Provider",
			"speechProvider",
			"Choose which provider slot handles speech-to-text",
		);

		new Setting(containerEl)
			.setName("Speech-to-Text Model")
			.setDesc("Type the transcription model identifier (e.g. whisper-1)")
			.addText((text) => {
				text.setPlaceholder(DEFAULT_SPEECH_MODEL);
				text.setValue(this.plugin.settings.speechModelName);
				text.onChange(async (value) => {
					this.plugin.settings.speechModelName = value.trim();
					await this.plugin.saveSettings();
					this.plugin.buildAssistants();
				});
			});

		new Setting(containerEl)
			.setName("The language of the input audio")
			.addText((text) => {
				text.setValue(this.plugin.settings.language);
				text.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderProviderSlot(containerEl: HTMLElement, slot: ProviderSlot) {
		const label = `Provider ${slot}`;
		const keyField = `apiKey${slot}` as const;
		const urlField = `apiBaseUrl${slot}` as const;

		const providerDiv = containerEl.createDiv();
		providerDiv.createEl("h4", { text: label });

		const currentKey = this.plugin.settings[keyField] ?? "";
		new Setting(providerDiv)
			.setName("API Key")
			.addText((text) => {
				text.setPlaceholder("Enter provider key");
				text.setValue(currentKey);
				text.onChange(async (value) => {
					this.plugin.settings[keyField] = value.trim();
					await this.plugin.saveSettings();
					this.plugin.buildAssistants();
				});
			});

		const currentBase = this.plugin.settings[urlField] ?? "";
		new Setting(providerDiv)
			.setName("Base URL")
			.addText((text) => {
				text.setPlaceholder(slot === 1 ? DEFAULT_API_BASE_URL : "");
				text.setValue(currentBase);
				text.onChange(async (value) => {
					this.plugin.settings[urlField] = value.trim();
					await this.plugin.saveSettings();
					this.plugin.buildAssistants();
				});
			});
	}

	private renderProviderPicker(
		containerEl: HTMLElement,
		label: string,
		field: "textProvider" | "speechProvider",
		desc: string,
	) {
		const providerOptions: Record<string, string> = {
			"1": "Provider 1",
			"2": "Provider 2",
		};

		new Setting(containerEl)
			.setName(label)
			.setDesc(desc)
			.addDropdown((dropdown) => {
				dropdown.addOptions(providerOptions);
				dropdown.setValue(String(this.plugin.settings[field] ?? 1));
				dropdown.onChange(async (value) => {
					this.plugin.settings[field] = Number.parseInt(value, 10) as ProviderSlot;
					await this.plugin.saveSettings();
					this.plugin.buildAssistants();
				});
			});
	}
}
