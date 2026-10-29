import { describe, it, expect } from "vitest";
import { computeFinStatus, balanceDue, netReceived, periodResult, parseMoney } from "./finance";

describe("regras financeiras", () => {
  it("valor previsto não conta como receita: sem pagamentos a receita é zero", () => {
    expect(periodResult([], []).revenue).toBe(0);
  });
  it("pagamento parcial calcula saldo pendente", () => {
    const p = [{ kind: "receipt" as const, amount: 150 }];
    expect(computeFinStatus(p, 400)).toBe("partial");
    expect(balanceDue(p, 400)).toBe(250);
  });
  it("dois pagamentos quitam o valor final", () => {
    const p = [{ kind: "receipt" as const, amount: 150 }, { kind: "receipt" as const, amount: 250 }];
    expect(computeFinStatus(p, 400)).toBe("paid");
    expect(balanceDue(p, 400)).toBe(0);
  });
  it("estorno total sai da receita e marca como estornado", () => {
    const p = [{ kind: "receipt" as const, amount: 200 }, { kind: "refund" as const, amount: 200 }];
    expect(netReceived(p)).toBe(0);
    expect(computeFinStatus(p, 200)).toBe("refunded");
  });
  it("estorno parcial reduz a receita", () => {
    expect(netReceived([{ kind: "receipt", amount: 300 }, { kind: "refund", amount: 100 }])).toBe(200);
  });
  it("resultado = recebido − despesas", () => {
    expect(periodResult([{ kind: "receipt", amount: 1000 }], [{ amount: 350.5 }]).result).toBe(649.5);
  });
  it("lê valores no formato brasileiro", () => {
    expect(parseMoney("R$ 1.250,50")).toBe(1250.5);
  });
});
