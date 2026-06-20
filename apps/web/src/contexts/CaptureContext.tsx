import { createContext, useContext, useRef, type ReactNode } from 'react'

interface CaptureContextValue {
  openCapture: () => void
  registerCapture: (fn: () => void) => void
}

const CaptureContext = createContext<CaptureContextValue>({
  openCapture: () => {},
  registerCapture: () => {},
})

export function CaptureProvider({ children }: { children: ReactNode }) {
  const fnRef = useRef<(() => void) | null>(null)

  return (
    <CaptureContext.Provider
      value={{
        openCapture: () => fnRef.current?.(),
        registerCapture: (fn) => { fnRef.current = fn },
      }}
    >
      {children}
    </CaptureContext.Provider>
  )
}

export function useCapture() {
  return useContext(CaptureContext)
}
