(() => {
  if (window.__commentOutLoaded) return;
  window.__commentOutLoaded = true;

  const api = typeof browser !== "undefined" ? browser : chrome;
  const storageKey = "rules:" + location.hostname;

  // selector -> { saved: boolean, entries: [{ comment, element }] }
  const rules = new Map();
  // Elements hidden with Ctrl+Shift+double-click: [{ comment, element }]
  let clicked = [];
  // Order of actions for Ctrl+Shift+Z: { kind: "click", entry } | { kind: "rule", selector }
  let undoStack = [];
  let reapplyTimer = null;

  const isProtected = (el) =>
    el === document.documentElement || el === document.head || el === document.body;

  function commentOut(element) {
    const comment = document.createComment(" " + element.outerHTML + " ");
    element.replaceWith(comment);
    return { comment, element };
  }

  function restoreEntry(entry) {
    if (entry.comment.isConnected) entry.comment.replaceWith(entry.element);
  }

  // ---------- Rules typed in the popup ----------

  function findTargets(selector) {
    let nodes = Array.from(document.querySelectorAll(selector)).filter((el) => !isProtected(el));
    // If a parent and its child both match, commenting the parent is enough.
    const set = new Set(nodes);
    return nodes.filter((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (set.has(p)) return false;
      }
      return true;
    });
  }

  function applyRule(selector) {
    const rule = rules.get(selector);
    if (!rule) return;
    let targets;
    try {
      targets = findTargets(selector);
    } catch (e) {
      return;
    }
    for (const element of targets) rule.entries.push(commentOut(element));
  }

  function restoreRule(selector) {
    const rule = rules.get(selector);
    if (!rule) return;
    // Restore in reverse so nested replacements unwind cleanly.
    for (const entry of rule.entries.reverse()) restoreEntry(entry);
    rules.delete(selector);
    undoStack = undoStack.filter((a) => !(a.kind === "rule" && a.selector === selector));
  }

  function saveRules() {
    const saved = [...rules].filter(([, r]) => r.saved).map(([s]) => s);
    if (saved.length) return api.storage.local.set({ [storageKey]: saved });
    return api.storage.local.remove(storageKey);
  }

  // ---------- Ctrl+Shift+double-click ----------

  function restoreClicked() {
    for (const entry of clicked.slice().reverse()) restoreEntry(entry);
    clicked = [];
    undoStack = undoStack.filter((a) => a.kind !== "click");
  }

  function undo() {
    const action = undoStack.pop();
    if (!action) return false;
    if (action.kind === "click") {
      restoreEntry(action.entry);
      clicked = clicked.filter((e) => e !== action.entry);
    } else {
      restoreRule(action.selector);
      saveRules();
    }
    return true;
  }

  // Outline the element under the pointer while Ctrl+Shift is held.
  let marked = null;
  let markedOutline = "";

  function clearMark() {
    if (!marked) return;
    marked.style.outline = markedOutline;
    if (!marked.getAttribute("style")) marked.removeAttribute("style");
    marked = null;
  }

  function mark(el) {
    if (el === marked) return;
    clearMark();
    if (!el || !el.style || isProtected(el)) return;
    marked = el;
    markedOutline = el.style.outline;
    el.style.outline = "2px solid #e5484d";
  }

  const armed = (e) => e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;

  window.addEventListener("mousemove", (e) => {
    if (armed(e)) mark(e.target);
    else clearMark();
  }, true);
  window.addEventListener("keyup", (e) => {
    if (!armed(e)) clearMark();
  }, true);
  window.addEventListener("blur", clearMark);

  // Stop the page (links, text selection) reacting while Ctrl+Shift-clicking.
  for (const type of ["mousedown", "click"]) {
    window.addEventListener(type, (e) => {
      if (armed(e) && e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  window.addEventListener("dblclick", (e) => {
    if (!armed(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    clearMark();
    if (!(el instanceof Element) || isProtected(el)) return;
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    const entry = commentOut(el);
    clicked.push(entry);
    undoStack.push({ kind: "click", entry });
  }, true);

  window.addEventListener("keydown", (e) => {
    if (armed(e) && e.code === "KeyZ" && undoStack.length) {
      e.preventDefault();
      e.stopPropagation();
      undo();
    }
  }, true);

  // ---------- Popup messages ----------

  function state() {
    return {
      host: location.hostname,
      clicked: clicked.filter((e) => e.comment.isConnected).length,
      rules: [...rules].map(([selector, r]) => ({
        selector,
        saved: r.saved,
        count: r.entries.filter((e) => e.comment.isConnected).length,
      })),
    };
  }

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "add") {
      try {
        document.querySelector(msg.selector);
      } catch (e) {
        sendResponse({ error: "That is not a valid selector." });
        return;
      }
      if (!rules.has(msg.selector)) {
        rules.set(msg.selector, { saved: false, entries: [] });
        undoStack.push({ kind: "rule", selector: msg.selector });
      }
      rules.get(msg.selector).saved = !!msg.save;
      applyRule(msg.selector);
      saveRules();
    } else if (msg.type === "remove") {
      restoreRule(msg.selector);
      saveRules();
    } else if (msg.type === "removeClicked") {
      restoreClicked();
    } else if (msg.type === "clear") {
      restoreClicked();
      for (const selector of [...rules.keys()]) restoreRule(selector);
      saveRules();
    }
    sendResponse(state());
  });

  // Pages that load content later: keep active rules applied to new elements.
  const observer = new MutationObserver(() => {
    if (!rules.size || reapplyTimer) return;
    reapplyTimer = setTimeout(() => {
      reapplyTimer = null;
      for (const selector of rules.keys()) applyRule(selector);
    }, 150);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Re-apply rules saved for this site.
  api.storage.local.get(storageKey, (data) => {
    for (const selector of (data && data[storageKey]) || []) {
      if (!rules.has(selector)) {
        rules.set(selector, { saved: true, entries: [] });
        applyRule(selector);
      }
    }
  });
})();
