const alarmDictionary = [
  { alarm_code: "AU", description: "Arrêt d'urgence : activation du signal AU (sécurité machine)." },
  {
    alarm_code: "Err_1",
    description:
      "Défaut Écoulement Ciment : blocage ou absence d'écoulement du ciment dans le sac après l'ouverture de la vanne (bourrage ou silo vide).",
  },
  {
    alarm_code: "Err_2",
    description:
      "Défaut Capteur : incohérence détectée — absence du signal de retour capteur confirmant la rotation de la bande transporteuse.",
  },
  {
    alarm_code: "Err_3",
    description:
      "Défaut Moteur : déclenchement du relais thermique signalant une surcharge, une surchauffe ou un blocage mécanique du moteur.",
  },
  {
    alarm_code: "Err_4",
    description:
      "Défaut Disjoncteur : coupure critique de l'alimentation électrique suite au déclenchement d'un disjoncteur de protection (court-circuit).",
  },
]

export const mockMachineStatus = [{ id: 1, current_mode: "CENTRAL", is_running: true }]

const now = Date.now()
const HOUR_MS = 60 * 60 * 1000

export const mockProductionLogs = Array.from({ length: 160 }, (_, i) => {
  const createdAt = new Date(now - i * 9 * 60 * 1000)
  const weight_target = 50.0
  const weight_actual = Number((49.84 + Math.random() * 0.34).toFixed(2))
  const giveaway = Number((weight_actual - weight_target).toFixed(2))

  let status = "OK"
  if (weight_actual < 49.9) status = "UNDERWEIGHT"
  if (weight_actual > 50.1) status = "OVERWEIGHT"

  return {
    id: i + 1,
    spout_id: (i % 8) + 1,
    weight_actual,
    weight_target,
    giveaway,
    status,
    created_at: createdAt.toISOString(),
  }
}).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

export const mockAlarmLogs = Array.from({ length: 14 }, (_, i) => {
  const profile = alarmDictionary[i % alarmDictionary.length]
  const start = new Date(now - (i + 1) * 38 * 60 * 1000)
  const isActive = i % 6 === 0
  const end = isActive ? null : new Date(start.getTime() + (60 + i * 12) * 1000)

  return {
    id: 1000 + i,
    alarm_code: profile.alarm_code,
    description: profile.description,
    start_time: start.toISOString(),
    end_time: end ? end.toISOString() : null,
    duration_sec: end ? Math.floor((end - start) / 1000) : 0,
  }
}).sort((a, b) => new Date(b.start_time) - new Date(a.start_time))

const hourlyBucket = new Map()

mockProductionLogs.forEach((log) => {
  const date = new Date(log.created_at)
  const key = date.getHours().toString().padStart(2, "0")
  const prev = hourlyBucket.get(key) ?? { bags: 0, tonnage: 0 }

  hourlyBucket.set(key, {
    bags: prev.bags + 1,
    tonnage: Number((prev.tonnage + log.weight_actual / 1000).toFixed(3)),
  })
})

export const hourlyProductionData = Array.from({ length: 24 }, (_, hour) => {
  const hourKey = hour.toString().padStart(2, "0")
  const bucket = hourlyBucket.get(hourKey) ?? { bags: 0, tonnage: 0 }

  return {
    hour: `${hourKey}:00`,
    bags: bucket.bags,
    tonnage: bucket.tonnage,
  }
})

const shiftDurationSec = 8 * 60 * 60
const stoppedSeconds = mockAlarmLogs.reduce((sum, alarm) => {
  if (alarm.end_time) return sum + alarm.duration_sec

  const elapsed = Math.floor((now - new Date(alarm.start_time).getTime()) / 1000)
  return sum + Math.max(elapsed, 0)
}, 0)

const boundedStopped = Math.min(stoppedSeconds, shiftDurationSec)

export const machineOeeData = [
  { name: "Running", value: shiftDurationSec - boundedStopped },
  { name: "Stopped", value: boundedStopped },
]
