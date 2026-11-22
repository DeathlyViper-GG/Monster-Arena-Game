// Keeps the browser's inspector out of reach on the page hosting the game.
// The platform badge is drawn here, behind the corner panel, so the right-click
// menu and the DevTools shortcuts must not open a surface where the badge, its
// link and the page markup can be reached. Text fields keep their menu so the
// account forms still support copy and paste.
const TEXT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function inTextField(target) {
  let el = target;
  while (el && el.nodeType === 1) {
    if (TEXT_TAGS.has(el.tagName) || el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

const DEVTOOLS_KEYS = new Set(["i", "j", "c"]);

export function installInspectGuard() {
  const onContextMenu = (event) => {
    if (inTextField(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onKeyDown = (event) => {
    const key = String(event.key || "").toLowerCase();
    const mod = event.ctrlKey || event.metaKey;
    const devtools = key === "f12" || (mod && event.shiftKey && DEVTOOLS_KEYS.has(key));
    const source = mod && !event.shiftKey && key === "u";
    if (!devtools && !source) return;
    event.preventDefault();
    event.stopPropagation();
  };

  document.addEventListener("contextmenu", onContextMenu, true);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("contextmenu", onContextMenu, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}