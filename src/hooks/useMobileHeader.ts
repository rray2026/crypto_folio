import { useContext } from "react"
import { MobileHeaderContext } from "../contexts/MobileHeaderContextDefinition"

export const useMobileHeader = () => useContext(MobileHeaderContext)
