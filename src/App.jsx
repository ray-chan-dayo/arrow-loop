import React, { useCallback, useEffect, useMemo, useState } from "react";

const SIZE = 16;
const EMPTY = " ";
const CENTER = Object.freeze({ x: 7, y: 7 });

const DIRECTIONS = {
  ArrowUp: { glyph: "↑", dx: 0, dy: -1, label: "上" },
  w: { glyph: "↑", dx: 0, dy: -1, label: "上" }, W: { glyph: "↑", dx: 0, dy: -1, label: "上" },
  ArrowDown: { glyph: "↓", dx: 0, dy: 1, label: "下" },
  s: { glyph: "↓", dx: 0, dy: 1, label: "下" }, S: { glyph: "↓", dx: 0, dy: 1, label: "下" },
  ArrowLeft: { glyph: "←", dx: -1, dy: 0, label: "左" },
  a: { glyph: "←", dx: -1, dy: 0, label: "左" }, A: { glyph: "←", dx: -1, dy: 0, label: "左" },
  ArrowRight: { glyph: "→", dx: 1, dy: 0, label: "右" },
  d: { glyph: "→", dx: 1, dy: 0, label: "右" }, D: { glyph: "→", dx: 1, dy: 0, label: "右" },
};
const BY_GLYPH = Object.fromEntries(Object.values(DIRECTIONS).map((d) => [d.glyph, d]));

const makeBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
const cloneBoard = (board) => board.map((row) => [...row]);
const clonePath = (path) => path.map((step) => ({ position: { ...step.position }, direction: step.direction }));
const same = (a, b) => a.x === b.x && a.y === b.y;
const inside = ({ x, y }) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const opposite = (a, b) => Boolean(a) && a.dx + b.dx === 0 && a.dy + b.dy === 0;
const magnitudeFloor = (a, b) => Math.floor(Math.hypot(a.dx + b.dx, a.dy + b.dy));

function destinationAt(board, position) {
  const at = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE ? board[y][x] : EMPTY;
  let destination = "";
  if (at(position.x, position.y - 1) === "↑") destination += "↑";
  if (at(position.x + 1, position.y) === "→") destination += "→";
  if (at(position.x - 1, position.y) === "←") destination += "←";
  if (at(position.x, position.y + 1) === "↓") destination += "↓";
  if (destination.length !== 1) {
    throw new Error(`Multiple or no destination (${destination}) found at (${position.x}, ${position.y})`);
  }
  return BY_GLYPH[destination];
}

function reconstructPath(board, start, cursor) {
  const path = [];
  const visited = new Set();
  let position = { ...start };
  let direction = BY_GLYPH[board[start.y][start.x]];
  if (!direction) throw new Error("New start is not an arrow");

  for (let steps = 0; steps <= SIZE * SIZE; steps += 1) {
    if (same(position, cursor)) return path;
    if (!inside(position)) throw new Error("Reconstructed path went out of bounds");
    const key = `${position.x},${position.y}`;
    if (visited.has(key)) throw new Error(`Reconstructed path revisited (${key})`);
    visited.add(key);

    const cell = board[position.y][position.x];
    if (BY_GLYPH[cell]) {
      if (cell !== direction.glyph) throw new Error(`Invalid arrow: Turning implicitly at (${key})`);
    } else if (cell === "L") {
      const destination = destinationAt(board, position);
      const turnValue = magnitudeFloor(direction, destination);
      if (turnValue !== 1) throw new Error(`Invalid turn: ${90 * turnValue} degrees at (${key})`);
      direction = destination;
    } else {
      throw new Error(`Unknown operation: ${JSON.stringify(cell)} at (${key})`);
    }

    path.push({ position: { ...position }, direction });
    position = { x: position.x + direction.dx, y: position.y + direction.dy };
  }
  throw new Error("Traversal did not reach the cursor");
}

function rebuildHistory(retainedPath, newStart) {
  const history = [];
  let board = makeBoard();
  let path = [];
  let position = { ...newStart };
  let direction = null;
  let started = false;

  for (const step of retainedPath) {
    if (!same(step.position, position)) throw new Error(`Non-contiguous retained path at (${step.position.x}, ${step.position.y})`);
    history.push({ board: cloneBoard(board), path: clonePath(path), start: { ...newStart }, position: { ...position }, direction, started, completed: false, message: started ? "再構築された履歴" : "新しい開始地点", status: started ? "ok" : "idle" });
    const turns = direction !== null && direction.glyph !== step.direction.glyph;
    board[position.y][position.x] = turns ? "L" : step.direction.glyph;
    path = [...path, { position: { ...position }, direction: step.direction }];
    direction = step.direction;
    started = true;
    position = { x: position.x + direction.dx, y: position.y + direction.dy };
  }
  return { history, board, path, position, direction, started };
}

