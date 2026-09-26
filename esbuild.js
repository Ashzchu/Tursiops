const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	// ── Extension host bundle ────────────────────────────────────────────────
	const extCtx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	// ── Webview bundles (browser environment) ────────────────────────────────
	const webviewCtx = await esbuild.context({
		entryPoints: [
			{ in: 'src/ui/webviews/sidebar/sidebar.ts',  out: 'sidebar' },
			{ in: 'src/ui/webviews/memory/memory.ts',    out: 'memory' },
			{ in: 'src/ui/webviews/ask/ask.ts',          out: 'ask' },
			{ in: 'src/ui/webviews/sidebar/sidebar.css', out: 'sidebar' },
			{ in: 'src/ui/webviews/memory/memory.css',   out: 'memory' },
			{ in: 'src/ui/webviews/ask/ask.css',         out: 'ask' },
		],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outdir: 'dist/webviews',
		loader: { '.css': 'css' },
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	if (watch) {
		await extCtx.watch();
		await webviewCtx.watch();
	} else {
		await extCtx.rebuild();
		await extCtx.dispose();
		await webviewCtx.rebuild();
		await webviewCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
