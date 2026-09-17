import { useMemo } from "react";

interface FlipCounterProps {
  value: number;
  large?: boolean;
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function OdometerDigit({ digit, large }: { digit: string; large?: boolean }) {
  const n = DIGITS.indexOf(digit);
  const cellH = large ? 150 : 90;
  return (
    <div
      className={`flip-digit ${large ? "flip-digit-large" : ""}`}
      style={{ ["--cell-h" as string]: `${cellH}px` }}
    >
      <div
        className="flip-digit-roll"
        style={{ transform: `translateY(calc(-${n} * var(--cell-h)))` }}
      >
        {DIGITS.map((d) => (
          <div key={d} className="flip-digit-cell">{d}</div>
        ))}
      </div>
    </div>
  );
}

export function FlipCounter({ value, large }: FlipCounterProps) {
  const chars = useMemo(() => value.toLocaleString("en-US").split(""), [value]);

  return (
    <div className="flip-counter flex max-w-full items-center justify-center gap-1.5">
      {chars.map((c, i) =>
        c === "," ? (
          <span key={`sep-${i}`} className="text-white/50 text-2xl mx-0.5 font-mono">,</span>
        ) : (
          <OdometerDigit key={`pos-${chars.length - i}`} digit={c} large={large} />
        )
      )}
    </div>
  );
}
