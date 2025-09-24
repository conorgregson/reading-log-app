// dev/smoke.install.js
import { initSettings } from "../features/settings.js";
function ok(c,m){ if(!c) throw new Error("❌ "+m); console.log("✅", m); }

export async function runInstallSmoke() {
  console.group("Install button smoke");

  // 1) Minimal DOM
  const btn = document.createElement("button");
  btn.id = "install-app";
  btn.disabled = true;
  document.body.appendChild(btn);

  // 2) Init settings (adapter for toasts)
  const toasts = [];
  await initSettings({ adapters: { showToast: (m)=>toasts.push(m) } });

  // 3) Fake beforeinstallprompt
  let promptCalled = false, resolveChoice;
  const userChoice = new Promise(r => (resolveChoice = r));
  const evt = new Event("beforeinstallprompt");
  evt.preventDefault = () => {};
  evt.prompt = () => { promptCalled = true; };
  Object.defineProperty(evt, "userChoice", { get(){ return userChoice; } });
  window.dispatchEvent(evt);

  ok(!btn.disabled, "#install-app enabled after beforeinstallprompt");

  // 4) Click → prompt() + await userChoice
  btn.click();
  ok(promptCalled, "prompt() called");

  resolveChoice({ outcome: "accepted" });
  await Promise.resolve();

  // 5) appinstalled → disabled
  window.dispatchEvent(new Event("appinstalled"));
  ok(btn.disabled, "#install-app disabled after appinstalled");

  console.log("✅ Install button smoke passed.");
  console.groupEnd();
}