function countParts(board) {
  let arrows = 0, corners = 0;
  for (const row of board) for (const cell of row) {
    if (cell === "L") corners += 1;
    else if (BY_GLYPH[cell]) arrows += 1;
  }
  return { arrows, corners };
}

function validateLoop(board, start) {
  let position = { ...start };
  let direction = BY_GLYPH[board[start.y][start.x]];
  let first = true, score = 0, steps = 0;
  const visited = new Set();
  if (!direction) return { ok: false, message: "開始地点は矢印である必要があります" };

  while (first || !same(position, start)) {
    first = false;
    if (++steps > SIZE * SIZE) return { ok: false, message: "開始地点へ戻りません" };
    if (!inside(position)) return { ok: false, message: "フィールド外へ出ました" };
    const key = `${position.x},${position.y}`;
    if (visited.has(key)) return { ok: false, message: `開始地点以外を再訪しました: (${key})` };
    visited.add(key);
    const cell = board[position.y][position.x];
    if (BY_GLYPH[cell]) {
      if (cell !== direction.glyph) return { ok: false, message: `暗黙の方向転換: (${key})` };
      score += 1;
    } else if (cell === "L") {
      try {
        const destination = destinationAt(board, position);
        const turnValue = magnitudeFloor(direction, destination);
        if (turnValue !== 1) return { ok: false, message: `不正なL: (${key})` };
        direction = destination;
      } catch (error) {
        return { ok: false, message: error.message };
      }
    } else return { ok: false, message: `空白に到達: (${key})` };
    position = { x: position.x + direction.dx, y: position.y + direction.dy };
  }
  return { ok: true, message: `有効な閉路です。スコア ${score} 点、全長 ${steps} マス` };
}

