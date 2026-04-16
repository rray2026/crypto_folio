import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTransactionStore } from "@/store/useTransactionStore"
import { usePositionStore } from "@/store/usePositionStore"
import { Copy, Check, ArrowRight, AlertCircle, Sparkles, ClipboardPaste, Target } from "lucide-react"

const AI_PROMPT = `You are a trading record parser. Extract the trade details from the screenshot and return ONLY a JSON object in the exact format below, with no extra text, markdown, or explanation.

{
  "orderId": "",
  "symbol": "BTC/USDT",
  "type": "BUY",
  "date": "YYYY-MM-DD HH:mm:ss",
  "price": 0.00,
  "quantity": 0.00,
  "amount": 0.00,
  "fee": 0.00
}

Rules:
- orderId: order number or trade ID shown in the screenshot (use "" if not shown)
- symbol: trading pair in "BASE/QUOTE" format (e.g. BTC/USDT, ETH/USDT)
- type: must be exactly "BUY" or "SELL"
- date: local time in "YYYY-MM-DD HH:mm:ss" format
- price: unit price of the asset
- quantity: number of units traded
- amount: total transaction value (price × quantity)
- fee: transaction fee (use 0 if not shown)
- All numeric values must be plain numbers, no currency symbols or commas`

interface ParsedTx {
    orderId?: string
    symbol: string
    type: "BUY" | "SELL"
    date: string
    price: number
    quantity: number
    amount: number
    fee: number
}

