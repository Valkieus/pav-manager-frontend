import { useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = () => { const d = document.createElement("div"); document.body.appendChild(d); return d; };
const render = (el) => { const d = host(); act(() => { createRoot(d).render(el); }); return d; };
const q = (ph) => document.querySelector(`[placeholder="${ph}"]`);
const setVal = (node, value) => { const proto = node.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(node, value); node.dispatchEvent(new Event("input", { bubbles: true })); };
const key = (node, k) => { const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); act(() => { node.dispatchEvent(e); }); return e; };
const hasText = (t) => [...document.querySelectorAll("span")].some((s) => s.textContent === t);
import { NameInput, NameTextarea, suggest } from "../NameAutocomplete";

const NAMES = ["Élodie Martin", "Jean Dupont", "Jeanne Roux", "Paul Durand"];

test("suggest : insensible aux accents/casse, jamais le nom déjà complet", () => {
  expect(suggest(NAMES, "elo")).toBe("Élodie Martin");
  expect(suggest(NAMES, "JEAN")).toBe("Jean Dupont");
  expect(suggest(NAMES, "Jean Dupont")).toBeNull();
  expect(suggest(NAMES, "xyz")).toBeNull();
  expect(suggest(NAMES, "")).toBeNull();
});

const Box = () => { const [v, setV] = useState(""); return <NameInput names={NAMES} value={v} onChange={setV} placeholder="n" className="x" />; };

test("input : la suite s'affiche, Tab l'accepte", () => {
  render(<Box />);
  const input = q("n");
  act(() => { input.focus(); });
  act(() => { setVal(input, "Pa"); });
  expect(hasText("ul Durand")).toBe(true);
  key(input, "Tab");
  expect(input.value).toBe("Paul Durand");
});

test("input : sans correspondance, Tab ne fait rien de spécial", () => {
  render(<Box />);
  const input = q("n");
  act(() => { input.focus(); });
  act(() => { setVal(input, "Zed"); });
  expect(key(input, "Tab").defaultPrevented).toBe(false);
});

const Area = () => { const [v, setV] = useState("Note\nJe"); return <NameTextarea names={NAMES} value={v} onChange={setV} placeholder="t" className="x" />; };

test("textarea : propose le nom en début de ligne, Tab complète la ligne courante", () => {
  render(<Area />);
  const ta = q("t");
  act(() => { ta.focus(); ta.setSelectionRange(7, 7); ta.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })); });
  expect(hasText("an Dupont")).toBe(true);
  key(ta, "Tab");
  expect(ta.value).toBe("Note\nJean Dupont");
});

test("input : Entrée et Espace acceptent aussi ; Espace après un prénom complet reste un espace", () => {
  render(<Box />);
  const input = q("n");
  act(() => { input.focus(); });
  act(() => { setVal(input, "Pa"); });
  expect(key(input, " ").defaultPrevented).toBe(true);
  expect(input.value).toBe("Paul Durand");
  act(() => { setVal(input, "El"); });
  key(input, "Enter");
  expect(input.value).toBe("Élodie Martin");
  act(() => { setVal(input, "Jean"); });
  expect(key(input, " ").defaultPrevented).toBe(false);
  expect(input.value).toBe("Jean");
});
