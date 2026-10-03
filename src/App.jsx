import React, { useCallback, useEffect, useMemo, useState } from "react";

const SIZE = 16;
const EMPTY = " ";
const CENTER = { x: 7, y: 7 };

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
const GLYPH = Object.fromEntries(Object.values(DIRECTIONS).map(d => [d.glyph, d]));
const makeBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
const cloneBoard = board => board.map(row => [...row]);
const same = (a, b) => a.x === b.x && a.y === b.y;
const opposite = (a, b) => a && a.dx + b.dx === 0 && a.dy + b.dy === 0;
const inside = ({ x, y }) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

function count(board) {
  let arrows = 0, corners = 0;
  for (const row of board) for (const cell of row) {
    if (cell === "L") corners++;
    else if (GLYPH[cell]) arrows++;
  }
  return { arrows, corners };
}

function validate(board, start) {
  const at = p => inside(p) ? board[p.y][p.x] : EMPTY;
  const firstGlyph = at(start);
  if (!GLYPH[firstGlyph]) return { ok: false, message: "開始地点が矢印ではありません" };
  let pos = { ...start }, dir = GLYPH[firstGlyph], first = true, score = 0, steps = 0;
  const visited = new Set();
  while (first || !same(pos, start)) {
    first = false;
    if (++steps > SIZE * SIZE) return { ok: false, message: "開始地点へ戻りません" };
    if (!inside(pos)) return { ok: false, message: "経路がフィールド外へ出ました" };
    const key = `${pos.x},${pos.y}`;
    if (visited.has(key)) return { ok: false, message: `開始地点以外を再訪しました: (${key})` };
    visited.add(key);
    const cell = at(pos);
    if (GLYPH[cell]) {
      if (cell !== dir.glyph) return { ok: false, message: `矢印が暗黙に曲がっています: (${key})` };
      score++;
    } else if (cell === "L") {
      const candidates = [];
      if (at({ x: pos.x, y: pos.y - 1 }) === "↑") candidates.push(GLYPH["↑"]);
      if (at({ x: pos.x + 1, y: pos.y }) === "→") candidates.push(GLYPH["→"]);
      if (at({ x: pos.x - 1, y: pos.y }) === "←") candidates.push(GLYPH["←"]);
      if (at({ x: pos.x, y: pos.y + 1 }) === "↓") candidates.push(GLYPH["↓"]);
      if (candidates.length !== 1) return { ok: false, message: `Lの出口が${candidates.length}個あります: (${key})` };
      const next = candidates[0];
      if (next.glyph === dir.glyph || opposite(dir, next)) return { ok: false, message: `Lが90度に曲がっていません: (${key})` };
      dir = next;
    } else return { ok: false, message: `経路上に空白があります: (${key})` };
    pos = { x: pos.x + dir.dx, y: pos.y + dir.dy };
  }
  return { ok: true, message: `有効な閉路です。スコア ${score} 点、全長 ${steps} マス` };
}

