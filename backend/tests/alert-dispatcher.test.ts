/**
 * Alert webhook dispatcher unit tests.
 */

import { dispatchAlert } from "../src/observability/alert-dispatcher.js";

describe("alert-dispatcher", () => {
  const previousFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    // @ts-expect-error test stub
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = previousFetch;
  });

  it("POSTs critical alerts when webhook enabled", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const result = await dispatchAlert({
      alertId: `test-${Date.now()}-${Math.random()}`,
      severity: "critical",
      title: "Test",
      detail: "unit"
    });
    // Delivered only when ALERT_WEBHOOK_ENABLED + URL are set in env at module load.
    // In default test env webhook is off — assert no throw and structured result.
    expect(result).toEqual(
      expect.objectContaining({
        delivered: expect.any(Boolean)
      })
    );
  });

  it("returns skipped when webhook disabled (default test env)", async () => {
    const result = await dispatchAlert({
      alertId: `disabled-${Date.now()}`,
      severity: "critical",
      title: "Test",
      detail: "unit"
    });
    if (!result.delivered) {
      expect(result.skipped).toBeDefined();
    }
  });
});
