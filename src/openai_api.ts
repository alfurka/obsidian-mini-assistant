import { MarkdownView, Notice, request } from "obsidian";
import { OpenAI } from "openai";

import {
	DEFAULT_API_BASE_URL,
	DEFAULT_IMAGE_MODEL,
	DEFAULT_SPEECH_MODEL,
	DEFAULT_TEXT_MODEL,
	OAI_IMAGE_CAPABLE_MODELS,
} from "./settings";

const normalizeBaseUrl = (baseUrl: string): string => {
	const trimmed = baseUrl?.trim() ?? "";
	const normalized = trimmed || DEFAULT_API_BASE_URL;
	return normalized.replace(/\/?$/, "");
};

export class OpenAIAssistant {
	modelName: string;
	apiFun: OpenAI;
	maxTokens: number;
	apiKey: string;
	speechModelName: string;
	baseUrl: string;

	constructor(
		apiKey: string,
		baseUrl: string,
		modelName: string,
		maxTokens: number,
		speechModelName: string,
	) {
		this.baseUrl = normalizeBaseUrl(baseUrl);
		this.apiFun = new OpenAI({
			apiKey: apiKey,
			baseURL: this.baseUrl,
			dangerouslyAllowBrowser: true,
		});
		this.modelName = modelName || DEFAULT_TEXT_MODEL;
		this.maxTokens = maxTokens;
		this.apiKey = apiKey;
		this.speechModelName = speechModelName || DEFAULT_SPEECH_MODEL;
	}

	display_error = (err: any) => {
		if (err instanceof OpenAI.APIError) {
			new Notice(`OpenAI API Error: ${err}`);
		} else {
			new Notice(err);
		}
	};

	private shouldRetryWithoutMaxTokens(err: unknown): boolean {
		const parts: string[] = [];
		if (err instanceof OpenAI.APIError) {
			if (err.message) {
				parts.push(err.message);
			}
			if (err.code) {
				parts.push(String(err.code));
			}
			if (typeof err.error === "object") {
				parts.push(JSON.stringify(err.error));
			}
		} else if (err instanceof Error) {
			parts.push(err.message);
		} else if (typeof err === "string") {
			parts.push(err);
		}

		const haystack = parts.join(" ");
		return /max[_-]?tokens|max_completion_tokens/i.test(haystack);
	}

	text_api_call = async (
		prompt_list: { [key: string]: any }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	) => {
		const streamMode = htmlEl !== undefined;
		const has_img = prompt_list.some((el) => Array.isArray(el.content));
		let model = this.modelName;

		if (has_img && !OAI_IMAGE_CAPABLE_MODELS.includes(model)) {
			model = DEFAULT_TEXT_MODEL;
		}

		const includeMaxTokens = Number.isFinite(this.maxTokens) && this.maxTokens > 0;

		const sendRequest = async (omitMaxTokens: boolean) => {
			if (streamMode && htmlEl) {
				htmlEl.innerHTML = "";
			}

			const is_reasonning_model = /o[124]/.test(model);
			const params: any = {
				messages: prompt_list,
				model: model,
				stream: streamMode,
			};

			if (includeMaxTokens && !omitMaxTokens) {
				if (is_reasonning_model) {
					params.max_completion_tokens = this.maxTokens;
				} else {
					params.max_tokens = this.maxTokens;
				}
			}

			const response = await this.apiFun.chat.completions.create(params);

			if (streamMode) {
				let responseText = "";
				for await (const chunk of response as any) {
					const content = chunk.choices?.[0]?.delta?.content;
					if (content) {
						responseText = responseText.concat(content);
						htmlEl!.innerHTML = responseText;
					}
				}
				return htmlEl!.innerHTML;
			}
			return (response as any).choices?.[0]?.message?.content;
		};

		let omitMaxTokens = !includeMaxTokens;
		while (true) {
			try {
				return await sendRequest(omitMaxTokens);
			} catch (err) {
				if (!omitMaxTokens && this.shouldRetryWithoutMaxTokens(err)) {
					omitMaxTokens = true;
					continue;
				}
				this.display_error(err);
				return;
			}
		}
	};

	img_api_call = async (
		model: string,
		prompt: string,
		img_size: string,
		num_img: number,
		is_hd: boolean,
	) => {
		const selectedModel = model || DEFAULT_IMAGE_MODEL;
		try {
			const params: Record<string, string | number | boolean> = {
				model: selectedModel,
				prompt: prompt,
			};

			if (img_size) {
				params.size = img_size;
			}

			if (Number.isFinite(num_img) && num_img > 1) {
				params.n = num_img;
			}

			if (selectedModel === "dall-e-3" && is_hd) {
				params.quality = "hd";
			}

			const response = await this.apiFun.images.generate(params as any);
			const data = response?.data ?? [];
			return data.map((x: any) => x.url);
		} catch (err) {
			this.display_error(err);
		}
	};

	whisper_api_call = async (input: File, language: string) => {
		const transcriptionModel = this.speechModelName || DEFAULT_SPEECH_MODEL;
		try {
			const completion = await this.apiFun.audio.transcriptions.create({
				file: input,
				model: transcriptionModel,
				language: language,
			});
			return completion.text;
		} catch (err) {
			this.display_error(err);
		}
	};

	text_to_speech_call = async (input_text: string) => {
		try {
			const mp3 = await this.apiFun.audio.speech.create({
				model: "tts-1",
				voice: "alloy",
				input: input_text,
			});

			const blob = new Blob([await mp3.arrayBuffer()], {
				type: "audio/mp3",
			});
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);

			await audio.play();
		} catch (err) {
			this.display_error(err);
		}
	};
}

export class AnthropicAssistant {
	modelName: string;
	maxTokens: number;
	apiKey: string;
	baseUrl: string;

	constructor(
		apiKey: string,
		baseUrl: string,
		modelName: string,
		maxTokens: number,
	) {
		this.apiKey = apiKey;
		this.baseUrl = normalizeBaseUrl(baseUrl) || "https://api.anthropic.com/v1";
		this.modelName = modelName || "claude-3-5-sonnet-latest";
		this.maxTokens = maxTokens;
	}

	private showNotice(message: string) {
		new Notice(message);
	}

	display_error = (err: any) => {
		this.showNotice(err);
	};

	text_api_call = async (
		prompt_list: { [key: string]: any }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	) => {
		try {
			const response = await request({
				url: `${this.baseUrl}/messages`,
				method: "POST",
				headers: {
					"x-api-key": this.apiKey,
					"anthropic-version": "2023-06-01",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model: this.modelName,
					max_tokens: this.maxTokens,
					messages: prompt_list,
					stream: false,
				}),
			});
			const parsed = JSON.parse(response);
			return parsed.content?.[0]?.text ?? "";
		} catch (err) {
			this.display_error(err);
		}
	};

	img_api_call = async () => {
		this.showNotice(
			"Image generation is unavailable for Anthropic's Messages API. Switch to an OpenAI-compatible gateway if you need this feature.",
		);
	};

	whisper_api_call = async () => {
		this.showNotice(
			"Speech-to-text requires an OpenAI-compatible endpoint.",
		);
	};

	text_to_speech_call = async () => {
		this.showNotice("Text-to-speech is not supported for Anthropic's Messages API.");
	};
}
