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
  await plc.writeTag("CMD_Marche_Web", true);

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
  assert.ok(typeof latest.Alarms.AU === "boolean", "Alarm AU must be boolean");
  assert.ok(typeof latest.Alarms.Err_1 === "boolean", "Alarm Err_1 must be boolean");
  assert.ok(typeof latest.Alarms.Err_2 === "boolean", "Alarm Err_2 must be boolean");
  assert.ok(typeof latest.Alarms.Err_3 === "boolean", "Alarm Err_3 must be boolean");
  assert.ok(typeof latest.Alarms.Err_4 === "boolean", "Alarm Err_4 must be boolean");

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
