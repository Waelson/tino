import { createContext, useContext, useState, type ReactNode } from 'react'

interface CaptureContextValue {
  isOpen: boolean
  openCapture: () => void
  closeCapture: () => void
}

const CaptureContext = createContext<CaptureContextValue>({
  isOpen: false,
  openCapture: () => {},
  closeCapture: () => {},
})

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <CaptureContext.Provider
      value={{
        isOpen,
        openCapture: () => setIsOpen(true),
        closeCapture: () => setIsOpen(false),
      }}
    >
      {children}
    </CaptureContext.Provider>
  )
}

export function useCapture() {
  return useContext(CaptureContext)
}
