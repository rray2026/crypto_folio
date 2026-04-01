import { createContext, type ReactNode } from "react"

export interface MobileHeaderConfig {
    title: string
    leftAction?: ReactNode
    rightActions?: ReactNode
}

export interface MobileHeaderContextType extends MobileHeaderConfig {
    setMobileHeader: (config: MobileHeaderConfig) => void
}

export const MobileHeaderContext = createContext<MobileHeaderContextType>({
    title: "",
    setMobileHeader: () => {},
})
