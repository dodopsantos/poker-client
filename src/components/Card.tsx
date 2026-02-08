"use client";

import React, { useMemo, useState } from "react";

type Props = {
    code?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
    faceDown?: boolean;
    title?: string;
};

function normalize(code?: string) {
    if (!code) return null;
    const c = String(code).trim().toUpperCase();
    if (c.length < 2) return null;
    const rank = c.slice(0, -1);
    const suit = c.slice(-1);
    const r = rank === "10" ? "T" : rank;
    if (!"AKQJT98765432".includes(r)) return null;
    if (!"SHDC".includes(suit)) return null;
    return `${r}${suit}`;
}

export function Card({ code, size = "md", className = "", faceDown = false, title }: Props) {
    const [imgOk, setImgOk] = useState(true);

    const normalized = useMemo(() => normalize(code), [code]);
    const src = faceDown ? "/cards/BACK.svg" : normalized ? `/cards/${normalized}.svg` : null;

    const szClass = size === "sm" ? "cardImgSm" : size === "lg" ? "cardImgLg" : "cardImgMd";

    if (!src || !imgOk) {
        return (
            <div className={`pokerCard ${size === "sm" ? "pokerCardSmall" : ""} ${className}`} title={title}>
                {faceDown ? "🂠" : normalized ?? "??"}
            </div>
        );
    }

    return (
        <img
            className={`cardImg ${szClass} ${className}`}
            src={src}
            alt={faceDown ? "Card back" : normalized}
            title={title}
            draggable={false}
            onError={() => setImgOk(false)}
        />
    );
}
