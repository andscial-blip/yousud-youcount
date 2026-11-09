"use client";
// Copiato da Cairn (src/components/tooltip.tsx): suggerimento dei grafici con mouse, tocco e tastiera.
/**
 * Chart tooltip. Mouse: follows the pointer. Touch: a tap shows the values of the column or bar tapped, above the
 * finger (not under it), and highlights it; a second tap on the same item, a tap elsewhere or a scroll closes it.
 * (A tap also fires an emulated mousemove: reacting to it opened and then the click closed the tip at once.)
 * Keyboard: Tab onto a chart, then the arrow keys, Home and End; Escape closes.
 */
import { useEffect } from "react";
export function Tooltip() {
  useEffect(() => {
    const tip = document.createElement("div"); tip.id = "ctip"; tip.setAttribute("role", "status"); document.body.appendChild(tip);
    let cur: Element | null = null, lastPointer = "mouse";
    const place = (x: number, y: number, touch: boolean) => {
      const r = tip.getBoundingClientRect();
      let lx: number, ly: number;
      if (touch) { lx = x - r.width / 2; ly = y - r.height - 28; if (ly < 8) ly = y + 28; }
      else { lx = x + 14; ly = y + 14; if (lx + r.width > innerWidth - 8) lx = x - r.width - 14; if (ly + r.height > innerHeight - 8) ly = y - r.height - 14; }
      tip.style.left = Math.min(Math.max(8, lx), innerWidth - r.width - 8) + "px";
      tip.style.top = Math.min(Math.max(8, ly), innerHeight - r.height - 8) + "px";
    };
    const show = (el: Element, x: number, y: number, touch: boolean) => {
      if (cur !== el) { cur?.classList.remove("tip-on"); cur = el; if (touch) el.classList.add("tip-on"); }
      tip.textContent = el.getAttribute("data-tip"); tip.style.display = "block"; place(x, y, touch);
    };
    const hide = () => { cur?.classList.remove("tip-on"); cur = null; tip.style.display = "none"; };
    const pd = (e: PointerEvent) => { lastPointer = e.pointerType || "mouse"; };
    const pm = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element).closest?.("[data-tip]"); if (el) show(el, e.clientX, e.clientY, false); else if (cur) hide();
    };
    const ck = (e: MouseEvent) => {
      const el = (e.target as Element).closest?.("[data-tip]");
      const touch = lastPointer !== "mouse" || matchMedia("(hover: none)").matches;
      if (!el) { if (cur) hide(); return; }
      if (touch) { if (cur === el) hide(); else show(el, e.clientX, e.clientY, true); }
    };
    // Keyboard: a chart takes focus as one stop; the arrows move between its values (also read by screen readers,
    // the tip is a live status). Any other element with a tip (a glossary term) shows it while focused.
    const items = (svg: Element) => (svg.matches("[data-tip]") ? [svg] : [...svg.querySelectorAll("[data-tip]")]);
    const at = (el: Element) => { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, Math.max(r.top, 0), true); };
    const idx = new WeakMap<Element, number>();
    const fi = (e: FocusEvent) => {
      const t = e.target as Element; if (!t || !t.matches) return;
      let kb = true; try { kb = t.matches(":focus-visible"); } catch { /* old browser */ }
      if (!kb) return; // a mouse click or a tap focuses too: the pointer handlers already deal with it
      if (t.matches("[data-kbd]")) { const L = items(t); if (L.length) { const i = Math.min(idx.get(t) ?? 0, L.length - 1); idx.set(t, i); at(L[i]!); } }
      else if (t.matches("[data-tip]")) at(t);
    };
    const fo = () => hide();
    const kd = (e: KeyboardEvent) => {
      const t = e.target as Element; if (!t || !t.matches) return;
      if (e.key === "Escape" && cur) { hide(); return; }
      if (!t.matches("[data-kbd]")) return;
      const L = items(t); if (!L.length) return; let i = idx.get(t) ?? 0;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") i = Math.min(L.length - 1, i + 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") i = Math.max(0, i - 1);
      else if (e.key === "Home") i = 0; else if (e.key === "End") i = L.length - 1; else return;
      e.preventDefault(); idx.set(t, i); at(L[i]!);
    };
    document.addEventListener("focusin", fi); document.addEventListener("focusout", fo); document.addEventListener("keydown", kd);
    document.addEventListener("pointerdown", pd, { passive: true }); document.addEventListener("pointermove", pm, { passive: true }); document.addEventListener("click", ck);
    // Any scroll (the page or a chart scrolled sideways on the phone) closes it: the values would point elsewhere.
    document.addEventListener("scroll", hide, { passive: true, capture: true }); window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("focusin", fi); document.removeEventListener("focusout", fo); document.removeEventListener("keydown", kd);
      document.removeEventListener("pointerdown", pd); document.removeEventListener("pointermove", pm); document.removeEventListener("click", ck);
      document.removeEventListener("scroll", hide, { capture: true }); window.removeEventListener("resize", hide); tip.remove();
    };
  }, []);
  return null;
}
