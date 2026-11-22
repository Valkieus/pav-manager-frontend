import axios from "axios";
import { prefersSameTab, openSso } from "../openSso";

jest.mock("axios");
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
const { toast } = require("sonner");

const setUA = (ua, platform = "Linux x86_64", touch = 0) => {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
  Object.defineProperty(window.navigator, "platform", { value: platform, configurable: true });
  Object.defineProperty(window.navigator, "maxTouchPoints", { value: touch, configurable: true });
};
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

beforeEach(() => { jest.clearAllMocks(); window.open = jest.fn(() => ({ closed: false, close: jest.fn(), location: { href: "" } })); window.matchMedia = () => ({ matches: false }); });

test("iPhone / Android / iPad : même onglet, aucune fenêtre vide ouverte", () => {
  setUA(IPHONE); expect(prefersSameTab()).toBe(true);
  setUA("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile", "Linux armv8l"); expect(prefersSameTab()).toBe(true);
  setUA(DESKTOP.replace("X11; Linux x86_64", "Macintosh; Intel Mac OS X 10_15_7"), "MacIntel", 5); expect(prefersSameTab()).toBe(true);   // iPad en mode bureau
  setUA(DESKTOP); expect(prefersSameTab()).toBe(false);
});

test("ordinateur : nouvel onglet puis redirection", async () => {
  setUA(DESKTOP);
  const win = { closed: false, close: jest.fn(), location: { href: "" } };
  window.open = jest.fn(() => win);
  axios.post.mockResolvedValue({ data: { redirect_url: "https://led.example/sso?token=abc" } });
  await openSso("/led/sso-handoff", "x");
  expect(window.open).toHaveBeenCalled();
  expect(win.location.href).toBe("https://led.example/sso?token=abc");
});

test("téléphone : pas de window.open, et un refus 403 affiche un message clair", async () => {
  setUA(IPHONE);
  axios.post.mockRejectedValue({ response: { status: 403, data: { detail: "Accès non autorisé (Éléments LED)" } } });
  await openSso("/led/sso-handoff", "x");
  expect(window.open).not.toHaveBeenCalled();
  expect(toast.error.mock.calls[0][0]).toMatch(/réservé aux équipes Animation et Réalisation/);
});
