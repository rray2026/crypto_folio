export interface Transaction {
    id: string;
    date: number; // Unix timestamp in ms
    symbol: string; // e.g., "BTC/USDT"
    type: "BUY" | "SELL";
    price: number;
    quantity: number;
    amount: number; // total value = price * quantity
    fee: number;
    orderId?: string;
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
    type: 'PRIMARY' | 'SHADOW';
    status: "OPEN" | "CLOSED";
    entries: PositionEntry[];
    journal?: PositionJournal;
    notes?: string;
    startDate: number; // Unix timestamp
    endDate?: number; // Unix timestamp
    fundId?: string; // optional: which Fund this position belongs to
}

export interface Fund {
    id: string;
    name: string;
    description?: string;
    initialAmount: number;   // starting capital, e.g. 10000
    initialShares: number;   // units issued, e.g. 100 → initial NAV = 100 USDT/share
    currency: string;        // default "USDT"
    createdAt: number;       // Unix timestamp ms
    status: 'ACTIVE' | 'CLOSED';
}
