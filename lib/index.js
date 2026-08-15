// dsh-mermaid-image-preview - node half.
// The mermaid.ink render URL and thumbnail size are configured through the
// profile patch config (cordis.patch.yml) and resolved HERE on the Host, then
// shipped to the browser as boot-time globals:
//
//     ~/.dsh/profiles/web/cordis.patch.yml:
//       - id: ui-dsh-mermaid-image-preview
//         config:
//           mermaidInkUrl: https://your-own-server.example.com
//           thumbMaxHeight: 204
//
// The browser half never touches Host settings; it reads these globals only.
// Injecting them into the served index avoids the Host settings proxy
// allowlist (`settings-not-exposed`).

/** Default render server when no override is configured. */
export const DEFAULT_MERMAID_INK_URL = "https://mermaid.ink";

/** Default thumbnail max height in px when no override is configured. */
export const DEFAULT_THUMB_MAX_HEIGHT = 204;

/** Resolve the render-server URL from the row config, else the default. */
function resolveMermaidInkUrl(config) {
	const fromConfig = config && typeof config.mermaidInkUrl === "string" ? config.mermaidInkUrl.trim() : "";
	return fromConfig !== "" ? fromConfig : DEFAULT_MERMAID_INK_URL;
}

/** Resolve the thumbnail max height (px) from the row config, else the default. */
function resolveThumbMaxHeight(config) {
	const fromConfig = config && typeof config.thumbMaxHeight === "number" && Number.isFinite(config.thumbMaxHeight) && config.thumbMaxHeight > 0
		? Math.round(config.thumbMaxHeight)
		: DEFAULT_THUMB_MAX_HEIGHT;
	return fromConfig;
}

/**
 * Inject the resolved boot globals right after <body> opens, before the shell
 * mount and module scripts (same pattern as ui-theme's bootstrap).
 * @param html - Raw application index HTML.
 * @param mermaidInkUrl - Resolved diagram render-server URL.
 * @param thumbMaxHeight - Resolved thumbnail max height in px.
 * @returns HTML containing the bootstrap script.
 */
function injectBootGlobals(html, mermaidInkUrl, thumbMaxHeight) {
	const script = `<script>window.__MERMAID_INK_URL__ = ${JSON.stringify(mermaidInkUrl)};window.__MERMAID_THUMB_MAX_HEIGHT__ = ${thumbMaxHeight}<\/script>`;
	const body = /<body(?:\s[^>]*)?>/i.exec(html);
	if (body === null) return `${html}${script}`;
	const at = body.index + body[0].length;
	return `${html.slice(0, at)}${script}${html.slice(at)}`;
}

/**
 * Inject the boot globals when the optional Host HTTP service is composed.
 * @param ctx - Host context that may acquire the webServer service.
 * @param config - row config from cordis.patch.yml (may carry mermaidInkUrl / thumbMaxHeight).
 */
export function apply(ctx, config) {
	ctx.inject(["webServer"], (httpCtx) => {
		httpCtx.effect(() => httpCtx.webServer.tapIndex((html) => injectBootGlobals(html, resolveMermaidInkUrl(config), resolveThumbMaxHeight(config))), "dsh-mermaid-image-preview: boot globals bootstrap");
	});
}
