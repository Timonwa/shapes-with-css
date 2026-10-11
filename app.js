// Opens a piece in the code dialog and builds its HTML and CSS from the live
// stylesheet, so the code shown is always exactly what draws the piece.
const dialog = document.querySelector("[data-code-dialog]");
const titleEl = dialog.querySelector("[data-dialog-title]");
const previewEl = dialog.querySelector("[data-dialog-preview]");
const codeEl = dialog.querySelector("[data-code]");
const copyButton = dialog.querySelector("[data-copy]");
const statusEl = dialog.querySelector("[data-status]");
const tabs = [...dialog.querySelectorAll('[role="tab"]')];
const tiles = [...document.querySelectorAll("[data-piece]")];

const ink = getComputedStyle(document.documentElement)
	.getPropertyValue("--ink")
	.trim();
const boxDirection = document.body.dataset.boxDirection;
const piecesSheet = [...document.styleSheets].find(
	(sheet) => sheet.href && new URL(sheet.href).pathname.endsWith("/style.css"),
);

let current = { html: "", css: "" };
let activeTab = "css";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The browser serialises a rule on one line; this spreads it one declaration
// per line.
function formatRule(rule) {
	return rule.cssText
		.replace(/\{\s*/, "{\n  ")
		.replace(/;\s+(?=\S)/g, ";\n  ")
		.replace(/;?\s*\}$/, ";\n}");
}

function buildCss(classNames) {
	// Whole class names only, so .S doesn't also pick up .S2 or .E-mid.
	const pattern = new RegExp(
		`\\.(?:${classNames.map(escapeRegExp).join("|")})(?![\\w-])`,
	);
	const rules = [...piecesSheet.cssRules]
		.filter((rule) => rule.selectorText && pattern.test(rule.selectorText))
		.map(formatRule);
	const direction =
		boxDirection === "column" ? "  flex-direction: column;\n" : "";
	const box = `.piece-box {\n  position: relative;\n  display: flex;\n${direction}  justify-content: center;\n  align-items: center;\n  width: 240px;\n  height: 240px;\n}`;
	return [`:root {\n  --ink: ${ink};\n}`, box, ...rules].join("\n\n");
}

// Pieces render as <span>s (valid inside the tile button); copied markup uses
// <div>s and keeps any nesting.
function serialise(element, depth) {
	const indent = "  ".repeat(depth);
	const children = [...element.children];
	const open = `${indent}<div class="${element.className}">`;
	if (children.length === 0) return `${open}</div>`;
	const inner = children.map((child) => serialise(child, depth + 1)).join("\n");
	return `${open}\n${inner}\n${indent}</div>`;
}

function buildHtml(box) {
	const children = [...box.children]
		.map((child) => serialise(child, 1))
		.join("\n");
	return `<div class="piece-box">\n${children}\n</div>`;
}

function selectTab(name) {
	activeTab = name;
	for (const tab of tabs) {
		const isActive = tab.dataset.tab === name;
		tab.setAttribute("aria-selected", String(isActive));
		tab.tabIndex = isActive ? 0 : -1;
		if (isActive) codeEl.setAttribute("aria-labelledby", tab.id);
	}
	codeEl.textContent = current[name];
	codeEl.scrollTop = 0;
}

function openPiece(tile) {
	const box = tile.querySelector(".piece-box");
	const classNames = [
		...new Set(
			[...box.querySelectorAll("[class]")].flatMap((el) => [...el.classList]),
		),
	];

	current = { html: buildHtml(box), css: buildCss(classNames) };
	titleEl.textContent = tile.dataset.title;
	previewEl.replaceChildren(box.cloneNode(true));
	selectTab(activeTab);
	resetCopyButton();
	history.replaceState(null, "", `#${tile.dataset.piece}`);
	if (!dialog.open) dialog.showModal();
}

function resetCopyButton() {
	copyButton.textContent = "Copy";
	statusEl.textContent = "";
}

async function copyCode() {
	const text = current[activeTab];
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		// Clipboard API blocked (e.g. insecure context): fall back to selection.
		const range = document.createRange();
		range.selectNodeContents(codeEl);
		getSelection().removeAllRanges();
		getSelection().addRange(range);
		document.execCommand("copy");
		getSelection().removeAllRanges();
	}
	copyButton.textContent = "Copied";
	statusEl.textContent = `${activeTab.toUpperCase()} copied to clipboard`;
	setTimeout(resetCopyButton, 2000);
}

for (const tile of tiles) {
	tile.addEventListener("click", () => openPiece(tile));
}

for (const tab of tabs) {
	tab.addEventListener("click", () => selectTab(tab.dataset.tab));
	tab.addEventListener("keydown", (event) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		const next = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
		next.focus();
		selectTab(next.dataset.tab);
	});
}

copyButton.addEventListener("click", copyCode);

dialog.querySelector("[data-close]").addEventListener("click", () => {
	dialog.close();
});

// A click on the backdrop lands on the dialog element itself.
dialog.addEventListener("click", (event) => {
	if (event.target === dialog) dialog.close();
});

dialog.addEventListener("close", () => {
	history.replaceState(null, "", location.pathname + location.search);
});

// Shared links like /#S open that piece straight away.
const linked = tiles.find(
	(tile) => tile.dataset.piece === decodeURIComponent(location.hash.slice(1)),
);
if (linked) openPiece(linked);
