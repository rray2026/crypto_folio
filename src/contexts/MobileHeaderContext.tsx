import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

interface MobileHeaderConfig {
    title: string
    leftAction?: ReactNode
    rightActions?: ReactNode
}

interface MobileHeaderContextType extends MobileHeaderConfig {
    setMobileHeader: (config: MobileHeaderConfig) => void
}

const MobileHeaderContext = createContext<MobileHeaderContextType>({
    title: "",
    setMobileHeader: () => {},
})

export function MobileHeaderProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<MobileHeaderConfig>({ title: "" })

    const setMobileHeader = useCallback((c: MobileHeaderConfig) => {
        setConfig(c)
    }, [])

    return (
        <MobileHeaderContext.Provider value={{ ...config, setMobileHeader }}>
            {children}
        </MobileHeaderContext.Provider>
    )
}

export const useMobileHeader = () => useContext(MobileHeaderContext)
