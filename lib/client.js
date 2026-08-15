// dsh-mermaid-preview-plugin - browser half.
// Renders mermaid fenced blocks (```mermaid / ```mmd) inside the closing
// assistant message as rendered diagrams, right under the message (turnTail
// chain slot). The diagram SVG is loaded from mermaid.ink; the URL is built
// here with the browser-native btoa (UTF-8 safe via TextEncoder), following
// the active color scheme (light/dark).
window.__ModuleLoader__.load({
	id: "dsh-mermaid-preview-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		//#region styles
		// One shared <img> toggles between thumbnail and full size on click:
		// no popup, no portal, the image element never leaves the message.
		// Visual fit: the tail hugs the markdown above (no top margin), the
		// box uses a tight padding so it reads as a continuation.
		const css = ".dsh-mermaid-tail{flex-direction:column;gap:4px;margin:0 0 2px;display:flex}.dsh-mermaid-box{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:6px 8px;justify-content:center;align-items:flex-start;display:flex}.dsh-mermaid-thumb{max-width:100%;max-height:204px;width:auto;height:auto;display:block;cursor:zoom-in}.dsh-mermaid-full{max-width:100%;width:auto;height:auto;display:block;cursor:zoom-out}.dsh-mermaid-loading{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.dsh-mermaid-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin-bottom:4px}.dsh-mermaid-fallback{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:10px 12px;overflow-x:auto}.dsh-mermaid-fallback pre{margin:0;white-space:pre-wrap;word-break:break-word;font:13px/20px var(--ds-font-family-code);color:var(--dsw-alias-label-primary)}";
		const tagId = "dsh-mermaid-preview-plugin/tail.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-mermaid-preview-plugin";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		// Collect mermaid fenced code blocks (```mermaid or ```mmd) from markdown text.
		function extractMermaid(text, out) {
			const re = /```(?:mermaid|mmd)\s*\n([\s\S]*?)```/g;
			let m;
			while ((m = re.exec(text)) !== null) {
				const code = m[1].trim();
				if (code) out.push(code);
			}
		}

		// Any mermaid render server: default mermaid.ink, overridable through
		// the Host-injected boot global `window.__MERMAID_INK_URL__` (set by
		// the node half from profile patch config). The code is appended as
		// /svg/<urlsafe-base64>[?theme=dark].
		function diagramUrl(mermaidInkUrl, code, theme) {
			const bytes = new TextEncoder().encode(code);
			let binary = "";
			for (const b of bytes) binary += String.fromCharCode(b);
			const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
			return mermaidInkUrl.replace(/\/+$/, "") + "/svg/" + b64 + (theme === "dark" ? "?theme=dark" : "");
		}

		// Read the render-server URL from the Host-injected boot global,
		// falling back to the mermaid.ink default when unset.
		function readMermaidInkUrl() {
			const base = typeof window !== "undefined" ? window.__MERMAID_INK_URL__ : void 0;
			return typeof base === "string" && base.trim() !== "" ? base : "https://mermaid.ink";
		}

		// Read the thumbnail max height (px) from the Host-injected boot
		// global, falling back to 204 when unset.
		function readThumbMaxHeight() {
			const value = typeof window !== "undefined" ? window.__MERMAID_THUMB_MAX_HEIGHT__ : void 0;
			return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 204;
		}

		// Follow the active color scheme so the render server can pick a matching theme.
		function useColorScheme(props) {
			const [scheme, setScheme] = react.useState(
				props.theme && typeof props.theme.getTheme === "function" ? props.theme.getTheme().active.colorScheme : "light",
			);
			react.useEffect(() => {
				if (typeof props.onThemeChange !== "function") return;
				const off = props.onThemeChange((snapshot) => {
					if (snapshot && snapshot.active) setScheme(snapshot.active.colorScheme);
				});
				return off;
			}, []);
			return scheme;
		}

		function MermaidDiagram({ code, scheme, mermaidInkUrl, thumbMaxHeight }) {
			const [state, setState] = react.useState({ status: "loading" });
			const [zoomed, setZoomed] = react.useState(false);
			react.useEffect(() => {
				let alive = true;
				setState({ status: "loading" });
				const url = diagramUrl(mermaidInkUrl, code, scheme);
				const probe = new Image();
				probe.onload = () => { if (alive) setState({ status: "ready", url }); };
				probe.onerror = () => { if (alive) setState({ status: "error", message: "image failed to load" }); };
				probe.src = url;
				return () => { alive = false; };
			}, [code, scheme, mermaidInkUrl]);

			if (state.status === "loading") {
				return react.createElement("div", { className: "dsh-mermaid-loading" }, "Rendering diagram...");
			}
			if (state.status === "error") {
				return react.createElement("div", { className: "dsh-mermaid-fallback" },
					react.createElement("div", { className: "dsh-mermaid-error" }, "Diagram failed: " + state.message),
					react.createElement("pre", null, code),
				);
			}
			// One shared <img> toggles between thumbnail and full size on
			// click - the element never leaves the message, so the thumbnail
			// never disappears and the full image is already loaded.
			// Inline style overrides the CSS max-height with the configured
			// thumbnail height (inline wins; the full-size state sets none).
			const imgStyle = zoomed ? void 0 : { maxHeight: thumbMaxHeight + "px" };
			return react.createElement("div", { className: "dsh-mermaid-box" },
				react.createElement("img", {
					className: zoomed ? "dsh-mermaid-full" : "dsh-mermaid-thumb",
					style: imgStyle,
					src: state.url,
					alt: "mermaid diagram",
					title: zoomed ? "Click to shrink" : "Click to enlarge",
					onClick: () => setZoomed(!zoomed),
				}),
			);
		}

		function MermaidTurnTail(props) {
			const matched = props.matched;
			const diagrams = matched && matched.diagrams ? matched.diagrams : [];
			if (!diagrams.length) return null;
			const scheme = useColorScheme(props);
			const mermaidInkUrl = readMermaidInkUrl();
			const thumbMaxHeight = readThumbMaxHeight();
			return react.createElement("div", { className: "dsh-mermaid-tail" },
				diagrams.map((code, i) => react.createElement(MermaidDiagram, { key: i, code, scheme, mermaidInkUrl, thumbMaxHeight })),
			);
		}

		// Required services: the slot registry (turnTail chain). The render
		// server base URL arrives via the Host-injected boot global, so no
		// settings/connection dependency is needed here.
		const inject = ["slots"];

		function apply(ctx) {
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register(
				{
					name: "conversation.chat.turnTail",
					select: (owner) => {
						try {
							const tail = owner && owner.turn ? owner.turn.data.get("turn-tail") : undefined;
							const closing = tail && tail.closing;
							const blocks = closing && closing.finalNode ? closing.finalNode.blocks : [];
							const diagrams = [];
							for (const block of blocks) {
								if (block && block.kind === "text" && typeof block.text === "string") {
									extractMermaid(block.text, diagrams);
								}
							}
							return diagrams.length ? { seq: owner.seq, diagrams } : null;
						} catch (e) {
							return null;
						}
					},
					// Business face injected into the component props: a minimal
					// theme handle plus a theme-change subscription disposer.
					inject: () => ({
						theme: ctx.get("theme"),
						onThemeChange: (listener) => ctx.on("theme/change", listener),
					}),
				},
				MermaidTurnTail,
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