export function AiImportFlow({ onSuccess }: { onSuccess: () => void }) {
    const [step, setStep] = useState<1 | 2>(1)
    const [copied, setCopied] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const autoPasteRef = useRef(false)
    const [pastedJson, setPastedJson] = useState("")
    const [parsed, setParsed] = useState<ParsedTx | null>(null)
    const [parseError, setParseError] = useState("")
    const addTransaction = useTransactionStore((state) => state.addTransaction)
    const createPosition = usePositionStore((state) => state.createPosition)
    const addTransactionToPosition = usePositionStore((state) => state.addTransactionToPosition)
    const [alsoCreatePosition, setAlsoCreatePosition] = useState(false)
    const [positionName, setPositionName] = useState("")

    const handlePasteFromClipboard = () => {
        setPastedJson("")
        autoPasteRef.current = true
        textareaRef.current?.focus()
        document.execCommand("paste")
    }

    const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (!autoPasteRef.current) return
        autoPasteRef.current = false
        e.preventDefault()
        const text = e.clipboardData.getData("text")
        setPastedJson(text)
        textareaRef.current?.blur()
        handleParse(text)
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(AI_PROMPT)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleParse = (text?: string) => {
        setParseError("")
        setParsed(null)
        try {
            // Extract JSON block if wrapped in markdown code fences
            const jsonStr = (text ?? pastedJson).replace(/```(?:json)?\n?/g, "").trim()
            const obj = JSON.parse(jsonStr)

            if (!obj.symbol || !obj.type || !obj.date || obj.price == null || obj.quantity == null || obj.amount == null) {
                setParseError("Missing required fields. Please check that the AI response is complete.")
                return
            }
            if (obj.type !== "BUY" && obj.type !== "SELL") {
                setParseError("The \"type\" field must be exactly \"BUY\" or \"SELL\".")
                return
            }

            setParsed({
                orderId: obj.orderId ? String(obj.orderId) : undefined,
                symbol: String(obj.symbol).toUpperCase(),
                type: obj.type,
                date: String(obj.date),
                price: Number(obj.price),
                quantity: Number(obj.quantity),
                amount: Number(obj.amount),
                fee: Number(obj.fee ?? 0),
            })
        } catch {
            setParseError("Failed to parse JSON. Please make sure you copied the full AI response.")
        }
    }

    const handleConfirm = async () => {
        if (!parsed) return
        const txDate = new Date(parsed.date).getTime()
        const txId = await addTransaction({
            orderId: parsed.orderId,
            symbol: parsed.symbol,
            type: parsed.type,
            price: parsed.price,
            quantity: parsed.quantity,
            amount: parsed.amount,
            fee: parsed.fee,
            date: txDate,
        })

        if (alsoCreatePosition) {
            const posId = await createPosition({
                symbol: parsed.symbol,
                strategyName: positionName || undefined,
                startDate: txDate,
            })
            await addTransactionToPosition(posId, {
                transactionId: txId,
                allocatedAmount: parsed.amount,
            })
        }

        onSuccess()
    }

    if (step === 1) {
        return (
            <div className="space-y-4 pt-2">
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Copy the prompt below and send it along with your trade screenshot to any AI (e.g. ChatGPT, Claude). The AI will return structured trade data.
                    </p>
                    <div className="relative">
                        <Textarea
                            readOnly
                            value={AI_PROMPT}
                            className="font-mono text-[11px] leading-relaxed min-h-[220px] resize-none bg-muted/30 border-border/50 text-muted-foreground pr-12"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={handleCopy}
                        >
                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>
                <Button
                    className="w-full h-11 rounded-xl font-bold gap-2"
                    onClick={() => setStep(2)}
                >
                    Sent to AI — Paste the Response
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4 pt-2">
            {!parsed ? (
                <>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Paste the JSON returned by the AI below, then click Parse.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs shrink-0"
                            onClick={handlePasteFromClipboard}
                        >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                            Paste from Clipboard
                        </Button>
                    </div>
                    <Textarea
                        ref={textareaRef}
                        value={pastedJson}
                        onChange={(e) => setPastedJson(e.target.value)}
                        onPaste={handleTextareaPaste}
                        placeholder={'{\n  "symbol": "BTC/USDT",\n  "type": "BUY",\n  ...\n}'}
                        className="font-mono text-xs min-h-[180px] bg-muted/30 border-border/50"
                    />
                    {parseError && (
                        <div className="flex items-start gap-2 text-xs text-destructive">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            {parseError}
                        </div>
                    )}
                    <Button
                        className="w-full h-11 rounded-xl font-bold"
                        onClick={() => handleParse()}
                        disabled={!pastedJson.trim()}
                    >
                        Parse
                    </Button>
                </>
            ) : (
                <>
                    {/* Parsed data summary */}
                    <div className="rounded-xl border border-border/30 bg-muted/10 overflow-hidden">
                        {/* Header row — symbol + side */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/15">
                            <span className="font-bold text-sm tracking-tight">{parsed.symbol}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                                parsed.type === 'BUY'
                                    ? 'bg-pnl-up/12 text-pnl-up border-pnl-up/25'
                                    : 'bg-pnl-down/12 text-pnl-down border-pnl-down/25'
                            }`}>
                                {parsed.type}
                            </span>
                        </div>
                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 divide-x divide-border/15">
                            <div className="px-4 py-2.5">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</span>
                                <p className="font-mono font-bold text-sm mt-0.5">{parsed.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}</p>
                            </div>
                            <div className="px-4 py-2.5">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Quantity</span>
                                <p className="font-mono font-bold text-sm mt-0.5">{parsed.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-border/15 border-t border-border/15">
                            <div className="px-4 py-2.5">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount</span>
                                <p className="font-mono font-bold text-sm mt-0.5">{parsed.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="px-4 py-2.5">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Fee</span>
                                <p className="font-mono text-sm mt-0.5 text-muted-foreground">{parsed.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</p>
                            </div>
                        </div>
                        {/* Date + Order ID footer */}
                        <div className="px-4 py-2 border-t border-border/15 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span>{parsed.date}</span>
                            {parsed.orderId && <span className="truncate ml-3 max-w-[120px]">#{parsed.orderId}</span>}
                        </div>
                    </div>

                    {/* Create position toggle card */}
                    <div
                        className={`rounded-xl border transition-all duration-300 ease-out overflow-hidden ${
                            alsoCreatePosition
                                ? 'bg-primary/6 border-primary/25 ring-1 ring-primary/15 shadow-[0_0_16px_hsl(var(--primary)/0.08)]'
                                : 'border-dashed border-border/40 hover:border-primary/30 hover:bg-primary/5'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => setAlsoCreatePosition(!alsoCreatePosition)}
                            className="w-full flex items-center gap-3 p-3 text-left"
                        >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                                alsoCreatePosition
                                    ? 'bg-primary/15 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.1)]'
                                    : 'bg-muted/50 text-muted-foreground'
                            }`}>
                                <Target className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold transition-colors duration-300 ${alsoCreatePosition ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Create Position
                                </p>
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    Link this trade to a new position
                                </p>
                            </div>
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center transition-all duration-300 ${
                                alsoCreatePosition
                                    ? 'bg-primary text-primary-foreground'
                                    : 'border border-border/50 bg-background'
                            }`}>
                                {alsoCreatePosition && <Check className="h-3 w-3" />}
                            </div>
                        </button>
                        {alsoCreatePosition && (
                            <div className="px-3 pb-3 pt-0">
                                <Input
                                    placeholder="Position name (optional)"
                                    value={positionName}
                                    onChange={e => setPositionName(e.target.value)}
                                    className="rounded-lg border-primary/15 bg-background/80 h-10 text-sm font-medium placeholder:text-muted-foreground/50"
                                    autoFocus
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            className="flex-1 h-11 rounded-xl"
                            onClick={() => setParsed(null)}
                        >
                            Paste Again
                        </Button>
                        <Button
                            className="flex-1 h-11 rounded-xl font-bold gap-2 shadow-lg"
                            onClick={handleConfirm}
                        >
                            <Sparkles className="h-4 w-4" />
                            Confirm & Save
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
