const api = typeof browser !== "undefined" ? browser : chrome;

const form = document.getElementById("form");
const input = document.getElementById("selector");
const saveBox = document.getElementById("save");
const message = document.getElementById("message");
const list = document.getElementById("rules");
const clearBtn = document.getElementById("clear");

let tabId = null;

// "<div class='a b' id='c'>" -> "div#c.a.b"; anything else is used as a CSS selector.
function toSelector(text) {
  text = text.trim();
  if (!text.startsWith("<")) return text;
  const doc = new DOMParser().parseFromString(text, "text/html");
  const el = doc.body.firstElementChild || doc.head.firstElementChild;
  if (!el) return "";
  let selector = el.tagName.toLowerCase();
  if (el.id) selector += "#" + CSS.escape(el.id);
  for (const cls of el.classList) selector += "." + CSS.escape(cls);
  return selector;
}

function send(msg) {
  return new Promise((resolve) => {
    api.tabs.sendMessage(tabId, msg, (response) => {
      if (api.runtime.lastError || !response) resolve(null);
      else resolve(response);
    });
  });
}

function render(state) {
  list.textContent = "";
  if (!state) {
    message.textContent = "This page can't be changed (try reloading it, or use a normal website).";
    form.querySelector("button").disabled = true;
    clearBtn.hidden = true;
    return;
  }
  if (state.error) {
    message.textContent = state.error;
    return;
  }
  message.textContent = "";
  for (const rule of state.rules) {
    const li = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = rule.selector;
    code.title = rule.selector;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = rule.count + " commented" + (rule.saved ? " · kept" : "");
    const btn = document.createElement("button");
    btn.textContent = "Restore";
    btn.addEventListener("click", async () => {
      render(await send({ type: "remove", selector: rule.selector }));
    });
    li.append(code, count, btn);
    list.append(li);
  }
  if (state.clicked) {
    const li = document.createElement("li");
    const label = document.createElement("code");
    label.textContent = "Double-clicked elements";
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = state.clicked + " commented";
    const btn = document.createElement("button");
    btn.textContent = "Restore";
    btn.addEventListener("click", async () => {
      render(await send({ type: "removeClicked" }));
    });
    li.append(label, count, btn);
    list.append(li);
  }
  clearBtn.hidden = state.rules.length === 0 && !state.clicked;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const selector = toSelector(input.value);
  if (!selector) {
    message.textContent = "Type a tag, .class, #id or selector first.";
    return;
  }
  const state = await send({ type: "add", selector, save: saveBox.checked });
  render(state);
  if (state && !state.error) input.value = "";
});

clearBtn.addEventListener("click", async () => {
  render(await send({ type: "clear" }));
});

api.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  tabId = tabs[0].id;
  render(await send({ type: "state" }));
});
