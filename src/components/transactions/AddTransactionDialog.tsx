import { useState } from "react"
import { Keyboard, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { TransactionForm } from "./TransactionForm"
import { AiImportFlow } from "./AiImportFlow"

interface AddTransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AddTransactionDialog({ open, onOpenChange }: AddTransactionDialogProps) {
    const [addMode, setAddMode] = useState<'choice' | 'manual' | 'ai'>('choice')
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && (addMode === 'manual' || addMode === 'ai')) {
            setIsDiscardConfirmOpen(true)
            return
        }
        onOpenChange(nextOpen)
        if (nextOpen) setAddMode('choice')
    }

    const handleSuccess = () => {
        onOpenChange(false)
        setAddMode('choice')
    }

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {addMode === 'manual' ? 'Record Transaction' : addMode === 'ai' ? 'AI-Assisted Import' : 'Add Transaction'}
                        </DialogTitle>
                        {addMode === 'choice' && (
                            <DialogDescription>
                                Choose how you want to add your trade records.
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {addMode === 'choice' ? (
                        <div className="grid grid-cols-1 gap-3 py-4">
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col items-center justify-center gap-2 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                                onClick={() => setAddMode('manual')}
                            >
                                <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                    <Keyboard className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="font-semibold text-sm">Manual Entry</span>
                                    <span className="text-xs text-muted-foreground">Type trade details manually</span>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-20 flex flex-col items-center justify-center gap-2 border-2 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
                                onClick={() => setAddMode('ai')}
                            >
                                <div className="p-2 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                                    <Sparkles className="h-5 w-5 text-amber-500" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="font-semibold text-sm">AI-Assisted Import</span>
                                    <span className="text-xs text-muted-foreground">Use a prompt to let AI parse your screenshot</span>
                                </div>
                            </Button>
                        </div>
                    ) : addMode === 'ai' ? (
                        <AiImportFlow onSuccess={handleSuccess} />
                    ) : (
                        <TransactionForm onSuccess={handleSuccess} />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isDiscardConfirmOpen} onOpenChange={setIsDiscardConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Discard Changes?</DialogTitle>
                        <DialogDescription className="pt-2">
                            You have unsaved data in the form. Are you sure you want to close without saving?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setIsDiscardConfirmOpen(false)}>Keep Editing</Button>
                        <Button variant="destructive" onClick={() => { setIsDiscardConfirmOpen(false); onOpenChange(false); setAddMode('choice') }}>Discard</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
