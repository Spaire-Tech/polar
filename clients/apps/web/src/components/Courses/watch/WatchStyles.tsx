'use client'

// Shared styles for the Spaire Originals v2 watch experience — a literal
// port of originals2.css scoped under `.sov2` (overlay roots). The player
// is always dark; the sheets/panels follow the page theme via `.sov2.dark`.

export function WatchStyles() {
  return (
    <style jsx global>{`
      .sov2 {
        --bg: #ffffff;
        --band: 255, 255, 255;
        --bt: #1d1d1f;
        --bt2: rgba(0, 0, 0, 0.56);
        --bt3: rgba(0, 0, 0, 0.4);
        --text: #1d1d1f;
        --text-2: #86868b;
        --ink: #07080a;
        --blue: #0071e3;
        --hair: rgba(0, 0, 0, 0.12);
        --ans: #4a4a4f;
        --sf: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
          'SF Pro Text', system-ui, sans-serif;
        --po: 'Poppins', var(--font-poppins), -apple-system,
          BlinkMacSystemFont, system-ui, sans-serif;
        font-family: var(--sf);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        letter-spacing: -0.014em;
      }
      .sov2.dark {
        --bg: #141416;
        --band: 20, 20, 22;
        --bt: #f5f5f7;
        --bt2: rgba(245, 245, 247, 0.65);
        --bt3: rgba(245, 245, 247, 0.45);
        --text: #f5f5f7;
        --text-2: rgba(245, 245, 247, 0.6);
        --hair: rgba(245, 245, 247, 0.16);
        --ans: rgba(245, 245, 247, 0.78);
      }
      .sov2 button {
        font-family: inherit;
        cursor: pointer;
        border: none;
        background: none;
        color: inherit;
        padding: 0;
      }
      .sov2 *,
      .sov2 *::before,
      .sov2 *::after {
        box-sizing: border-box;
      }

      /* ════════ glass sheets (overview) ════════ */
      .sov2.sheet-overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(10, 10, 12, 0.4);
        -webkit-backdrop-filter: blur(22px) saturate(120%);
        backdrop-filter: blur(22px) saturate(120%);
        animation: sov2-ovIn 0.3s ease;
      }
      @keyframes sov2-ovIn {
        from {
          opacity: 0;
        }
      }
      .sov2 .x-sheet {
        width: min(560px, 100%);
        max-height: 100%;
        display: flex;
        flex-direction: column;
        border-radius: 28px;
        overflow: hidden;
        background: var(--bg);
        color: var(--text);
        box-shadow: 0 50px 100px rgba(0, 0, 0, 0.4),
          0 8px 28px rgba(0, 0, 0, 0.2);
        animation: sov2-sheetIn 0.42s cubic-bezier(0.2, 1, 0.3, 1);
      }
      .sov2 .x-sheet.wide {
        width: min(640px, 100%);
      }
      @keyframes sov2-sheetIn {
        from {
          transform: translateY(22px) scale(0.96);
        }
      }
      .sov2 .xs-cover {
        position: relative;
        flex: none;
        aspect-ratio: 16 / 8.4;
        overflow: hidden;
        background: #111;
      }
      .sov2 .xs-cover img,
      .sov2 .xs-cover .xs-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        background-size: cover;
        background-position: center;
      }
      .sov2 .xs-shade {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          0deg,
          rgba(5, 5, 8, 0.66) 0%,
          rgba(5, 5, 8, 0.24) 44%,
          transparent 70%
        );
      }
      .sov2 .xs-eyebrow {
        position: absolute;
        top: 20px;
        left: 24px;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 8px;
        color: rgba(255, 255, 255, 0.9);
        font-family: var(--po);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }
      .sov2 .xs-eyebrow .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #e0482e;
      }
      .sov2 .xs-title {
        position: absolute;
        left: 24px;
        right: 70px;
        bottom: 16px;
        z-index: 2;
        font-family: var(--po);
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -0.025em;
        line-height: 1.08;
        color: #fff;
      }
      .sov2 .xs-titlesub {
        font-family: var(--sf);
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.78);
        margin-top: 4px;
        letter-spacing: -0.01em;
      }
      .sov2 .xs-close {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 3;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(10, 11, 13, 0.46);
        color: #fff;
        -webkit-backdrop-filter: blur(14px) saturate(150%);
        backdrop-filter: blur(14px) saturate(150%);
        display: grid;
        place-items: center;
        transition: background 0.18s, transform 0.16s;
      }
      .sov2 .xs-close:hover {
        background: rgba(40, 40, 46, 0.7);
        transform: scale(1.06);
      }
      .sov2 .xs-close:active {
        transform: scale(0.92);
      }
      .sov2 .xs-body {
        overflow-y: auto;
        overscroll-behavior: contain;
        min-height: 0;
        padding: 26px 32px 32px;
      }

      .sov2 .cta-main {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        width: 100%;
        height: 50px;
        border-radius: 980px;
        background: var(--text);
        color: var(--bg);
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.01em;
        transition: transform 0.16s, opacity 0.16s, background 0.4s ease,
          color 0.4s ease;
      }
      .sov2 .cta-main:hover {
        opacity: 0.88;
        transform: scale(1.02);
      }
      .sov2 .cta-main:active {
        transform: scale(0.97);
      }
      .sov2 .icon-glass {
        position: relative;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(var(--band), 0.55);
        color: var(--bt);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        backdrop-filter: blur(20px) saturate(160%);
        box-shadow: inset 0 0 0 1px var(--bt3);
        display: grid;
        place-items: center;
        transition: background 0.18s, transform 0.16s, color 0.4s ease;
      }
      .sov2 .icon-glass:hover {
        transform: scale(1.06);
      }
      .sov2 .icon-glass:active {
        transform: scale(0.94);
      }
      .sov2.dark .icon-glass {
        background: rgba(255, 255, 255, 0.14);
        box-shadow: none;
        color: #fff;
      }
      .sov2 .icon-glass.on {
        background: var(--bt);
        color: var(--bg);
        box-shadow: none;
      }

      /* overview sheet internals */
      .sov2 .ov-chips {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 26px;
      }
      .sov2 .ov-chips .cta-main {
        flex: 1;
        width: auto;
      }
      .sov2 .ov-chips .icon-glass {
        flex: none;
      }
      .sov2 .ov-h {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-2);
        margin: 26px 0 12px;
      }
      .sov2 .ov-h:first-child {
        margin-top: 0;
      }
      .sov2 .ov-p {
        font-size: 15px;
        line-height: 1.6;
        color: var(--ans);
        transition: color 0.4s ease;
      }
      .sov2 .ov-p + .ov-p {
        margin-top: 12px;
      }
      .sov2 .ov-learn {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 0;
        padding: 0;
      }
      .sov2 .ov-learn li {
        position: relative;
        padding-left: 18px;
        font-size: 14.5px;
        line-height: 1.45;
        color: var(--ans);
      }
      .sov2 .ov-learn li::before {
        content: '';
        position: absolute;
        left: 2px;
        top: 0.58em;
        width: 4.5px;
        height: 4.5px;
        border-radius: 50%;
        background: var(--text-2);
      }
      .sov2 .ov-res {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sov2 .ov-res-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 13px 16px;
        border-radius: 14px;
        background: rgba(125, 125, 135, 0.1);
        text-align: left;
        transition: background 0.15s;
        text-decoration: none;
        color: inherit;
      }
      .sov2 .ov-res-row:hover {
        background: rgba(125, 125, 135, 0.18);
      }
      .sov2.dark .ov-res-row {
        background: rgba(255, 255, 255, 0.07);
      }
      .sov2.dark .ov-res-row:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .sov2 .ov-res-ico {
        flex: none;
        color: var(--text-2);
        display: grid;
        place-items: center;
      }
      .sov2 .ov-res-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .sov2 .ov-res-main .rn {
        font-size: 14.5px;
        font-weight: 600;
        color: var(--text);
      }
      .sov2 .ov-res-main .rm {
        font-size: 12.5px;
        color: var(--text-2);
      }
      .sov2 .ov-res-dl {
        color: var(--text-2);
      }

      /* ════════ player (always dark) ════════ */
      .sov2.player {
        position: fixed;
        inset: 0;
        z-index: 300;
        background: #000;
        color: #fff;
        letter-spacing: -0.01em;
      }
      .sov2 .player-video {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
      }
      .sov2 .player-video video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
      }
      .sov2 .player-vignette {
        position: absolute;
        inset: 0;
        pointer-events: none;
        transition: opacity 0.35s ease;
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.55) 0%,
          transparent 24%,
          transparent 60%,
          rgba(0, 0, 0, 0.78) 100%
        );
      }

      /* Idle chrome fades away while the video plays; any interaction
         (handled in WatchPlayer) brings it back. */
      .sov2.player.ui-hidden {
        cursor: none;
      }
      .sov2.player.ui-hidden .player-top,
      .sov2.player.ui-hidden .player-controls,
      .sov2.player.ui-hidden .player-vignette {
        opacity: 0;
        pointer-events: none;
      }
      .sov2 .pbtn {
        position: relative;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.14);
        color: #fff;
        -webkit-backdrop-filter: blur(40px) saturate(150%);
        backdrop-filter: blur(40px) saturate(150%);
        display: grid;
        place-items: center;
        transition: background 0.18s, transform 0.16s;
      }
      .sov2 .pbtn:hover {
        background: rgba(255, 255, 255, 0.26);
        transform: scale(1.05);
      }
      .sov2 .pbtn:active {
        transform: scale(0.93);
      }
      .sov2 .pbtn.big {
        width: 64px;
        height: 64px;
      }
      .sov2 .pbtn.sm {
        width: 44px;
        height: 44px;
      }
      .sov2 .pbtn.on {
        background: rgba(255, 255, 255, 0.92);
        color: #0b0b0d;
      }
      .sov2 .pbtn-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        min-width: 17px;
        height: 17px;
        padding: 0 5px;
        border-radius: 980px;
        background: var(--blue);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        line-height: 17px;
      }
      .sov2 .player-top {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 26px 36px;
        transition: opacity 0.35s ease;
      }
      .sov2 .player-title {
        flex: 1;
        min-width: 0;
      }
      .sov2 .pt-k {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.66);
      }
      .sov2 .pt-t {
        font-size: 17px;
        font-weight: 600;
        margin-top: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sov2 .player-top-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sov2 .pchip {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: 4px 9px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.14);
        color: rgba(255, 255, 255, 0.85);
        -webkit-backdrop-filter: blur(14px);
        backdrop-filter: blur(14px);
      }
      .sov2 .player-bigplay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 4;
        width: 96px;
        height: 96px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.16);
        color: #fff;
        -webkit-backdrop-filter: blur(30px) saturate(150%);
        backdrop-filter: blur(30px) saturate(150%);
        display: grid;
        place-items: center;
        padding-left: 6px;
        transition: background 0.2s, transform 0.16s;
      }
      .sov2 .player-bigplay:hover {
        background: rgba(255, 255, 255, 0.28);
        transform: translate(-50%, -50%) scale(1.05);
      }
      .sov2 .player-controls {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 5;
        padding: 0 36px 28px;
        transition: opacity 0.35s ease;
      }
      .sov2 .scrub-row {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .sov2 .ptime {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.85);
        font-variant-numeric: tabular-nums;
        min-width: 44px;
      }
      .sov2 .ptime:last-child {
        text-align: right;
      }
      .sov2 .scrub {
        flex: 1;
        padding: 10px 0;
        cursor: pointer;
      }
      .sov2 .scrub-track {
        position: relative;
        height: 5px;
        border-radius: 980px;
        background: rgba(255, 255, 255, 0.22);
      }
      .sov2 .scrub-buf {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 980px;
        background: rgba(255, 255, 255, 0.18);
      }
      .sov2 .scrub-fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 980px;
        background: #fff;
      }
      .sov2 .scrub-knob {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      }
      .sov2 .transport {
        display: flex;
        align-items: center;
        margin-top: 8px;
      }
      .sov2 .tp-left {
        flex: 1;
        min-width: 0;
      }
      .sov2 .tp-chaplabel {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.66);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sov2 .tp-center {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .sov2 .tp-right {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
      }
      .sov2 .player-cc {
        position: absolute;
        left: 50%;
        bottom: 200px;
        transform: translateX(-50%);
        z-index: 4;
        max-width: 70%;
        background: rgba(0, 0, 0, 0.72);
        color: #fff;
        font-size: 22px;
        font-weight: 500;
        padding: 10px 20px;
        border-radius: 10px;
      }

      /* ════════ discussion panel ════════ */
      .sov2.cmt-overlay {
        position: fixed;
        inset: 0;
        z-index: 400;
        display: flex;
        justify-content: flex-end;
        background: rgba(8, 8, 10, 0.3);
        animation: sov2-ovIn 0.25s ease;
      }
      .sov2 .cmt-panel {
        width: min(420px, 92vw);
        height: 100%;
        display: flex;
        flex-direction: column;
        background: rgba(var(--band), 0.88);
        color: var(--text);
        -webkit-backdrop-filter: blur(40px) saturate(150%);
        backdrop-filter: blur(40px) saturate(150%);
        box-shadow: -20px 0 60px rgba(0, 0, 0, 0.3);
        animation: sov2-panelIn 0.4s cubic-bezier(0.2, 1, 0.3, 1);
      }
      @keyframes sov2-panelIn {
        from {
          transform: translateX(60px);
          opacity: 0;
        }
      }
      .sov2 .cmt-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 24px 24px 12px;
      }
      .sov2 .cmt-h-title {
        font-size: 19px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .sov2 .cmt-h-sub {
        font-size: 13px;
        color: var(--text-2);
        margin-top: 2px;
      }
      .sov2 .cmt-x {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        flex: none;
        background: rgba(125, 125, 135, 0.16);
        color: var(--text);
        display: grid;
        place-items: center;
        transition: background 0.15s, transform 0.15s;
      }
      .sov2 .cmt-x:hover {
        background: rgba(125, 125, 135, 0.28);
      }
      .sov2 .cmt-x:active {
        transform: scale(0.92);
      }
      .sov2 .cmt-count {
        padding: 0 24px 10px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-2);
        border-bottom: 1px solid var(--hair);
      }
      .sov2 .cmt-list {
        flex: 1;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .sov2 .cmt {
        display: flex;
        gap: 12px;
      }
      .sov2 .cmt-av {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
        flex: none;
        background: rgba(125, 125, 135, 0.2);
      }
      .sov2 .cmt-av.sm {
        width: 32px;
        height: 32px;
      }
      .sov2 .cmt-main {
        flex: 1;
        min-width: 0;
      }
      .sov2 .cmt-top {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sov2 .cmt-name {
        font-size: 13.5px;
        font-weight: 600;
      }
      .sov2 .cmt-dot {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: var(--text-2);
      }
      .sov2 .cmt-time {
        font-size: 12px;
        color: var(--text-2);
      }
      .sov2 .cmt-text {
        font-size: 14px;
        line-height: 1.5;
        color: var(--ans);
        margin-top: 4px;
      }
      .sov2 .cmt-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-top: 7px;
      }
      .sov2 .cmt-like {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--text-2);
        transition: color 0.15s;
      }
      .sov2 .cmt-like.on {
        color: #e0482e;
      }
      .sov2 .cmt-reply {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--text-2);
      }
      .sov2 .cmt-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        text-align: center;
        color: var(--text-2);
        font-size: 14px;
        padding: 48px 20px;
      }
      .sov2 .ce-ico {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(125, 125, 135, 0.14);
        display: grid;
        place-items: center;
      }
      .sov2 .cmt-compose {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid var(--hair);
      }
      .sov2 .cmt-compose input {
        flex: 1;
        height: 40px;
        padding: 0 16px;
        border-radius: 980px;
        border: none;
        outline: none;
        background: rgba(125, 125, 135, 0.14);
        color: var(--text);
        font-family: var(--sf);
        font-size: 14px;
      }
      .sov2 .cmt-compose input::placeholder {
        color: var(--text-2);
      }
      .sov2 .cmt-send {
        color: var(--blue);
        display: grid;
        place-items: center;
        padding: 6px;
      }
      .sov2 .cmt-send:disabled {
        color: var(--text-2);
        opacity: 0.5;
        cursor: default;
      }

      /* ── discussion: threading + instructor moderation ── */
      .sov2 .cmt-pinned {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-2);
        margin-bottom: 3px;
      }
      .sov2 .cmt-badge {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 2px 7px;
        border-radius: 980px;
        background: rgba(125, 125, 135, 0.18);
        color: var(--text);
      }
      .sov2 .cmt-name.is-instructor {
        color: var(--blue);
      }
      .sov2 .cmt-cheart {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--text-2);
      }
      .sov2 .cmt-cheart:disabled {
        cursor: default;
      }
      .sov2 .cmt-cheart-ico {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(125, 125, 135, 0.16);
        display: grid;
        place-items: center;
      }
      .sov2 .cmt-cheart.on .cmt-cheart-ico {
        background: rgba(224, 72, 46, 0.14);
      }
      .sov2 .cmt-mod {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-2);
        transition: color 0.15s;
      }
      .sov2 .cmt-mod:hover {
        color: var(--text);
      }
      .sov2 .cmt-mod.on {
        color: var(--blue);
      }
      .sov2 .cmt-mod.danger:hover {
        color: #e0482e;
      }
      .sov2 .cmt-replies {
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding-left: 2px;
        border-left: 2px solid var(--hair);
      }
      .sov2 .cmt.is-reply {
        padding-left: 12px;
      }
      .sov2 .cmt.is-reply .cmt-av {
        width: 26px;
        height: 26px;
      }
      .sov2 .cmt-compose-wrap {
        border-top: 1px solid var(--hair);
      }
      .sov2 .cmt-compose-wrap .cmt-compose {
        border-top: none;
      }
      .sov2 .cmt-replying {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 24px 0;
        font-size: 12px;
        color: var(--text-2);
      }
      .sov2 .cmt-replying strong {
        color: var(--text);
        font-weight: 600;
      }
      .sov2 .cmt-replying-x {
        margin-left: 4px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgba(125, 125, 135, 0.16);
        color: var(--text);
        display: grid;
        place-items: center;
      }

      @media (max-width: 820px) {
        .sov2 .player-top {
          padding: 18px 20px;
        }
        .sov2 .player-controls {
          padding: 0 20px 22px;
        }
        .sov2 .xs-body {
          padding: 24px 22px 28px;
        }
      }
    `}</style>
  )
}

export default WatchStyles
