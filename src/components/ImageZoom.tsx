"use client";

import { useEffect, useRef, useState } from "react";

const MIN = 1;
const MAX = 6;

function clamp(value: number) {
  return Math.min(MAX, Math.max(MIN, value));
}

// صورة قابلة للتكبير: عجلة الماوس، أزرار + و−، نقرتان للتبديل، سحب للتحريك، وقرص بالإصبعين
export default function ImageZoom({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  function setZoomLevel(next: number) {
    const value = clamp(next);
    setZoom(value);
    if (value === 1) setPan({ x: 0, y: 0 });
  }

  // The wheel has to be a non-passive listener, or the page behind scrolls while zooming.
  useEffect(() => {
    const node = frame.current;
    if (!node) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      setZoom((current) => {
        const next = clamp(current * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(event: React.PointerEvent) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    } else {
      drag.current = { x: event.clientX, y: event.clientY };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      setZoomLevel(pinch.current.zoom * (distance / pinch.current.distance));
      return;
    }

    if (drag.current && zoom > 1) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      drag.current = { x: event.clientX, y: event.clientY };
      setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
  }

  const button: React.CSSProperties = {
    width: 36,
    height: 36,
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    borderRadius: 6,
    border: "1px solid #ddd",
    background: "#fff",
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        ref={frame}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setZoomLevel(zoom > 1 ? 1 : 2.5)}
        style={{
          width: "100%",
          height: "72vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
          cursor: zoom > 1 ? "grab" : "zoom-in",
          userSelect: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: pointers.current.size > 0 ? "none" : "transform 0.12s",
          }}
        />
      </div>

      <div
        dir="ltr"
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          alignItems: "center",
          background: "rgba(255,255,255,0.92)",
          padding: 6,
          borderRadius: 8,
          boxShadow: "0 1px 6px rgba(0,0,0,0.2)",
        }}
      >
        <button type="button" style={button} onClick={() => setZoomLevel(zoom / 1.4)} aria-label="تصغير">
          −
        </button>
        <button
          type="button"
          style={{ ...button, width: 64, fontSize: 14 }}
          onClick={() => setZoomLevel(1)}
          aria-label="إعادة الحجم"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" style={button} onClick={() => setZoomLevel(zoom * 1.4)} aria-label="تكبير">
          +
        </button>
      </div>
    </div>
  );
}
