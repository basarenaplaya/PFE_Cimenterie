import { useEffect, useState } from "react"

export function useCountUp(target, { duration = 900, startAt = 0 } = {}) {
  const [value, setValue] = useState(startAt)

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frameId = 0

    const setOnFrame = (next) => {
      frameId = window.requestAnimationFrame(() => {
        setValue(next)
      })
    }

    if (reducedMotion.matches) {
      setOnFrame(target)
      return () => window.cancelAnimationFrame(frameId)
    }

    const from = startAt
    const startTime = performance.now()

    const tick = (time) => {
      const progress = Math.min((time - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (target - from) * eased

      setValue(next)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)

    return () => window.cancelAnimationFrame(frameId)
  }, [duration, startAt, target])

  return value
}
