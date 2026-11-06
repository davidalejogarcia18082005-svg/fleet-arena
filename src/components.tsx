import { useEffect, useRef, type ReactNode } from "react";
import { Crosshair, X, Ship, Waves } from "lucide-react";
import type { FleetShip, Shot } from "./types";
import { coordinate, SHIPS } from "./game";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function FleetIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 23h28l-6 9H13L6 23Z" fill="currentColor" />
      <path d="M17 8h7v13h-7zM11 16h20v5H11z" fill="currentColor" />
      <path d="M6 36q5-3 10 0t10 0t9 0" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
export function TacticalArt() {
  return (
    <div
      className="tactical-art"
      aria-label="Ilustración de un tablero de batalla naval"
    >
      <div className="map-meta">
        <span>SECTOR 07 / PACÍFICO</span>
        <span>10 × 10</span>
      </div>
      <svg
        viewBox="0 0 440 330"
        role="img"
        aria-label="Flota desplegada sobre una cuadrícula táctica"
      >
        <defs>
          <pattern
            id="ocean-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M32 0H0V32"
              fill="none"
              stroke="#9fc9ba"
              strokeOpacity=".13"
            />
          </pattern>
          <radialGradient id="radar">
            <stop stopColor="#a5e884" stopOpacity=".14" />
            <stop offset="1" stopColor="#a5e884" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="55" y="5" width="320" height="320" fill="url(#ocean-grid)" />
        <circle cx="245" cy="158" r="140" fill="url(#radar)" />
        {[54, 94, 134].map((r) => (
          <circle
            key={r}
            cx="245"
            cy="158"
            r={r}
            fill="none"
            stroke="#a9df92"
            strokeOpacity=".12"
            strokeDasharray={r === 94 ? "3 7" : undefined}
          />
        ))}
        <path
          d="M55 39V5h34M341 5h34v34M375 291v34h-34M89 325H55v-34"
          stroke="#89b490"
          opacity=".65"
          fill="none"
        />
        <g transform="translate(87 45) rotate(90 58 19)">
          <path d="M0 5L99 5l20 14-20 14H0Z" fill="#7ba98f" stroke="#c3e5ba" />
          <rect x="14" y="10" width="62" height="18" rx="2" fill="#24473c" />
          <path d="M28 10v18m17-18v18m17-18v18" stroke="#7ba98f" />
          <rect x="83" y="13" width="16" height="12" fill="#cee6bd" />
        </g>
        <g transform="translate(215 174)">
          <path d="M0 3h113l24 16-24 16H0Z" fill="#b9ee86" />
          <rect x="13" y="9" width="72" height="20" rx="2" fill="#4d7755" />
          <path d="M26 9v20m20-20v20m20-20v20" stroke="#b9ee86" />
          <path d="M93 13h17l8 6-8 6H93Z" fill="#e0f5bf" />
        </g>
        <g transform="translate(87 266)">
          <path d="M0 5h66l20 14-20 14H0Z" fill="#6d9b89" />
          <rect x="12" y="10" width="42" height="18" fill="#25483d" />
        </g>
        {[
          { x: 247, y: 78 },
          { x: 183, y: 142 },
          { x: 311, y: 270 },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <circle
              r="7"
              stroke={i === 1 ? "#ed926e" : "#76aa98"}
              fill="none"
            />
            <path
              d="M-3-3l6 6m0-6l-6 6"
              stroke={i === 1 ? "#ed926e" : "#76aa98"}
            />
          </g>
        ))}
        <g transform="translate(245 158)" stroke="#c3e8a0" opacity=".5">
          <path d="M-8 0H8M0-8V8" />
          <circle r="17" fill="none" strokeDasharray="3 4" />
        </g>
        {"ABCDEFGHIJ".split("").map((a, i) => (
          <text
            key={a}
            x="37"
            y={26 + i * 32}
            fill="#75948d"
            fontSize="9"
            fontFamily="monospace"
          >
            {a}
          </text>
        ))}
      </svg>
      <div className="map-foot">
        <span>
          <i /> FLOTA EN POSICIÓN
        </span>
        <span>VISTA DEL TABLERO</span>
      </div>
    </div>
  );
}
export function Board({
  ships = [],
  shots = [],
  onCell,
  onHover,
  selected = null,
  preview = [],
  invalid = false,
  label,
  target = false,
}: {
  ships?: FleetShip[];
  shots?: Shot[];
  onCell?: (cell: number) => void;
  onHover?: (cell: number | null) => void;
  selected?: number | null;
  preview?: number[];
  invalid?: boolean;
  label: string;
  target?: boolean;
}) {
  const occupied = new Map(
    ships.flatMap((s) => s.cells.map((c) => [c, s.id] as const)),
  );
  const shotMap = new Map(shots.map((s) => [s.cell, s]));
  return (
    <div
      className={`board ${target ? "target-board" : ""}`}
      aria-label={label}
      onMouseLeave={() => onHover?.(null)}
    >
      <span className="axis" />
      {Array.from({ length: 10 }, (_, i) => (
        <span className="axis" key={`h${i}`}>
          {i + 1}
        </span>
      ))}
      {Array.from({ length: 10 }, (_, r) => (
        <div className="board-row" key={r}>
          <span className="axis">{"ABCDEFGHIJ"[r]}</span>
          {Array.from({ length: 10 }, (_, c) => {
            const cell = r * 10 + c,
              shot = shotMap.get(cell),
              ship = occupied.get(cell),
              inPreview = preview.includes(cell);
            return (
              <button
                key={cell}
                className={`cell ${ship ? "has-ship" : ""} ${shot?.result ?? ""} ${selected === cell ? "selected" : ""} ${inPreview ? (invalid ? "invalid-preview" : "placement-preview") : ""}`}
                disabled={!onCell || !!shot}
                aria-label={`${coordinate(cell)}${shot ? `: ${shot.result === "miss" ? "agua" : shot.result === "sunk" ? "hundido" : "impacto"}` : ship ? `: ${SHIPS.find((s) => s.id === ship)?.name}` : ""}`}
                onClick={() => onCell?.(cell)}
                onMouseEnter={() => onHover?.(cell)}
                onFocus={() => onHover?.(cell)}
              >
                {shot ? (
                  shot.result === "miss" ? (
                    <span className="water-dot" />
                  ) : (
                    <X size={18} strokeWidth={2.2} />
                  )
                ) : selected === cell ? (
                  <Crosshair size={20} />
                ) : ship ? (
                  <span className="ship-deck" />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
export function FleetStatus({
  ships,
  shots,
}: {
  ships: FleetShip[];
  shots: Shot[];
}) {
  const hit = new Set(
    shots.filter((s) => s.result !== "miss").map((s) => s.cell),
  );
  return (
    <div className="fleet-status">
      {SHIPS.map((def) => {
        const ship = ships.find((s) => s.id === def.id),
          sunk = ship
            ? ship.cells.every((c) => hit.has(c))
            : shots.some((s) => s.sunk_ship === def.id);
        return (
          <div
            key={def.id}
            className={sunk ? "ship-status sunk" : "ship-status"}
            title={`${def.name}${sunk ? " · Hundido" : ""}`}
          >
            <div className="ship-segments">
              {Array.from({ length: def.size }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <span>{def.name}</span>
            {sunk && <X size={13} />}
          </div>
        );
      })}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Waves size={27} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
