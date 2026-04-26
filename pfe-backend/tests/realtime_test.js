const assert = require("assert");
const { PlcService, isDbCompatibleTelemetry } = require("../src/services/plcService");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const plc = new PlcService({
    simulator: true,
    pollIntervalMs: 500,
    simTargetMin: 5,
    simTargetMax: 7,
  });

  await plc.initialize();

  const samples = [];
  for (let i = 0; i < 12; i += 1) {
    const snapshot = await plc.readSnapshot();
    samples.push(snapshot);

    assert.strictEqual(
      isDbCompatibleTelemetry(snapshot),
      true,
      "Simulator telemetry must match DB-compatible contract types"
    );

    assert.ok(
      Number.isInteger(snapshot.Last_Spout_ID) && snapshot.Last_Spout_ID >= 1 && snapshot.Last_Spout_ID <= 8,
      "Spout ID must remain in 1..8 range"
    );

    await sleep(500);
  }

  await plc.shutdown();

  const firstCounter = samples[0].Production_Counter;
  const maxCounter = samples.reduce(
    (current, item) => Math.max(current, item.Production_Counter),
    firstCounter
  );

  assert.ok(
    maxCounter > firstCounter,
    "Simulator should eventually complete a bag and increment Production_Counter"
  );

  const latest = samples[samples.length - 1];
  assert.ok(typeof latest.Alarms.js1 === "boolean", "Alarm js1 must be boolean");
  assert.ok(typeof latest.Alarms.js2 === "boolean", "Alarm js2 must be boolean");
  assert.ok(typeof latest.Alarms.js3 === "boolean", "Alarm js3 must be boolean");
  assert.ok(typeof latest.Alarms.js4 === "boolean", "Alarm js4 must be boolean");
  assert.ok(typeof latest.Alarms.js5 === "boolean", "Alarm js5 must be boolean");

  console.log(
    `realtime_test passed: ${samples.length} simulator samples captured, counter ${firstCounter} -> ${maxCounter}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("realtime_test failed:", error.message);
    process.exit(1);
  });
