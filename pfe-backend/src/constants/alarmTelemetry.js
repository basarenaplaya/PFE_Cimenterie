/**
 * Canonical telemetry / alarm_log codes (PLC bit order preserved).
 * js1→AU, js2→Err_1, … per product naming.
 */
const TELEMETRY_ALARM_KEYS = Object.freeze(["AU", "Err_1", "Err_2", "Err_3", "Err_4"]);

const ALARM_LOG_DESCRIPTIONS = Object.freeze({
  AU: "Arrêt d'urgence : activation du signal AU (sécurité machine).",
  Err_1:
    "Défaut Écoulement Ciment : blocage ou absence d'écoulement du ciment dans le sac après l'ouverture de la vanne (bourrage ou silo vide).",
  Err_2:
    "Défaut Capteur : incohérence détectée — absence du signal de retour capteur confirmant la rotation de la bande transporteuse.",
  Err_3:
    "Défaut Moteur : déclenchement du relais thermique signalant une surcharge, une surchauffe ou un blocage mécanique du moteur.",
  Err_4:
    "Défaut Disjoncteur : coupure critique de l'alimentation électrique suite au déclenchement d'un disjoncteur de protection (court-circuit).",
});

function describeAlarmForLog(code) {
  const key = String(code || "").trim();
  if (ALARM_LOG_DESCRIPTIONS[key]) {
    return ALARM_LOG_DESCRIPTIONS[key];
  }
  return `Alarme PLC (${key}) active.`;
}

function cloneTelemetryAlarmsShape(alarms) {
  const a = alarms && typeof alarms === "object" ? alarms : {};
  const usesLegacy =
    typeof a.js1 === "boolean" ||
    typeof a.js2 === "boolean" ||
    typeof a.js3 === "boolean" ||
    typeof a.js4 === "boolean" ||
    typeof a.js5 === "boolean";

  if (usesLegacy) {
    return {
      AU: Boolean(a.js1),
      Err_1: Boolean(a.js2),
      Err_2: Boolean(a.js3),
      Err_3: Boolean(a.js4),
      Err_4: Boolean(a.js5),
    };
  }

  return {
    AU: Boolean(a.AU),
    Err_1: Boolean(a.Err_1),
    Err_2: Boolean(a.Err_2),
    Err_3: Boolean(a.Err_3),
    Err_4: Boolean(a.Err_4),
  };
}

module.exports = {
  TELEMETRY_ALARM_KEYS,
  ALARM_LOG_DESCRIPTIONS,
  describeAlarmForLog,
  cloneTelemetryAlarmsShape,
};
