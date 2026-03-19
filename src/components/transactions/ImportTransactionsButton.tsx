import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useTransactionStore } from "@/store/useTransactionStore"
import { Upload, Loader2, AlertTriangle } from "lucide-react"
import * as xlsx from "xlsx"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

interface ImportTransactionsButtonProps {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
    iconOnly?: boolean;
    children?: React.ReactNode;
}

export function ImportTransactionsButton({ variant = "outline", size, className, iconOnly, children }: ImportTransactionsButtonProps) {
    const [isImporting, setIsImporting] = useState(false)
    const [showUnavailableDialog, setShowUnavailableDialog] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const bulkAddTransactions = useTransactionStore(state => state.bulkAddTransactions)

    const handleImportClick = () => {
        setShowUnavailableDialog(true)
    }

    const processExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsImporting(true)

        try {
            const data = await file.arrayBuffer()
            const workbook = xlsx.read(data)
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const rows = xlsx.utils.sheet_to_json<any>(worksheet, { header: 1 }) // Use array of arrays to preserve exact ordering

            if (rows.length < 2) {
                alert("No data found in the provided Excel file.");
                return;
            }

            // Assume the first row is always headers, e.g. ["委托时间", "订单号", "交易对", "基准货币", "计价货币", "类型", "委托价格", "委托数量", "成交均价 ", "成交量", "成交额", "触发条件", "状态"]
            const ordersMap = new Map<string, any>();

            // Start iterating from row index 1.
            // In Binance exports, actual orders have a length usually > 5 and include trade details.
            // Child trades typically are placed immediately after, and have a different column structure.
            let currentOrderId = null;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                // Check if this row is a Main Order row based on row length and presence of 'BUY'/'SELL'
                // Main order rows typically have the 'Type' (BUY or SELL) at index 5.
                if (row.length >= 10 && (row[5] === 'BUY' || row[5] === 'SELL')) {
                    currentOrderId = row[1]; // 订单号 is at index 1
                    ordersMap.set(currentOrderId, {
                        id: currentOrderId.toString(), // Explicitly bind Binance Order Id
                        orderId: currentOrderId.toString(),
                        date: new Date(row[0]).getTime(), // 委托时间
                        symbol: row[2], // BTC/USDT (Keep the slash as requested)
                        type: row[5],
                        price: parseFloat(row[8] || row[6]), // 成交均价 is at index 8, fallback to 委托价格 at 6
                        quantity: parseFloat(row[9] || row[7]), // 成交量 at 9, fallback to 委托数量 at 7
                        amount: parseFloat(row[10]), // 成交额
                        fee: 0, // Will be aggregated from child rows
                    });
                }
                // Check if this row is a Trade (child) row. 
                // Trade rows come under a header like ["委托时间", "订单号", "交易对", "基准货币", "计价货币"] 
                // but actually their data aligns functionally.
                else if (currentOrderId && row.length >= 4 && typeof row[4] === 'string' && (row[4].includes('USDT') || row[4].includes('BNB') || row[4].includes('BTC') || row[4].includes('ETH'))) {
                    // Extract the generic numeric fee from the string, e.g. "7.099898USDT" -> 7.099898
                    const feeString = row[4];
                    const numMatch = feeString.match(/([\d.]+)/);
                    if (numMatch && numMatch[1]) {
                        const feeValue = parseFloat(numMatch[1]);
                        const order = ordersMap.get(currentOrderId);
                        if (order) {
                            order.fee += feeValue;
                        }
                    }
                }
            }

            const transactionsToInsert = Array.from(ordersMap.values()) as any;

            if (transactionsToInsert.length > 0) {
                const importedIds = await bulkAddTransactions(transactionsToInsert);
                if (importedIds.length > 0) {
                    alert(`Successfully imported ${importedIds.length} new transactions! (${transactionsToInsert.length - importedIds.length} skipped as duplicates)`);
                } else {
                    alert(`All ${transactionsToInsert.length} transactions were already present in your portfolio. Skipped duplicates.`);
                }
            } else {
                alert("No valid transactions could be parsed from the file. Please ensure it is a valid Binance export.");
            }

        } catch (error) {
            console.error(error);
            alert("Error parsing the file. Please try again.");
        } finally {
            setIsImporting(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                onChange={processExcel}
                accept=".xlsx, .xls, .csv"
                className="hidden"
            />
            <Button
                variant={variant}
                size={size}
                className={className || (iconOnly ? "" : "gap-2")}
                onClick={handleImportClick}
                disabled={isImporting}
                title="Import Binance Excel"
            >
                {children ? children : (
                    <>
                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {!iconOnly && "Import Binance Excel"}
                    </>
                )}
            </Button>

            <Dialog open={showUnavailableDialog} onOpenChange={setShowUnavailableDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            功能暂不可用
                        </DialogTitle>
                        <DialogDescription className="pt-2 text-sm leading-relaxed">
                            Binance 导出文件格式已发生变化，当前导入功能暂时无法正常解析。
                            <br /><br />
                            我们正在适配新格式，请稍后再试。感谢您的耐心等待。
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </>
    )
}
