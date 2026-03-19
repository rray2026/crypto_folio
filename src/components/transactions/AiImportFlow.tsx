import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useTransactionStore } from "@/store/useTransactionStore"
import { Copy, Check, ArrowRight, AlertCircle, Sparkles, ClipboardPaste } from "lucide-react"

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
                setParseError("缺少必要字段，请检查 AI 返回内容是否完整。")
                return
            }
            if (obj.type !== "BUY" && obj.type !== "SELL") {
                setParseError("type 字段必须为 \"BUY\" 或 \"SELL\"。")
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
            setParseError("JSON 解析失败，请确认已完整复制 AI 的返回内容。")
        }
    }

    const handleConfirm = async () => {
        if (!parsed) return
        await addTransaction({
            symbol: parsed.symbol,
            type: parsed.type,
            price: parsed.price,
            quantity: parsed.quantity,
            amount: parsed.amount,
            fee: parsed.fee,
            date: new Date(parsed.date).getTime(),
            orderId: parsed.orderId,
        })
        onSuccess()
    }

    if (step === 1) {
        return (
            <div className="space-y-4 pt-2">
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        将下方提示词复制后，连同交易截图一起发给任意 AI（如 ChatGPT、Claude），
                        AI 会返回结构化的交易数据。
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
                            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>
                <Button
                    className="w-full h-11 rounded-xl font-bold gap-2"
                    onClick={() => setStep(2)}
                >
                    已发给 AI，粘贴返回结果
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
                            将 AI 返回的 JSON 内容粘贴到下方，点击解析。
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs shrink-0"
                            onClick={handlePasteFromClipboard}
                        >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                            从剪贴板粘贴
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
                        解析内容
                    </Button>
                </>
            ) : (
                <>
                    <p className="text-sm text-muted-foreground">请确认以下交易信息，确认后将自动录入。</p>
                    <div className="rounded-xl border border-border/50 bg-muted/20 divide-y divide-border/30 text-sm">
                        {[
                            ...(parsed.orderId ? [{ label: "订单号", value: parsed.orderId }] : []),
                            { label: "交易对", value: parsed.symbol },
                            { label: "方向", value: parsed.type },
                            { label: "时间", value: parsed.date },
                            { label: "单价", value: parsed.price },
                            { label: "数量", value: parsed.quantity },
                            { label: "总额", value: parsed.amount },
                            { label: "手续费", value: parsed.fee },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between px-4 py-2.5">
                                <span className="text-muted-foreground text-xs">{label}</span>
                                <span className="font-mono font-semibold text-xs">{String(value)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            className="flex-1 h-11 rounded-xl"
                            onClick={() => setParsed(null)}
                        >
                            重新粘贴
                        </Button>
                        <Button
                            className="flex-1 h-11 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
                            onClick={handleConfirm}
                        >
                            <Sparkles className="h-4 w-4" />
                            确认录入
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
