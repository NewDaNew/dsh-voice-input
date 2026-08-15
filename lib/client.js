/**
 * @local/dsh-plugin-voice-input — client bundle.
 *
 * Voice input for the DeepSeek Harness web GUI. Registers a mic button into
 * the `conversation.input.right` slot of the composer. Uses the Web Speech
 * API (SpeechRecognition / webkitSpeechRecognition) — no server round-trip,
 * no external services.
 *
 * Behavior:
 *  - Click the mic button: start listening for one utterance (auto-stops on
 *    silence). Interim transcript is shown live in a bubble above the button.
 *    The final transcript is appended to the composer draft.
 *  - Click again while listening: stop now and commit the last interim text.
 *  - The small caret button opens a menu: auto-send toggle and language
 *    selection (auto / zh-CN / en-US), persisted in localStorage.
 *
 * This file is the built client bundle consumed by the dsh client-modules
 * system (window.__ModuleLoader__.load + exports.apply/exports.inject).
 */
window.__ModuleLoader__.load({
	id: "@local/dsh-plugin-voice-input",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let { createElement: h, useEffect, useRef, useState, useCallback } = require("react");

		//#region helpers
		const PLUGIN_ID = "@local/dsh-plugin-voice-input";
		const STORAGE_AUTO_SEND = "dsh.voiceInput.autoSend";
		const STORAGE_LANG = "dsh.voiceInput.lang";

		const SR = typeof window !== "undefined"
			? window.SpeechRecognition || window.webkitSpeechRecognition || void 0
			: void 0;
		const supported = SR !== void 0;

		function defaultLang() {
			try {
				const nav = (navigator.language || "zh-CN").toLowerCase();
				if (nav.startsWith("zh")) return "zh-CN";
				if (nav.startsWith("en")) return "en-US";
				return navigator.language || "zh-CN";
			} catch {
				return "zh-CN";
			}
		}

		function readPref(key, fallback) {
			try {
				const raw = localStorage.getItem(key);
				return raw === null ? fallback : raw;
			} catch {
				return fallback;
			}
		}

		function writePref(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch {
				/* storage unavailable — ignore */
			}
		}

		function effectiveLang(pref) {
			return pref === "auto" || pref === void 0 || pref === "" ? defaultLang() : pref;
		}
		//#endregion

		//#region css
		const CSS_ID = "@local/dsh-plugin-voice-input/style";
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + CSS_ID + '"]') === null) {
			const css = [
				".dvi-group{position:relative;display:inline-flex;align-items:center;height:28px;border-radius:14px;background:transparent}",
				".dvi-group:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12))}",
				".dvi-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-secondary, #7a7f8a);cursor:pointer;border-radius:14px}",
				".dvi-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary, #1a1d23)}",
				".dvi-btn:disabled{cursor:not-allowed;opacity:.45}",
				".dvi-btn--listening{color:#fff !important;background:var(--dsw-alias-state-error-primary, #d92d20);animation:dvi-pulse 1.2s ease-in-out infinite}",
				".dvi-caret{display:inline-flex;align-items:center;justify-content:center;width:16px;height:28px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-tertiary, #9aa0aa);cursor:pointer;border-radius:0 14px 14px 0}",
				".dvi-caret:hover{color:var(--dsw-alias-label-secondary, #7a7f8a)}",
				".dvi-caret svg{transition:transform .15s ease}",
				".dvi-caret--open svg{transform:rotate(180deg)}",
				"@keyframes dvi-pulse{0%,100%{box-shadow:0 0 0 0 rgba(217,45,32,.35)}50%{box-shadow:0 0 0 6px rgba(217,45,32,0)}}",
				".dvi-bubble{position:absolute;right:0;bottom:calc(100% + 8px);z-index:40;max-width:min(320px, 72vw);padding:8px 12px;border:1px solid var(--dsw-alias-border-l1, #2b2f38);border-radius:10px;background:var(--dsw-alias-bg-popover, #202127);color:var(--dsw-alias-label-primary, #e8eaed);font-size:13px;line-height:20px;white-space:pre-wrap;word-break:break-word;box-shadow:0 8px 24px rgba(0,0,0,.28)}",
				".dvi-bubble--hint{color:var(--dsw-alias-label-tertiary, #9aa0aa)}",
				".dvi-bubble--err{color:var(--dsw-alias-state-error-primary, #f97066)}",
				".dvi-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:40;min-width:220px;padding:10px;border:1px solid var(--dsw-alias-border-l1, #2b2f38);border-radius:12px;background:var(--dsw-alias-bg-popover, #202127);box-shadow:0 8px 24px rgba(0,0,0,.28)}",
				".dvi-menuRow{display:flex;align-items:center;gap:8px;padding:6px 4px}",
				".dvi-menuRow + .dvi-menuRow{border-top:1px solid var(--dsw-alias-border-l1, #262a33)}",
				".dvi-menuLabel{flex:1;min-width:0;color:var(--dsw-alias-label-secondary, #9aa0aa);font-size:12px;line-height:18px;user-select:none}",
				".dvi-menuSelect{height:26px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1, #2b2f38);background:var(--dsw-alias-bg-module-platform, #17181c);color:var(--dsw-alias-label-primary, #e8eaed);font-size:12px;font-family:inherit}",
				".dvi-menuCheck{accent-color:var(--dsw-static-deepseek-500, #4d6bfe);width:14px;height:14px}"
			].join("");
			const tag = document.createElement("style");
			tag.dataset.plugin = PLUGIN_ID;
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region icons
		const ICON_MIC = h("svg", {
			viewBox: "0 0 16 16",
			width: "15",
			height: "15",
			"aria-hidden": true,
			fill: "currentColor"
		}, h("path", { d: "M8 1.25a2.375 2.375 0 0 0-2.375 2.375v3.75a2.375 2.375 0 0 0 4.75 0v-3.75A2.375 2.375 0 0 0 8 1.25Zm-4.875 7a.75.75 0 0 1 1.5 0 3.375 3.375 0 0 0 6.75 0 .75.75 0 0 1 1.5 0 4.875 4.875 0 0 1-4.125 4.826v1.424a.75.75 0 0 1-1.5 0v-1.424a4.875 4.875 0 0 1-4.125-4.826Z" }));
		const ICON_CARET = h("svg", {
			viewBox: "0 0 16 16",
			width: "10",
			height: "10",
			"aria-hidden": true,
			fill: "currentColor"
		}, h("path", { d: "M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" }));
		//#endregion

		//#region component
		/**
		 * The composer mic control. Standard-kit props (session-scoped slot):
		 *   useSession  — bound session hook
		 *   useInput    — bound input-state hook (draft/phase)
		 *   inputActions — { setDraft, submit, ... }
		 */
		function VoiceInputButton({ useSession, useInput, inputActions }) {
			const [listening, setListening] = useState(false);
			const [interim, setInterim] = useState("");
			const [error, setError] = useState(null);
			const [menuOpen, setMenuOpen] = useState(false);
			const [autoSend, setAutoSend] = useState(() => readPref(STORAGE_AUTO_SEND, "0") === "1");
			const [lang, setLang] = useState(() => readPref(STORAGE_LANG, "auto"));

			const recRef = useRef(null);
			const stateRef = useRef({ final: "", interim: "" });
			const actionsRef = useRef(inputActions);
			const draftRef = useRef("");
			const autoSendRef = useRef(autoSend);
			const langRef = useRef(lang);
			const listeningRef = useRef(false);
			const errorTimerRef = useRef(null);

			const draft = useInput((s) => (s === void 0 ? void 0 : s.draft)) ?? "";
			const phase = useInput((s) => (s === void 0 ? void 0 : s.phase)) ?? "plain";
			const removed = useSession((s) => (s === void 0 ? void 0 : s.removed)) ?? false;

			useEffect(() => { actionsRef.current = inputActions; }, [inputActions]);
			useEffect(() => { draftRef.current = draft; }, [draft]);
			useEffect(() => { autoSendRef.current = autoSend; }, [autoSend]);
			useEffect(() => { langRef.current = lang; }, [lang]);

			// auto-dismiss error text
			useEffect(() => {
				if (error === null) return;
				errorTimerRef.current = setTimeout(() => setError(null), 4000);
				return () => {
					if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
				};
			}, [error]);

			// teardown on unmount
			useEffect(() => () => {
				const rec = recRef.current;
				recRef.current = null;
				if (rec !== null) {
					try { rec.onresult = null; rec.onerror = null; rec.onend = null; rec.stop(); } catch { /* ignore */ }
				}
			}, []);

			const appendTranscript = useCallback((text) => {
				const actions = actionsRef.current;
				if (actions === void 0 || actions === null || typeof actions.setDraft !== "function") return;
				const trimmed = String(text).trim();
				if (trimmed === "") return;
				const current = draftRef.current || "";
				const next = current.trim() === "" ? trimmed : current.replace(/\s+$/, "") + " " + trimmed;
				actions.setDraft(next);
				if (autoSendRef.current && typeof actions.submit === "function") {
					// let the input machine adopt the draft first
					setTimeout(() => {
						try { actions.submit(); } catch { /* ignore */ }
					}, 60);
				}
			}, []);

			const stopListening = useCallback(() => {
				const rec = recRef.current;
				recRef.current = null;
				listeningRef.current = false;
				setListening(false);
				const pending = stateRef.current.final + (stateRef.current.interim || "");
				stateRef.current = { final: "", interim: "" };
				setInterim("");
				if (rec !== null) {
					try { rec.onresult = null; rec.onerror = null; rec.onend = null; } catch { /* ignore */ }
					try { rec.stop(); } catch { /* ignore */ }
				}
				if (pending.trim() !== "") appendTranscript(pending);
			}, [appendTranscript]);

			const startListening = useCallback(() => {
				if (!supported || listeningRef.current) return;
				setError(null);
				stateRef.current = { final: "", interim: "" };
				let rec;
				try {
					rec = new SR();
				} catch (err) {
					setError("无法启动语音识别：" + (err && err.message ? err.message : String(err)));
					return;
				}
				rec.lang = effectiveLang(langRef.current);
				rec.continuous = false;
				rec.interimResults = true;
				rec.maxAlternatives = 1;
				rec.onresult = (event) => {
					let interimText = "";
					for (let i = event.resultIndex; i < event.results.length; i++) {
						const res = event.results[i];
						if (res.isFinal) stateRef.current.final += res[0].transcript;
						else interimText += res[0].transcript;
					}
					stateRef.current.interim = interimText;
					setInterim(interimText);
				};
				rec.onerror = (event) => {
					const code = event.error || "unknown";
					if (code === "aborted") return;
					if (code === "not-allowed" || code === "service-not-allowed") setError("麦克风权限被拒绝，请在浏览器设置中允许");
					else if (code === "no-speech") setError("未检测到语音");
					else if (code === "audio-capture") setError("未找到可用的麦克风");
					else if (code === "network") setError("语音识别网络错误");
					else setError("语音识别错误：" + code);
				};
				rec.onend = () => {
					recRef.current = null;
					if (!listeningRef.current) return; // manual stop already handled
					listeningRef.current = false;
					setListening(false);
					const final = stateRef.current.final.trim();
					stateRef.current = { final: "", interim: "" };
					setInterim("");
					if (final !== "") appendTranscript(final);
				};
				recRef.current = rec;
				listeningRef.current = true;
				try {
					rec.start();
				} catch (err) {
					listeningRef.current = false;
					recRef.current = null;
					setError("无法启动语音识别：" + (err && err.message ? err.message : String(err)));
					return;
				}
				setListening(true);
			}, [appendTranscript]);

			const toggleListening = useCallback(() => {
				if (listeningRef.current) stopListening();
				else startListening();
			}, [startListening, stopListening]);

			const toggleMenu = useCallback(() => {
				setMenuOpen((open) => !open);
			}, []);

			// close the menu on outside click
			useEffect(() => {
				if (!menuOpen) return;
				const onDown = (event) => {
					const el = event.target;
					if (el instanceof Node && el.closest !== void 0 && el.closest(".dvi-group") !== null) return;
					setMenuOpen(false);
				};
				document.addEventListener("pointerdown", onDown, true);
				return () => document.removeEventListener("pointerdown", onDown, true);
			}, [menuOpen]);

			const busy = phase === "adjudicating" || phase === "submitting";
			const disabled = removed || busy || !supported;
			const showBubble = listening || error !== null;
			const bubbleText = error !== null
				? error
				: interim !== ""
					? interim
					: "正在聆听…";
			const langLabel = lang === "auto" ? "自动（" + defaultLang() + "）" : lang === "zh-CN" ? "中文" : lang === "en-US" ? "English" : lang;

			return h("span", { className: "dvi-group", "data-voice-input": "" },
				h("button", {
					type: "button",
					className: "dvi-btn" + (listening ? " dvi-btn--listening" : ""),
					"aria-label": listening ? "停止语音输入" : "语音输入",
					title: supported
						? (listening ? "停止语音输入（再次点击提交）" : "语音输入（点击开始说话）")
						: "当前浏览器不支持语音识别（需要 Chrome/Edge 等支持 Web Speech API 的浏览器）",
					disabled,
					onMouseDown: (e) => e.preventDefault(),
					onClick: toggleListening
				}, ICON_MIC),
				h("button", {
					type: "button",
					className: "dvi-caret" + (menuOpen ? " dvi-caret--open" : ""),
					"aria-label": "语音输入设置",
					title: "语音输入设置",
					disabled,
					onMouseDown: (e) => e.preventDefault(),
					onClick: toggleMenu
				}, ICON_CARET),
				showBubble && h("div", {
					className: "dvi-bubble" + (error !== null ? " dvi-bubble--err" : interim === "" && error === null ? " dvi-bubble--hint" : ""),
					role: error !== null ? "alert" : "status"
				}, bubbleText),
				menuOpen && h("div", {
					className: "dvi-menu",
					role: "menu"
				},
					h("div", { className: "dvi-menuRow" },
						h("label", { className: "dvi-menuLabel", htmlFor: "dvi-auto-send" }, "识别后自动发送"),
					h("input", {
						id: "dvi-auto-send",
						type: "checkbox",
						className: "dvi-menuCheck",
						checked: autoSend,
						onChange: (e) => {
							setAutoSend(e.target.checked);
							writePref(STORAGE_AUTO_SEND, e.target.checked ? "1" : "0");
						}
					})
				),
				h("div", { className: "dvi-menuRow" },
					h("label", { className: "dvi-menuLabel", htmlFor: "dvi-lang" }, "识别语言"),
					h("select", {
						id: "dvi-lang",
						className: "dvi-menuSelect",
						value: lang,
						onChange: (e) => {
							setLang(e.target.value);
							writePref(STORAGE_LANG, e.target.value);
						}
					},
						h("option", { value: "auto" }, "自动"),
						h("option", { value: "zh-CN" }, "中文 (zh-CN)"),
						h("option", { value: "en-US" }, "English (en-US)")
					)
				),
				h("div", { className: "dvi-menuRow" },
					h("span", { className: "dvi-menuLabel" }, "当前语言：" + langLabel)
				)
			)
			);
		}
		//#endregion

		//#region plugin entry
		const inject = ["slots"];

		/**
		 * Register the voice input control into the composer's trailing row.
		 * @param {import("@deepseek-ai/cordis").Context} ctx - client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "voice-input",
				order: 5
			}, VoiceInputButton));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
