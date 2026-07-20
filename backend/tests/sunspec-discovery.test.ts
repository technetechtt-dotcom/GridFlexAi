import { discoverSunSpecModel, SUNSPEC_ID } from "../src/gateway/verified-inverter/sunspec-discovery.js";

describe("SunSpec discovery", () => {
  it("locates SunS and model 103", async () => {
    const bank = new Map<number, number>();
    const common = 39999;
    bank.set(common, (SUNSPEC_ID >>> 16) & 0xffff);
    bank.set(common + 1, SUNSPEC_ID & 0xffff);
    // Common model 1 with length 65
    bank.set(common + 2, 1);
    bank.set(common + 3, 65);
    const model103 = common + 2 + 2 + 65;
    bank.set(model103, 103);
    bank.set(model103 + 1, 50);

    const readHolding = async (start: number, quantity: number) => {
      const out: number[] = [];
      for (let i = 0; i < quantity; i++) {
        out.push(bank.get(start + i) ?? 0);
      }
      return out;
    };

    const result = await discoverSunSpecModel(readHolding, { probeBases: [common] });
    expect(result.commonBaseZero).toBe(common);
    expect(result.modelId).toBe(103);
    expect(result.modelBaseZero).toBe(model103);
  });
});