export default function ArrowLoopGame() {
  const [board, setBoard] = useState(makeBoard);
  const [path, setPath] = useState([]);
  const [start, setStart] = useState({ ...CENTER });
  const [position, setPosition] = useState({ ...CENTER });
  const [direction, setDirection] = useState(null);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("開始マスをクリックするか、キーを押して開始");
  const [status, setStatus] = useState("idle");
  const counts = useMemo(() => countParts(board), [board]);

  const move = useCallback((nextDirection) => {
    if (completed) return;
    const next = { x: position.x + nextDirection.dx, y: position.y + nextDirection.dy };
    if (!inside(next)) { setStatus("error"); setMessage("フィールド外には進めません"); return; }
    if (opposite(direction, nextDirection)) { setStatus("error"); setMessage("180度の折り返しはできません"); return; }
    const closes = started && same(next, start);
    if (board[next.y][next.x] !== EMPTY && !closes) { setStatus("error"); setMessage("既存経路には重なれません"); return; }
    const turns = direction && direction.glyph !== nextDirection.glyph;
    if (turns) {
      const previous = { x: position.x - direction.dx, y: position.y - direction.dy };
      if (inside(previous) && board[previous.y][previous.x] === "L") { setStatus("error"); setMessage("L同士は連続配置できません"); return; }
    }

    setHistory((items) => [...items, { board: cloneBoard(board), path: clonePath(path), start: { ...start }, position: { ...position }, direction, started, completed, message, status }]);
    const nextBoard = cloneBoard(board);
    nextBoard[position.y][position.x] = turns ? "L" : nextDirection.glyph;
    const nextPath = [...path, { position: { ...position }, direction: nextDirection }];
    setBoard(nextBoard); setPath(nextPath); setDirection(nextDirection); setStarted(true); setStatus("ok");

    if (closes) {
      const result = validateLoop(nextBoard, start);
      setPosition({ ...start }); setCompleted(result.ok); setStatus(result.ok ? "success" : "error"); setMessage(result.message);
    } else {
      setPosition(next); setMessage(turns ? `Lを配置して${nextDirection.label}へ曲がりました` : `${nextDirection.label}へ進みました`);
    }
  }, [board, completed, direction, message, path, position, start, started, status]);

  const undo = useCallback(() => {
    setHistory((items) => {
      const previous = items.at(-1);
      if (!previous) return items;
      setBoard(previous.board); setPath(previous.path); setStart(previous.start); setPosition(previous.position);
      setDirection(previous.direction); setStarted(previous.started); setCompleted(previous.completed);
      setMessage(previous.message); setStatus(previous.status);
      return items.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    setBoard(makeBoard()); setPath([]); setStart({ ...CENTER }); setPosition({ ...CENTER }); setDirection(null);
    setStarted(false); setCompleted(false); setHistory([]); setMessage("開始マスをクリックするか、キーを押して開始"); setStatus("idle");
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const key = event.key.toLowerCase();
      if (event.repeat && (key === "q" || key === "r")) return;
      if (key === "q") { event.preventDefault(); undo(); return; }
      if (key === "r") { event.preventDefault(); reset(); return; }
      const nextDirection = DIRECTIONS[event.key];
      if (nextDirection) { event.preventDefault(); move(nextDirection); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move, reset, undo]);

  const clickCell = useCallback((x, y) => {
    if (!started) { setStart({ x, y }); setPosition({ x, y }); setMessage(`開始地点: (${x}, ${y})`); return; }
    const cutIndex = path.findIndex((step) => same(step.position, { x, y }));
    if (cutIndex < 0) { setStatus("error"); setMessage("経路上のマスをクリックしてください"); return; }
    if (cutIndex === 0) { setStatus("idle"); setMessage("そのマスはすでに開始地点です"); return; }

    const retainedPath = clonePath(path.slice(cutIndex));
    const newStart = { x, y };
    try {
      const cutBoard = cloneBoard(board);
      for (const step of path.slice(0, cutIndex)) cutBoard[step.position.y][step.position.x] = EMPTY;
      cutBoard[y][x] = retainedPath[0].direction.glyph;
      const reconstructedPath = reconstructPath(cutBoard, newStart, position);
      const rebuilt = rebuildHistory(reconstructedPath, newStart);
      setBoard(rebuilt.board); setPath(rebuilt.path); setStart(newStart); setPosition(rebuilt.position);
      setDirection(rebuilt.direction); setStarted(rebuilt.started); setCompleted(false); setHistory(rebuilt.history);
      setStatus("ok"); setMessage(`前方 ${cutIndex} マスを破棄。Undo履歴 ${rebuilt.history.length} 手を再構築しました`);
    } catch (error) {
      setStatus("error"); setMessage(`履歴の再構築に失敗: ${error.message}`);
    }
  }, [board, path, position, started]);

  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-black tracking-[.25em] text-cyan-300">ARROW LOOP</p><h1 className="text-3xl font-black md:text-5xl">16×16 矢印閉路</h1><p className="mt-2 text-slate-400">WASD / 矢印: 移動、Q: Undo、R: リセット</p></div>
        <div className="flex gap-2"><button onClick={undo} disabled={!history.length} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 disabled:opacity-30">Q: 1手戻す</button><button onClick={reset} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2">R: リセット</button></div>
      </header>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3"><div className="mx-auto grid aspect-square max-w-[720px] overflow-hidden rounded-xl border border-slate-700" style={{gridTemplateColumns:"repeat(16,minmax(0,1fr))"}}>
          {board.map((row,y)=>row.map((cell,x)=><button key={`${x}-${y}`} onClick={()=>clickCell(x,y)} className={`relative grid aspect-square place-items-center border-b border-r border-slate-800 text-[clamp(12px,2.3vw,28px)] font-black ${cell===EMPTY?"bg-slate-950 text-slate-700":"cursor-pointer bg-cyan-950/60 text-cyan-200 hover:bg-rose-950/60"}`}>
            {same(start,{x,y})&&<span className="absolute inset-1 rounded border border-amber-400"/>}<span className={cell==="L"?"text-fuchsia-300":""}>{cell===EMPTY?"·":cell}</span>{!completed&&same(position,{x,y})&&<span className="absolute h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_4px_#facc1577]"/>}
          </button>))}
        </div></div>
        <aside className="space-y-3">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">{[["スコア",counts.arrows],["L字",counts.corners],["使用マス",`${counts.arrows+counts.corners}/256`]].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><small className="text-slate-500">{label}</small><strong className="block text-3xl text-cyan-300">{value}</strong></div>)}</div>
          <div className={`rounded-2xl border p-4 ${status==="error"?"border-rose-500/50 text-rose-200":status==="success"?"border-emerald-500/50 text-emerald-200":"border-cyan-500/30 text-cyan-100"}`}><small>STATUS</small><p className="font-semibold">{message}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400"><p>経路上の一点をクリックすると、それ以前を破棄して新しい開始地点にします。</p><p>残った経路はLの出口判定から再走査し、Undo履歴も再構築します。</p></div>
        </aside>
      </section>
    </div>
  </main>;
}
