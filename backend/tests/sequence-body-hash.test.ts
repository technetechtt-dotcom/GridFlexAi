import { hashRawBody } from "../src/utils/edgeDeviceAuth.js";

describe("sequence body-hash binding helpers", () => {
  it("hashRawBody is stable for identical buffers", () => {
    const a = Buffer.from('{"power":1}', "utf8");
    const b = Buffer.from('{"power":1}', "utf8");
    const c = Buffer.from('{"power":2}', "utf8");
    expect(hashRawBody(a)).toBe(hashRawBody(b));
    expect(hashRawBody(a)).not.toBe(hashRawBody(c));
  });
});
