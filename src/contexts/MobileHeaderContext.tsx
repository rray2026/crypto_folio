import { useCallback, useState, type ReactNode } from "react"
import { MobileHeaderContext, type MobileHeaderConfig } from "./MobileHeaderContextDefinition"

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
