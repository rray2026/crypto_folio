export interface Transaction {
    id: string;
    date: number; // Unix timestamp in ms
    symbol: string; // e.g., "BTC/USDT"
    type: "BUY" | "SELL";
    price: number;
    quantity: number;
    amount: number; // total value = price * quantity
    fee: number;
    associatedPositionIds: string[];
    notes?: string;
}

export interface PositionEntry {
    transactionId: string;
    allocatedAmount: number;
}

export interface PositionJournal {
    entryReason?: string;
    exitReason?: string;
    moodScore?: number; // 1 to 5
    reviewNotes?: string;
}

export interface Position {
    id: string;
    symbol: string;
    strategyName?: string;
    status: "OPEN" | "CLOSED";
    entries: PositionEntry[];
    journal?: PositionJournal;
    notes?: string;
    startDate: number; // Unix timestamp
    endDate?: number; // Unix timestamp
}
