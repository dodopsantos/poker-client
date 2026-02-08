"use client";

import React, { useMemo } from "react";

type Props = {
    amount: number;
    display?: string;
    isAllIn?: boolean;
    label?: string;
};

function stackCount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if (amount < 100) return 1;
    if (amount < 500) return 2;
    if (amount < 1500) return 3;
    return 4;
}

export function BetChipStack({ amount, display, isAllIn = false, label }: Props) {
    const n = useMemo(() => stackCount(amount), [amount]);
    if (n <= 0) return null;

    return (
        <div className={`betStack ${isAllIn ? "betStackAllIn" : ""}`} aria-label={label}>
            <div className="betStackChips">
                {Array.from({ length: n }).map((_, i) => (
                    <div key={i} className={`chip chip-${i + 1}`} />
                ))}
            </div>
            <div className="betStackValue">{display ?? amount}</div>
            {isAllIn && <div className="betStackBadge">ALL-IN</div>}
        </div>
    );
}
