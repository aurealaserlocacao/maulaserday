import { describe, it, expect } from "vitest";
import { fillTemplate, waLink, DEFAULT_TEMPLATES } from "./whatsapp";
import { zonedToISO } from "./format";

describe("WhatsApp", () => {
  const startsAt = zonedToISO("2026-11-05", "14:30");
  it("fills name, date, time and areas", () => {
    const t = fillTemplate(DEFAULT_TEMPLATES.confirm, { name: "Ana Souza", startsAt, areas: ["Axilas", "Virilha"] });
    expect(t).toContain("Olá, Ana!");
    expect(t).toContain("📅 Data: 05/11/2026");
    expect(t).toContain("⏰ Horário: 14:30");
    expect(t).toContain("✨ Áreas: Axilas, Virilha");
  });
  it("omits areas line when empty", () => {
    const t = fillTemplate(DEFAULT_TEMPLATES.confirm, { name: "Ana", startsAt, areas: [] });
    expect(t).not.toContain("Áreas");
  });
  it("adds Brazil code to local numbers", () => {
    expect(waLink("(11) 98765-4321", "oi")).toBe("https://wa.me/5511987654321?text=oi");
  });
});

describe("timezone", () => {
  it("14:30 in São Paulo is 17:30 UTC", () => {
    expect(zonedToISO("2026-11-05", "14:30")).toBe("2026-11-05T17:30:00.000Z");
  });
});