export default function App() {
  const [board, setBoard] = useState(makeBoard);
  const [start, setStart] = useState(CENTER);
  const [position, setPosition] = useState(CENTER);
  const [direction, setDirection] = useState(null);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("開始マスをクリックするか、キーを押して開始");
  const [status, setStatus] = useState("idle");
  const counts = useMemo(() => count(board), [board]);

  const move = useCallback(nextDir => {
    if (completed) return;
    const next = { x: position.x + nextDir.dx, y: position.y + nextDir.dy };
    if (!inside(next)) { setStatus("error"); setMessage("フィールド外には進めません"); return; }
    if (opposite(direction, nextDir)) { setStatus("error"); setMessage("180度の折り返しはできません"); return; }
    const closes = started && same(next, start);
    if (board[next.y][next.x] !== EMPTY && !closes) { setStatus("error"); setMessage(`既存経路には重なれません: (${next.x}, ${next.y})`); return; }
    const turns = direction && direction.glyph !== nextDir.glyph;
    if (turns) {
      const previous = { x: position.x - direction.dx, y: position.y - direction.dy };
      if (inside(previous) && board[previous.y][previous.x] === "L") { setStatus("error"); setMessage("L同士は連続配置できません"); return; }
    }
    setHistory(h => [...h, { board: cloneBoard(board), start: { ...start }, position: { ...position }, direction, started, completed, message, status }]);
    const nextBoard = cloneBoard(board);
    nextBoard[position.y][position.x] = turns ? "L" : nextDir.glyph;
    setBoard(nextBoard); setDirection(nextDir); setStarted(true); setStatus("ok");
    if (closes) {
      const result = validate(nextBoard, start);
      setPosition(start); setCompleted(result.ok); setStatus(result.ok ? "success" : "error"); setMessage(result.message);
    } else {
      setPosition(next); setMessage(turns ? `Lを配置して${nextDir.label}へ曲がりました` : `${nextDir.label}へ進みました`);
    }
  }, [board, completed, direction, message, position, start, started, status]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "q" || event.key === "Q" || event.key === "x" || event.key === "X") {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        reset();
        return;
      }

      const nextDirection = DIRECTIONS[event.key];

      if (!nextDirection) {
        return;
      }

      event.preventDefault();
      move(nextDirection);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [move, undo, reset]);

  const undo = () => {
    const previous = history.at(-1); if (!previous) return;
    setBoard(previous.board); setStart(previous.start); setPosition(previous.position); setDirection(previous.direction);
    setStarted(previous.started); setCompleted(previous.completed); setMessage(previous.message); setStatus(previous.status);
    setHistory(h => h.slice(0, -1));
  };
  const reset = () => {
    setBoard(makeBoard()); setStart(CENTER); setPosition(CENTER); setDirection(null); setStarted(false);
    setCompleted(false); setHistory([]); setStatus("idle"); setMessage("開始マスをクリックするか、キーを押して開始");
  };
  const chooseStart = (x, y) => { if (!started) { setStart({x,y}); setPosition({x,y}); setMessage(`開始地点: (${x}, ${y})`); } };
  const controls = [[null, "↑", null], ["←", "↓", "→"]];

  return <main className="app">
    <header><div><p className="eyebrow">ARROW LOOP CHALLENGE</p><h1>16×16 矢印閉路</h1><p className="subtitle">WASD または矢印キーで描画。90度曲がると現在マスが自動で L になります。</p></div>
      <div className="actions"><button onClick={undo} disabled={!history.length}>↶ 1手戻す</button><button onClick={reset}>↻ リセット</button></div>
    </header>
    <section className="layout">
      <div className="board-wrap"><div className="board">
        {board.map((row,y) => row.map((cell,x) => <button key={`${x}-${y}`} className={`cell ${cell !== EMPTY ? "filled" : ""} ${cell === "L" ? "corner" : ""}`} onClick={() => chooseStart(x,y)}>
          {same(start,{x,y}) && <i className="start"/>}<span>{cell === EMPTY ? "·" : cell}</span>
          {!completed && same(position,{x,y}) && <b className="cursor"/>}
        </button>))}
      </div></div>
      <aside>
        <div className="stats"><Stat label="スコア" value={counts.arrows}/><Stat label="L字" value={counts.corners}/><Stat label="使用マス" value={`${counts.arrows+counts.corners}/256`}/></div>
        <div className={`status ${status}`}><small>STATUS</small><strong>{message}</strong></div>
        <div className="panel"><h2>操作</h2><div className="keys">
          {controls.flat().map((g,i) => g ? <button key={i} onClick={() => move(GLYPH[g])}>{g}</button> : <span key={i}/>)}</div>
          <p>キーボード: W/A/S/D または矢印キー</p><p>開始前は任意のマスをクリックできます。</p>
        </div>
      </aside>
    </section>
  </main>;
}
function Stat({label,value}) { return <div className="stat"><small>{label}</small><strong>{value}</strong></div>; }
