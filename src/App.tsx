import { useState, useRef, useEffect } from 'react';
import { X, Circle, RotateCcw, Volume2, VolumeX, Play, Settings, User, Bot, Triangle, Vibrate, Smile, Meh, Frown, ChevronLeft, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { getBestMoveMinimax } from './minimax';

type Player = 'X' | 'O' | null;
type ViewState = 'home' | 'mode-select' | 'name-entry' | 'game';
type GameMode = 'pvp' | 'pve';

const getPreviewPlayer = (index: number, size: number): Player => {
  const r = Math.floor(index / size);
  const c = index % size;
  if (size === 3) {
    const xMoves = [[1, 1], [0, 2], [0, 1]];
    const oMoves = [[0, 0], [2, 2]];
    if (xMoves.some(([mr, mc]) => mr === r && mc === c)) return 'X';
    if (oMoves.some(([mr, mc]) => mr === r && mc === c)) return 'O';
  } else if (size === 6) {
    const xMoves = [[2, 2], [3, 2], [4, 3], [2, 4], [4, 2]];
    const oMoves = [[2, 3], [3, 3], [3, 4], [4, 4], [1, 3]];
    if (xMoves.some(([mr, mc]) => mr === r && mc === c)) return 'X';
    if (oMoves.some(([mr, mc]) => mr === r && mc === c)) return 'O';
  } else if (size === 9) {
    const xMoves = [[4, 4], [5, 4], [6, 4], [3, 3], [2, 2], [5, 3], [3, 6]];
    const oMoves = [[4, 5], [3, 4], [5, 5], [6, 6], [3, 5], [4, 3], [6, 3]];
    if (xMoves.some(([mr, mc]) => mr === r && mc === c)) return 'X';
    if (oMoves.some(([mr, mc]) => mr === r && mc === c)) return 'O';
  } else if (size === 11) {
    // Look like a real clustered 11x11 game
    const xMoves = [[5, 5], [6, 5], [7, 5], [4, 4], [3, 3], [6, 4], [7, 3], [5, 4], [8, 2], [7, 4], [6, 7], [8, 6], [4, 7]];
    const oMoves = [[5, 6], [4, 5], [6, 6], [7, 7], [4, 6], [5, 7], [6, 3], [3, 5], [5, 8], [4, 3], [5, 3], [3, 4], [7, 6]];
    if (xMoves.some(([mr, mc]) => mr === r && mc === c)) return 'X';
    if (oMoves.some(([mr, mc]) => mr === r && mc === c)) return 'O';
  }
  return null;
};

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [gameMode, setGameMode] = useState<GameMode>('pvp');
  
  const [difficultyLevel, setDifficultyLevel] = useState<number>(1); // Level 1 to 500
  
  const gridOptions = [3, 6, 9, 11];
  const [gridIdx, setGridIdx] = useState(0);
  
  // In PvE, override board size based on difficulty
  let boardSize = gridOptions[gridIdx];
  if (gameMode === 'pve') {
      if (difficultyLevel <= 25) boardSize = 3;
      else if (difficultyLevel <= 100) boardSize = 6;
      else if (difficultyLevel <= 300) boardSize = 9;
      else boardSize = 11;
  }
  
  const [board, setBoard] = useState<Player[]>(Array(boardSize * boardSize).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);

  // Synchronize board size
  useEffect(() => {
    if (board.length !== boardSize * boardSize) {
      setBoard(Array(boardSize * boardSize).fill(null));
      setIsXNext(true);
    }
  }, [boardSize, board.length]);
  
  // Audio state
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(0.5);

  // Vibration and Difficulty States
  const [isVibrationOn, setIsVibrationOn] = useState(() => {
    return localStorage.getItem('tic-tac-toe-vibration') !== 'false';
  });
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState<number>(() => {
    return parseInt(localStorage.getItem('tic-tac-toe-max-level') || '1', 10);
  });
  const [levelPage, setLevelPage] = useState(0); // For level selection pagination
  const [showCelebration, setShowCelebration] = useState(false);
  
  const [player1Name, setPlayer1Name] = useState('PLAYER 1');
  const [player2Name, setPlayer2Name] = useState('PLAYER 2');

  const [scores, setScores] = useState({ p1: 0, p2: 0, draws: 0 });
  const resetScores = () => setScores({ p1: 0, p2: 0, draws: 0 });
  const scoreProcessed = useRef(false);

  const playSound = (type: 'move' | 'win' | 'draw' | 'ui_click') => {
    if (!isAudioOn) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      
      if (type === 'ui_click') {
        const clickAudio = new Audio('./kakaist-click-sfx-323775 (2).mp3');
        clickAudio.volume = volume;
        clickAudio.play().catch(() => {
          // fallback
          const osc = ctx.createOscillator();
          osc.connect(gain);
          osc.type = 'square';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
          gain.gain.setValueAtTime(0.05 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        });
      } else if (type === 'move') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const moveGain = ctx.createGain();
        osc1.connect(moveGain);
        osc2.connect(moveGain);
        moveGain.connect(ctx.destination);
        
        osc1.type = 'square';
        osc2.type = 'triangle';
        
        const freq1 = isXNext ? 440 : 554.37;
        const freq2 = freq1 / 2; // sub octave for depth
        
        osc1.frequency.setValueAtTime(freq1 * 1.5, now);
        osc1.frequency.exponentialRampToValueAtTime(freq1, now + 0.05);

        osc2.frequency.setValueAtTime(freq2 * 1.5, now);
        osc2.frequency.exponentialRampToValueAtTime(freq2, now + 0.05);
        
        moveGain.gain.setValueAtTime(0, now);
        moveGain.gain.linearRampToValueAtTime(0.3 * volume, now + 0.01);
        moveGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.15);
        osc2.stop(now + 0.15);
      } else if (type === 'win') {
        // Triumphant dynamic synthesis chord for victory
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const nodeGain = ctx.createGain();
          osc.type = 'triangle';
          osc.connect(nodeGain);
          nodeGain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          nodeGain.gain.setValueAtTime(0, now + i * 0.1);
          nodeGain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.05);
          nodeGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.6);
        });
      } else if (type === 'draw') {
        const osc = ctx.createOscillator();
        // Subtle descending synth with filter
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.linearRampToValueAtTime(200, now + 0.3);
        
        osc.disconnect();
        osc.connect(filter);
        filter.connect(gain);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch(e) {}
  };

  const triggerVibrate = (pattern: number | number[]) => {
    if (isVibrationOn && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  useEffect(() => {
    // Background music for the home and menu screens
    if (!audioRef.current) {
        audioRef.current = new Audio('./kucinskyphotos-game-intro-345507 (1).mp3');
        audioRef.current.loop = true;
    }
    if (!winAudioRef.current) {
        winAudioRef.current = new Audio('./floraphonic-you-win-sequence-2-183949.mp3');
        winAudioRef.current.loop = true;
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (winAudioRef.current) {
      winAudioRef.current.volume = volume;
    }
  }, [volume]);

  const checkWinner = (squares: Player[], size: number): { winner: Player; line: number[] | null } => {
    const streak = size === 3 ? 3 : size === 6 ? 4 : 5;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let player = squares[r * size + c];
        if (!player) continue;

        // horizontal right
        if (c + streak <= size) {
          let win = true; let line: number[] = [];
          for (let i = 0; i < streak; i++) {
            if (squares[r * size + c + i] !== player) win = false;
            line.push(r * size + c + i);
          }
          if (win) return { winner: player, line };
        }

        // vertical down
        if (r + streak <= size) {
          let win = true; let line: number[] = [];
          for (let i = 0; i < streak; i++) {
            if (squares[(r + i) * size + c] !== player) win = false;
            line.push((r + i) * size + c);
          }
          if (win) return { winner: player, line };
        }

        // diagonal down-right
        if (r + streak <= size && c + streak <= size) {
          let win = true; let line: number[] = [];
          for (let i = 0; i < streak; i++) {
            if (squares[(r + i) * size + (c + i)] !== player) win = false;
            line.push((r + i) * size + (c + i));
          }
          if (win) return { winner: player, line };
        }

        // diagonal up-right
        if (r - streak + 1 >= 0 && c + streak <= size) {
          let win = true; let line: number[] = [];
          for (let i = 0; i < streak; i++) {
            if (squares[(r - i) * size + (c + i)] !== player) win = false;
            line.push((r - i) * size + (c + i));
          }
          if (win) return { winner: player, line };
        }
      }
    }
    return { winner: null, line: null };
  };

  const { winner, line: winningLine } = checkWinner(board, boardSize);
  const isDraw = !winner && board.every((cell) => cell !== null);
  const currentPlayer = isXNext ? 'X' : 'O';

  useEffect(() => {
    if (audioRef.current) {
      if (isAudioOn) {
        audioRef.current.play().catch(e => console.log('Audio playback prevented:', e));
      } else {
        audioRef.current.pause();
      }
    }
    if (winAudioRef.current) {
      if (!isAudioOn || !winner) {
        winAudioRef.current.pause();
        if (!winner) winAudioRef.current.currentTime = 0;
      } else if (winner) {
        winAudioRef.current.play().catch(e => console.log('Win audio playback prevented', e));
      }
    }
  }, [isAudioOn, winner]);

  useEffect(() => {
    if (winner && !scoreProcessed.current) {
      triggerVibrate([100, 50, 100, 50, 200]);
      playSound('win');
      if (winner === 'X') {
        setScores(s => ({ ...s, p1: s.p1 + 1 }));
        if (gameMode === 'pve' && difficultyLevel === maxUnlockedLevel && maxUnlockedLevel < 500) {
          setMaxUnlockedLevel(m => {
            const nextLevel = Math.min(m + 1, 500);
            localStorage.setItem('tic-tac-toe-max-level', nextLevel.toString());
            return nextLevel;
          });
        }
      }
      if (winner === 'O') setScores(s => ({ ...s, p2: s.p2 + 1 }));
      setShowCelebration(true);
      scoreProcessed.current = true;
      
      const duration = 4000;
      const animationEnd = Date.now() + duration;
      const colors = winner === 'X' ? ['#22d3ee', '#bae6fd', '#0891b2', '#fde047'] : ['#c084fc', '#e879f9', '#9333ea', '#fde047'];

      // Initial big burst
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: colors,
        zIndex: 150
      });

      const frame = () => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return;

        confetti({
          particleCount: 12,
          angle: 60,
          spread: 70,
          origin: { x: 0, y: 0.8 },
          colors: colors,
          zIndex: 150
        });
        
        confetti({
          particleCount: 12,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.8 },
          colors: colors,
          zIndex: 150
        });

        requestAnimationFrame(frame);
      };
      
      frame();

    } else if (isDraw && !scoreProcessed.current) {
      triggerVibrate(100);
      playSound('draw');
      setScores(s => ({ ...s, draws: s.draws + 1 }));
      scoreProcessed.current = true;
      setShowCelebration(false);
    } else if (!winner && !isDraw) {
      scoreProcessed.current = false;
      setShowCelebration(false);
    }
  }, [winner, isDraw]);

  // AI Move Logic
  useEffect(() => {
    if (view === 'game' && gameMode === 'pve' && !isXNext && !winner && !isDraw) {
      const emptyIndices = board.map((c, i) => c === null ? i : null).filter(i => i !== null) as number[];
      if (emptyIndices.length > 0) {
        const timer = setTimeout(() => {
          let chosenIndex: number | undefined;
          
          // Difficulty Scaling logic based on stages: 1-25, 26-100, 101-150
          let obviousMoveChance = 0.5;
          let strategicChance = 0.2;
          let useMinimaxChance = 0;
          
          if (difficultyLevel <= 25) {
            obviousMoveChance = 0.5 + (difficultyLevel / 25) * 0.4; // 50% to 90%
            strategicChance = 0.2 + (difficultyLevel / 25) * 0.3; // 20% to 50%
            useMinimaxChance = (difficultyLevel / 25) * 0.1; // 0% to 10%
          } else if (difficultyLevel <= 100) {
            obviousMoveChance = 0.9 + ((difficultyLevel - 25) / 75) * 0.1; // 90% to 100%
            strategicChance = 0.5 + ((difficultyLevel - 25) / 75) * 0.4; // 50% to 90%
            useMinimaxChance = 0.1 + ((difficultyLevel - 25) / 75) * 0.4; // 10% to 50%
          } else {
            obviousMoveChance = 1.0;
            strategicChance = 0.9 + Math.min(0.1, (difficultyLevel - 100) / 100); // 90% to 100%
            useMinimaxChance = 0.5 + Math.min(0.5, (difficultyLevel - 100) / 100); // 50% to 100%
          }

          // 1. Minimax integration for higher difficulty levels
          if (Math.random() < useMinimaxChance) {
             const depth = boardSize === 3 ? 9 : boardSize === 6 ? 4 : 2;
             const mmMove = getBestMoveMinimax(board, boardSize, depth, checkWinner);
             if (mmMove !== undefined) chosenIndex = mmMove;
          }

          // 2. Priority 1 & 2: Win or Block win
          if (chosenIndex === undefined && Math.random() < obviousMoveChance) {
            // Priority 1: AI can win
            for (let i of emptyIndices) {
              const temp = [...board]; temp[i] = 'O';
              if (checkWinner(temp, boardSize).winner === 'O') { chosenIndex = i; break; }
            }
            // Priority 2: Block player win
            if (chosenIndex === undefined) {
              for (let i of emptyIndices) {
                const temp = [...board]; temp[i] = 'X';
                if (checkWinner(temp, boardSize).winner === 'X') { chosenIndex = i; break; }
              }
            }
          }
            
          // 3. Strategic positional play
          if (chosenIndex === undefined && Math.random() < strategicChance) {
              let bestScore = -1;
              for (let i of emptyIndices) {
                let score = 0;
                const row = Math.floor(i / boardSize);
                const col = i % boardSize;
                
                // Evaluate 8 surrounding directions
                for (let dr = -1; dr <= 1; dr++) {
                  for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = row + dr;
                    const c = col + dc;
                    if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                      const neighbor = board[r * boardSize + c];
                      if (neighbor === 'O') score += 3; // Prefer building own strings
                      else if (neighbor === 'X') score += 1; // Block player's adjacent pieces
                    }
                  }
                }
                // Adding small randomness to avoid completely deterministic play
                score += Math.random(); 
                if (score > bestScore) {
                   bestScore = score;
                   chosenIndex = i;
                }
              }
          }

          // 4. Center if available
          if (chosenIndex === undefined && Math.random() < strategicChance) {
              const center = Math.floor((boardSize * boardSize) / 2);
              if (emptyIndices.includes(center)) chosenIndex = center;
          }
          
          if (chosenIndex === undefined) {
             chosenIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          }

          setBoard(prev => {
            const nextBoard = [...prev];
            nextBoard[chosenIndex!] = 'O';
            return nextBoard;
          });
          triggerVibrate(50);
          playSound('move');
          setIsXNext(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [view, gameMode, isXNext, winner, isDraw, board, boardSize, difficultyLevel]);

  const handleClick = (index: number) => {
    if (board[index] || winner) return;
    if (gameMode === 'pve' && !isXNext) return; // Ignore clicks during AI turn

    triggerVibrate(40);
    playSound('move');
    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);
    setIsXNext(!isXNext);
  };

  const resetGame = (size = boardSize) => {
    setBoard(Array(size * size).fill(null));
    setIsXNext(true);
  };

  return (
    <div className="relative min-h-screen bg-[#070b19] bg-pattern flex items-center justify-center p-4 font-sans text-neutral-100 overflow-hidden">
      {/* Top Yellow/Orange Glow Effect */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[90%] md:w-[60%] h-[300px] bg-gradient-to-r from-yellow-400 to-orange-500 rounded-[100%] blur-[120px] opacity-30 pointer-events-none"></div>
      
      {/* Central White Ambient Surrounding Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] bg-white/5 rounded-full blur-[100px]"></div>
      </div>

      {/* Attractive Symbols Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Giant decorative background elements */}
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.05, 1] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[10%] opacity-10 text-indigo-500 blur-[2px]"
        >
          <X size={500} strokeWidth={1.5} />
        </motion.div>
        
        <motion.div
          animate={{ rotate: -360, scale: [1, 1.1, 1] }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[15%] -right-[15%] opacity-10 text-rose-500 blur-[2px]"
        >
          <Circle size={600} strokeWidth={2} />
        </motion.div>

        <motion.div
          animate={{ rotate: 360, y: [-30, 30, -30] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[15%] right-[10%] opacity-[0.15] text-indigo-400"
        >
          <X size={140} strokeWidth={2} />
        </motion.div>

        <motion.div
          animate={{ rotate: -360, y: [30, -30, 30] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[20%] left-[10%] opacity-[0.15] text-rose-400"
        >
          <Circle size={120} strokeWidth={2.5} />
        </motion.div>
        
        <motion.div
          animate={{ rotate: 180, x: [-20, 20, -20] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[60%] left-[5%] opacity-[0.08] text-indigo-300"
        >
          <X size={200} strokeWidth={1} />
        </motion.div>
        
        <motion.div
          animate={{ rotate: -180, x: [20, -20, 20] }}
          transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] right-[5%] opacity-[0.08] text-rose-300"
        >
          <Circle size={220} strokeWidth={1.5} />
        </motion.div>

        {view === 'home' && (
          <>
            {/* Added extra visible floating symbols specifically for Home screen */}
            <motion.div
              animate={{ rotate: 200, y: [0, -40, 0] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[40%] left-[25%] opacity-[0.25] text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"
            >
              <X size={80} strokeWidth={3} />
            </motion.div>

            <motion.div
              animate={{ rotate: -200, y: [0, 40, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[25%] right-[25%] opacity-[0.25] text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]"
            >
              <Circle size={70} strokeWidth={3.5} />
            </motion.div>

            <motion.div
              animate={{ rotate: 150, x: [0, 30, 0] }}
              transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-[30%] right-[30%] opacity-[0.2] text-indigo-300"
            >
              <X size={100} strokeWidth={2} />
            </motion.div>
          </>
        )}
      </div>

      {/* Audio Settings Floating Menu */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        <button
          onClick={() => { setIsVibrationOn(!isVibrationOn); playSound('ui_click'); }}
          className={`p-3 box-glossy rounded-full hover:scale-105 transition-all focus:outline-none ${isVibrationOn ? 'text-yellow-400 border-2 border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'text-neutral-400 border border-white/20'}`}
          title="Toggle Vibration"
        >
          <Vibrate size={24} />
        </button>

        <div className="relative">
          <button
            onClick={() => { setIsAudioMenuOpen(!isAudioMenuOpen); playSound('ui_click'); }}
            className="p-3 box-glossy rounded-full hover:scale-105 transition-all text-white relative focus:outline-none"
          >
            <Settings size={28} className={isAudioMenuOpen ? "rotate-90 transition-transform duration-300" : "transition-transform duration-300"} />
            {isAudioOn && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-[#070b19]"></div>}
          </button>

          <AnimatePresence>
            {isAudioMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute right-0 mt-3 w-56 box-glossy rounded-2xl flex flex-col overflow-hidden shadow-2xl"
              >
                <div className="px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Atmosphere</span>
                    <span className="text-xs font-bold text-yellow-400">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (parseFloat(e.target.value) > 0) setIsAudioOn(true);
                      else setIsAudioOn(false);
                    }}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                  />
                </div>
                <div className="h-px bg-white/10 w-full"></div>
                <button
                  onClick={() => { setIsAudioOn(true); setIsAudioMenuOpen(false); playSound('ui_click'); }}
                  className={`flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/10 transition-colors ${
                    isAudioOn ? 'bg-white/10 font-bold text-yellow-300' : 'text-neutral-200'
                  }`}
                >
                  <Volume2 size={18} />
                  Play Music
                </button>
                <div className="h-px bg-white/10 w-full"></div>
                <button
                  onClick={() => { setIsAudioOn(false); setIsAudioMenuOpen(false); playSound('ui_click'); }}
                  className={`flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/10 transition-colors ${
                    !isAudioOn ? 'bg-white/10 font-bold text-yellow-300' : 'text-neutral-200'
                  }`}
                >
                  <VolumeX size={18} />
                  Mute All
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
              className="flex flex-col items-center justify-center space-y-12 py-10 w-full"
            >
              <div className="relative">
                {/* Background glow for the title area */}
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-purple-500/20 to-pink-500/20 blur-[80px] rounded-full scale-[1.5]"></div>
                
                <motion.div 
                  animate={{ y: [-15, 10, -15] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="relative aspect-square w-64 sm:w-[22rem] flex flex-col items-center justify-center rounded-[3rem] square-glow overflow-hidden bg-white/5 backdrop-blur-md pt-8 border-4 border-white/20 shadow-[0_0_50px_rgba(250,204,21,0.3)]"
                >
                  {/* Glossy reflection on the square */}
                  <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/60 to-transparent pointer-events-none rounded-t-[2.5rem] z-0"></div>
                  
                  <div className="flex gap-6 items-center mb-6 z-20">
                    <motion.div 
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.8, type: "spring" }}
                        className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-900/80 rounded-3xl flex items-center justify-center border-[3px] border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.6)] backdrop-blur-sm"
                    >
                      <X size={44} strokeWidth={3.5} className="text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.9)]" />
                    </motion.div>
                    <motion.div
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.8, type: "spring", delay: 0.2 }}
                        className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-900/80 rounded-3xl flex items-center justify-center border-[3px] border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.6)] backdrop-blur-sm"
                    >
                      <Circle size={36} strokeWidth={4} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.9)]" />
                    </motion.div>
                  </div>

                  <h1 className="text-5xl sm:text-[5.5rem] font-bubble text-glossy text-center tracking-wider leading-[0.9] relative z-10 px-4 mt-2 pb-6">
                    TIC<br/>TAC<br/>TOE
                  </h1>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="w-full flex justify-center mt-12 px-4"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setView('mode-select'); playSound('ui_click'); triggerVibrate(50); }}
                  className="relative group w-full max-w-[300px] py-6 rounded-[2rem] bg-[#0f172a] border-2 border-cyan-400/80 cursor-pointer overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.3),inset_0_0_20px_rgba(34,211,238,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/30 via-transparent to-purple-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                  <div className="absolute -inset-[100%] bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] group-hover:animate-[shimmer_2s_infinite]"></div>
                  
                  <span className="relative z-10 flex items-center justify-center gap-4 text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:from-white group-hover:to-cyan-200 transition-colors">
                    <Play size={32} className="text-cyan-400 group-hover:text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" fill="currentColor" />
                    START GAME
                  </span>
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {view === 'mode-select' && (
            <motion.div
              key="mode-select"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center space-y-6 py-10 w-full relative"
            >
              <button
                onClick={() => { setView('home'); triggerVibrate(30); playSound('ui_click'); }}
                className="absolute top-0 left-4 w-12 h-12 bg-[#0a0833] border-2 border-cyan-400 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.4),inset_0_0_10px_rgba(34,211,238,0.3)] text-cyan-400 hover:text-white hover:bg-cyan-900/50 transition-all cursor-pointer flex items-center justify-center backdrop-blur-md overflow-hidden group z-10"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none group-hover:via-white/30 transition-all"></div>
                <ChevronLeft size={28} strokeWidth={3} className="drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] relative z-10 -ml-1 mt-0.5" />
              </button>

              <div className="relative mb-2 text-center pt-8">
                <h2 className="text-5xl font-bubble text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-200 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] relative z-10 tracking-widest">
                  GAME MODE
                </h2>
                <div className="absolute -inset-4 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent rounded-[100%] blur-xl z-0"></div>
              </div>
              
              {/* Grid Selector */}
              <div className="flex items-center justify-between w-full max-w-sm mx-auto my-4 p-5 rounded-[2.5rem] bg-indigo-950/60 border-2 border-indigo-400/40 shadow-[0_10px_30px_rgba(99,102,241,0.3),inset_0_2px_20px_rgba(255,255,255,0.15)] backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>

                <button
                  onClick={() => { setGridIdx(prev => (prev - 1 + gridOptions.length) % gridOptions.length); playSound('ui_click'); }}
                  className="p-3 rounded-full hover:bg-white/10 active:scale-95 transition-all outline-none cursor-pointer relative z-10"
                >
                  <Triangle className="rotate-[-90deg] drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] text-yellow-400 fill-yellow-400" size={36} />
                </button>
                
                <div className="flex flex-col items-center relative z-10">
                  <div className="text-xs text-white/60 uppercase tracking-widest font-bold mb-3 drop-shadow-sm">Grid Size</div>
                  
                  {/* Mini Preview Board */}
                  <motion.div 
                    key={`preview-${boardSize}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-24 h-24 bg-black/40 p-2 rounded-2xl grid shrink-0 gap-[2px] shadow-[inset_0_4px_15px_rgba(0,0,0,0.6),0_2px_4px_rgba(255,255,255,0.1)] border border-white/10 mb-3"
                    style={{ 
                      gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`
                    }}
                  >
                    {Array.from({length: boardSize * boardSize}).map((_, i) => {
                      const player = getPreviewPlayer(i, boardSize);
                      
                      return (
                        <div key={i} className={`bg-white/5 rounded-[2px] flex items-center justify-center overflow-hidden ${player ? 'shadow-[inset_0_0_4px_rgba(255,255,255,0.1)]' : ''}`}>
                           {player === 'X' && <X className="text-indigo-400/80 drop-shadow-sm" strokeWidth={3} size={boardSize >= 9 ? 6 : boardSize === 6 ? 10 : 20} />}
                           {player === 'O' && <Circle className="text-rose-400/80 drop-shadow-sm" strokeWidth={3} size={boardSize >= 9 ? 4 : boardSize === 6 ? 8 : 16} />}
                        </div>
                      )
                    })}
                  </motion.div>

                  <div className="text-3xl font-bubble text-white drop-shadow-md flex items-center">
                    {boardSize}<span className="text-xl text-yellow-400/80 mx-2">×</span>{boardSize}
                  </div>
                </div>

                <button
                  onClick={() => { setGridIdx(prev => (prev + 1) % gridOptions.length); playSound('ui_click'); }}
                  className="p-3 rounded-full hover:bg-white/10 active:scale-95 transition-all outline-none cursor-pointer relative z-10"
                >
                  <Triangle className="rotate-[90deg] drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] text-yellow-400 fill-yellow-400" size={36} />
                </button>
              </div>

              <div className="flex flex-col space-y-6 w-full max-w-sm mx-auto pt-2">
                {/* Player vs Player Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setGameMode('pvp'); setView('name-entry'); resetGame(); resetScores(); playSound('ui_click'); }}
                  className="relative overflow-hidden px-8 py-6 rounded-[2rem] text-2xl text-white font-bubble tracking-wide flex flex-col sm:flex-row items-center justify-center gap-4 group cursor-pointer w-full transition-all border-[3px] border-purple-300/80 shadow-[0_15px_35px_rgba(147,51,234,0.4),inset_0_4px_15px_rgba(255,255,255,0.4)] bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600"
                >
                  <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/50 to-white/5 pointer-events-none rounded-t-[1.8rem]"></div>
                  <div className="absolute bottom-0 left-0 w-full h-[30%] bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-b-[1.8rem]"></div>
                  <div className="absolute -inset-[100%] bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.25)_50%,transparent_75%,transparent_100%)] group-hover:animate-[shimmer_2s_infinite]"></div>

                  <div className="flex items-center gap-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] z-10">
                     <User size={36} strokeWidth={2.5} className="text-cyan-200" /> <span>Player</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center z-10 border border-white/40 shadow-inner backdrop-blur-sm mx-2">
                    <span className="text-white text-base font-sans font-black">VS</span>
                  </div>
                  <div className="flex items-center gap-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] z-10">
                     <User size={36} strokeWidth={2.5} className="text-rose-200" /> <span>Player</span>
                  </div>
                </motion.button>
                
                {/* Player vs AI Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { 
                    setGameMode('pve'); 
                    setDifficultyLevel(maxUnlockedLevel);
                    setLevelPage(Math.floor((maxUnlockedLevel - 1) / 36));
                    setShowDifficultyModal(true); 
                    triggerVibrate(30); 
                    resetScores(); 
                    playSound('ui_click'); 
                  }}
                  className="relative overflow-hidden px-8 py-6 rounded-[2rem] text-2xl text-white font-bubble tracking-wide flex flex-col sm:flex-row items-center justify-center gap-4 group cursor-pointer w-full transition-all border-[3px] border-emerald-300/80 shadow-[0_15px_35px_rgba(16,185,129,0.4),inset_0_4px_15px_rgba(255,255,255,0.4)] bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-700"
                >
                  <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/50 to-white/5 pointer-events-none rounded-t-[1.8rem]"></div>
                  <div className="absolute bottom-0 left-0 w-full h-[30%] bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-b-[1.8rem]"></div>
                  <div className="absolute -inset-[100%] bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.25)_50%,transparent_75%,transparent_100%)] group-hover:animate-[shimmer_2s_infinite]"></div>

                  <div className="flex items-center gap-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] z-10">
                     <User size={36} strokeWidth={2.5} className="text-cyan-200" /> <span>Player</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center z-10 border border-white/40 shadow-inner backdrop-blur-sm mx-2">
                    <span className="text-white text-base font-sans font-black">VS</span>
                  </div>
                  <div className="flex items-center gap-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] z-10">
                     <Bot size={36} strokeWidth={2.5} className="text-emerald-200" /> <span>A.I.</span>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* NAME ENTRY SCREEN */}
          {view === 'name-entry' && (
            <motion.div
              key="name-entry"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center space-y-8 py-10 w-full relative"
            >
              <button
                onClick={() => { setView('mode-select'); triggerVibrate(30); playSound('ui_click'); }}
                className="absolute top-0 left-4 w-12 h-12 bg-[#0a0833] border-2 border-cyan-400 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.4),inset_0_0_10px_rgba(34,211,238,0.3)] text-cyan-400 hover:text-white hover:bg-cyan-900/50 transition-all cursor-pointer flex items-center justify-center backdrop-blur-md overflow-hidden group z-10"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none group-hover:via-white/30 transition-all"></div>
                <ChevronLeft size={28} strokeWidth={3} className="drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] relative z-10 -ml-1 mt-0.5" />
              </button>

              <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pt-8">Enter Names</h2>
              
              <div className="flex flex-col gap-8 w-full max-w-xs mx-auto box-glossy p-8 rounded-3xl shadow-[0_0_30px_rgba(255,255,255,0.05)] border-2 border-cyan-400/30">
                 <div className="flex flex-col gap-3">
                    <label className="text-cyan-300 font-bold tracking-widest text-sm flex items-center justify-between">
                      <span>PLAYER 1</span>
                      <X size={18} strokeWidth={3} className="text-cyan-400" />
                    </label>
                    <input 
                      type="text" 
                      value={player1Name} 
                      onChange={e => setPlayer1Name(e.target.value.toUpperCase().slice(0, 10))}
                      className="bg-cyan-900/30 border-2 border-cyan-400/50 rounded-xl px-4 py-3 text-white text-center font-black tracking-widest outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all uppercase placeholder:opacity-50"
                      placeholder="PLAYER 1"
                    />
                 </div>

                 <div className="flex flex-col gap-3">
                    <label className="text-purple-300 font-bold tracking-widest text-sm flex items-center justify-between">
                      <span>{gameMode === 'pve' ? 'AI OPPONENT' : 'PLAYER 2'}</span>
                      <Circle size={16} strokeWidth={3} className="text-purple-400" />
                    </label>
                    {gameMode === 'pve' ? (
                      <div className="bg-purple-900/20 border-2 border-purple-400/30 rounded-xl px-4 py-3 text-white/70 text-center font-black tracking-widest uppercase cursor-not-allowed">
                        AI
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        value={player2Name} 
                        onChange={e => setPlayer2Name(e.target.value.toUpperCase().slice(0, 10))}
                        className="bg-purple-900/30 border-2 border-purple-400/50 rounded-xl px-4 py-3 text-white text-center font-black tracking-widest outline-none focus:border-purple-400 focus:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all uppercase placeholder:opacity-50"
                        placeholder="PLAYER 2"
                      />
                    )}
                 </div>

                 <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { resetGame(); setView('game'); triggerVibrate(50); playSound('ui_click'); }}
                    className="mt-4 relative box-glossy border-2 border-green-400 py-4 px-8 rounded-2xl overflow-hidden group cursor-pointer"
                 >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                    <div className="absolute inset-0 bg-green-500/20 group-hover:bg-green-400/40 transition-colors"></div>
                    <span className="relative z-10 font-bold text-lg tracking-widest text-green-300 group-hover:text-white drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] block text-center">PLAY NOW</span>
                 </motion.button>
              </div>
            </motion.div>
          )}

          {view === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col h-full w-full max-w-lg mx-auto relative z-10"
            >
              {/* Top Left Back Button */}
              <button
                onClick={() => { setView('mode-select'); resetGame(); triggerVibrate(30); playSound('ui_click'); }}
                className="absolute top-0 left-4 w-12 h-12 bg-[#0a0833] border-2 border-cyan-400 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.4),inset_0_0_10px_rgba(34,211,238,0.3)] text-cyan-400 hover:text-white hover:bg-cyan-900/50 transition-all cursor-pointer flex items-center justify-center backdrop-blur-md overflow-hidden group z-10"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none group-hover:via-white/30 transition-all"></div>
                <ChevronLeft size={28} strokeWidth={3} className="drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] relative z-10 -ml-1 mt-0.5" />
              </button>

              {/* Top Right Exit Button for PvE */}
              {gameMode === 'pve' && (
                  <button
                    onClick={() => { setView('mode-select'); resetGame(); triggerVibrate(30); playSound('ui_click'); }}
                    className="absolute top-0 right-4 p-2 px-4 bg-rose-900/60 hover:bg-rose-800 border-2 border-rose-500 text-rose-200 hover:text-white text-sm font-bold tracking-wider rounded-xl transition-colors cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.3)] flex items-center justify-center z-10 box-glossy"
                  >
                    EXIT
                  </button>
              )}

              {/* Players VS Header */}
              <div className="flex justify-center items-center gap-6 mt-16 mb-8 w-full max-w-sm mx-auto">
                {/* Player 1 (X) */}
                <div className="flex flex-col items-center relative flex-1">
                  <motion.div 
                    animate={isXNext && !winner && !isDraw ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-500 ${isXNext && !winner && !isDraw ? 'shadow-[0_0_40px_rgba(34,211,238,0.6)]' : 'opacity-60 grayscale-[30%]'}`}
                  >
                    {isXNext && !winner && !isDraw && <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-xl"></div>}
                    <X size={64} strokeWidth={3} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                  </motion.div>
                  <div className={`mt-3 font-black tracking-widest text-[#22d3ee] drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] flex flex-col items-center gap-1.5`}>
                    <div className={`text-xs uppercase transition-colors text-center ${!isXNext ? 'opacity-70' : ''}`}>
                      {player1Name || 'PLAYER 1'}
                    </div>
                    <div className="bg-cyan-900/50 rounded-full px-4 py-0.5 text-cyan-200 text-sm border border-cyan-400/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                      {scores.p1}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 mb-8">
                   <div className="text-2xl font-black text-white/90 drop-shadow-lg">VS</div>
                   <div className="text-[10px] text-white/50 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full border border-white/10 whitespace-nowrap">Draws: {scores.draws}</div>
                </div>

                {/* Player 2 / AI (O) */}
                <div className="flex flex-col items-center relative flex-1">
                  <motion.div 
                    animate={!isXNext && !winner && !isDraw ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-500 ${!isXNext && !winner && !isDraw ? 'shadow-[0_0_40px_rgba(168,85,247,0.6)]' : 'opacity-60 grayscale-[30%]'}`}
                  >
                    {!isXNext && !winner && !isDraw && <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl"></div>}
                    <Circle size={60} strokeWidth={3} className="text-purple-400/80 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                  </motion.div>
                  <div className={`mt-3 font-black tracking-widest text-[#c084fc] drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] flex flex-col items-center gap-1.5`}>
                    <div className={`text-xs uppercase transition-colors text-center ${isXNext ? 'opacity-70' : ''}`}>
                      {gameMode === 'pve' ? 'AI' : (player2Name || 'PLAYER 2')}
                    </div>
                    <div className="bg-purple-900/50 rounded-full px-4 py-0.5 text-purple-200 text-sm border border-purple-400/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                      {scores.p2}
                    </div>
                  </div>
                </div>
              </div>

              {/* Victory / Info Banner Overlay (Temporary during win/draw) */}
              <div className="h-8 flex items-center justify-center -mt-2 mb-2">
                {winner ? (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0, y: -10 }}
                    animate={{ scale: [1, 1.1, 1], opacity: 1, y: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="text-xl font-bold text-yellow-400 flex items-center gap-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"
                  >
                    🎉 {winner === 'X' ? player1Name : gameMode === 'pve' ? 'AI' : player2Name} Wins!
                  </motion.div>
                ) : isDraw ? (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, rotate: [0, -3, 3, -3, 0] }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="text-xl font-bold text-white/80 drop-shadow-lg"
                  >
                    Draw!
                  </motion.div>
                ) : (
                  boardSize > 3 && (
                    <div className="text-xs font-semibold tracking-wide text-white/50 uppercase">
                      Connect {boardSize === 6 ? 4 : 5} to win
                    </div>
                  )
                )}
              </div>

              <div className="flex-1 flex flex-col justify-start relative w-full max-w-sm mx-auto px-4 z-10">
                
                <div className="flex justify-between items-center w-full mb-3 px-1">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-900/30 rounded-full border border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                    <div className="w-3 h-3 border-[1.5px] border-cyan-100 rounded-full bg-cyan-100/20"></div>
                    <div className="w-3 h-3 border-[1.5px] border-cyan-100 rounded-full bg-transparent"></div>
                    <div className="w-3 h-3 border-[1.5px] border-cyan-100 rounded-full bg-transparent"></div>
                  </div>
                  {gameMode === 'pve' && (
                    <div className="px-5 py-0.5 bg-indigo-950/60 rounded-full border border-cyan-400/50 text-[10px] sm:text-xs font-bold text-cyan-400 tracking-widest shadow-[0_0_10px_rgba(34,211,238,0.2)] uppercase">
                      LEVEL {difficultyLevel + 1}
                    </div>
                  )}
                </div>

                {/* Grid Container */}
                <div className="relative w-full aspect-square border-4 border-cyan-400 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.7),inset_0_0_40px_rgba(34,211,238,0.6)] bg-cyan-400/10 overflow-hidden">
                  
                  {/* Winning Line Overlay */}
                  {winningLine && winner && (() => {
                    const startIdx = winningLine[0];
                    const endIdx = winningLine[winningLine.length - 1];
                    
                    const startR = Math.floor(startIdx / boardSize);
                    const startC = startIdx % boardSize;
                    const endR = Math.floor(endIdx / boardSize);
                    const endC = endIdx % boardSize;

                    const startX = (startC + 0.5) / boardSize * 100;
                    const startY = (startR + 0.5) / boardSize * 100;
                    const endX = (endC + 0.5) / boardSize * 100;
                    const endY = (endR + 0.5) / boardSize * 100;

                    const strokeColor = winner === 'X' ? '#22d3ee' : '#c084fc';

                    return (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ filter: `drop-shadow(0 0 15px ${strokeColor}) drop-shadow(0 0 5px white)` }}>
                        <motion.line
                          x1={`${startX}%`}
                          y1={`${startY}%`}
                          x2={`${endX}%`}
                          y2={`${endY}%`}
                          stroke={strokeColor}
                          strokeWidth={boardSize === 3 ? "20" : boardSize === 6 ? "12" : "8"}
                          strokeLinecap="round"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ 
                            pathLength: 1, 
                            opacity: [0, 1, 1],
                            strokeWidth: [boardSize === 3 ? "20" : boardSize === 6 ? "12" : "8", boardSize === 3 ? "28" : boardSize === 6 ? "16" : "12", boardSize === 3 ? "20" : boardSize === 6 ? "12" : "8"]
                          }}
                          transition={{ 
                            pathLength: { duration: 0.5, ease: "easeOut", delay: 0.2 },
                            strokeWidth: { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }
                          }}
                        />
                      </svg>
                    );
                  })()}

                  <div 
                    className="grid w-full h-full bg-cyan-500/30" // cyan background to show through gap as glowing lines
                    style={{
                      gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`,
                      gap: boardSize === 3 ? '4px' : '2px' // Thicker lines for the grid
                    }}
                  >
                    {board.map((cell, index) => {
                      const isWinningCell = winningLine?.includes(index);
                      const isDimmed = winner && !winningLine?.includes(index);
                      const iconSize = boardSize === 3 ? 64 : boardSize === 6 ? 32 : boardSize === 9 ? 20 : 16;
                      const strokeWidth = boardSize === 3 ? 4.5 : boardSize === 6 ? 3.5 : 4;
                      
                      const cellShadowColor = winner === 'X' ? 'rgba(34,211,238,0.8)' : 'rgba(168,85,247,0.8)';
                      const cellBgColor = winner === 'X' ? 'rgba(8,145,178,0.6)' : 'rgba(147,51,234,0.6)';
                      const cellBgColorHighlight = winner === 'X' ? 'rgba(34,211,238,0.5)' : 'rgba(192,132,252,0.5)';

                      return (
                        <motion.button
                          key={index}
                          onClick={() => handleClick(index)}
                          whileTap={!cell && !winner ? { scale: 0.85, transition: { duration: 0.1 } } : {}}
                          animate={isWinningCell ? {
                            boxShadow: [
                                `inset 0 0 15px ${cellShadowColor}, 0 0 10px ${cellShadowColor}`,
                                `inset 0 0 35px ${cellShadowColor}, 0 0 25px ${cellShadowColor}`,
                                `inset 0 0 15px ${cellShadowColor}, 0 0 10px ${cellShadowColor}`
                            ],
                            backgroundColor: [
                                cellBgColor,
                                cellBgColorHighlight,
                                cellBgColor
                            ],
                            scale: [1, 1.05, 1],
                            zIndex: 10
                          } : {
                            boxShadow: 'inset 0 0 0px rgba(0,0,0,0), 0 0 0px rgba(0,0,0,0)',
                            backgroundColor: 'rgba(15, 20, 77, 0.6)',
                            scale: 1,
                            zIndex: 1
                          }}
                          transition={isWinningCell ? { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 } : {}}
                          className={`relative flex items-center justify-center transition-colors bg-[#0f144d]/60 ${
                            !cell && !winner ? 'cursor-pointer hover:bg-cyan-900/40' : 'cursor-default'
                          } ${isDimmed ? 'opacity-30 blur-[1px] grayscale' : ''} ${isWinningCell ? 'border-2 border-white/50' : ''}`}
                          disabled={!!cell || !!winner}
                        >
                          {cell === 'X' && (
                            <motion.div
                              initial={{ scale: 0.5, rotate: -45, opacity: 0 }}
                              animate={isWinningCell ? { rotate: [0, 10, -10, 0], opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
                              transition={isWinningCell ? { duration: 1.2, repeat: Infinity } : { type: "spring", stiffness: 260, damping: 20 }}
                              className="relative"
                            >
                              {/* Glowing glossy Cross */}
                              <div className="absolute inset-0 bg-cyan-400/40 blur-xl rounded-full pointer-events-none scale-90"></div>
                              <X size={iconSize * 1.2} strokeWidth={strokeWidth} className="text-white drop-shadow-[0_0_15px_rgba(34,211,238,1)] drop-shadow-[0_0_5px_rgba(255,255,255,1)] brightness-150 relative z-10" />
                            </motion.div>
                          )}
                          {cell === 'O' && (
                            <motion.div
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={isWinningCell ? { rotate: [0, -10, 10, 0], opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
                              transition={isWinningCell ? { duration: 1.2, repeat: Infinity } : { type: "spring", stiffness: 260, damping: 20 }}
                              className="relative"
                            >
                              {/* Glowing glossy Circle */}
                              <div className="absolute inset-0 bg-purple-500/40 blur-xl rounded-full pointer-events-none scale-90"></div>
                              <Circle size={iconSize} strokeWidth={strokeWidth} className="text-white drop-shadow-[0_0_15px_rgba(168,85,247,1)] drop-shadow-[0_0_5px_rgba(255,255,255,1)] brightness-150 relative z-10" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Bottom undo/reset button */}
                <div className="mt-8 flex justify-center w-full min-h-[80px]">
                  {!winner && !isDraw && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { resetGame(); triggerVibrate(40); playSound('ui_click'); }}
                      className="w-16 h-16 bg-[#0a0833] border-2 border-cyan-400 rounded-3xl shadow-[0_0_20px_rgba(34,211,238,0.6),inset_0_0_15px_rgba(34,211,238,0.4)] text-cyan-400 hover:bg-cyan-900/50 transition-colors cursor-pointer flex items-center justify-center relative overflow-hidden"
                    >
                      <RotateCcw size={32} strokeWidth={2.5} className="drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Game Over Modal */}
      <AnimatePresence>
        {(winner || isDraw) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1, duration: 0.5 } }}
            exit={{ opacity: 0, transition: { delay: 0, duration: 0.3 } }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ delay: 1.2, type: 'spring', damping: 20, stiffness: 300 }}
              className="relative w-full max-w-sm box-glossy border-2 border-cyan-400 p-8 rounded-3xl shadow-[0_0_30px_rgba(34,211,238,0.4)] flex flex-col items-center overflow-hidden"
            >
              {/* Glossy gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-white/20 pointer-events-none rounded-3xl"></div>

              <h2 className="text-3xl font-black tracking-wider mb-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase text-center relative z-10">
                {winner ? (winner === 'X' ? `${player1Name} Wins!` : gameMode === 'pve' ? 'AI Wins!' : `${player2Name} Wins!`) : 'Draw!'}
              </h2>
              
              <div className="mb-8 relative z-10">
                <span className="text-lg text-white/70 font-semibold tracking-wide">
                  {winner ? 'Great job!' : 'Good game!'}
                </span>
              </div>

              <div className="flex flex-col gap-4 w-full relative z-10">
                <motion.button 
                  disabled={!winner && !isDraw}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { 
                    if (gameMode === 'pve' && winner === 'X' && difficultyLevel < 500) {
                        setDifficultyLevel(prev => prev + 1);
                    }
                    resetGame(); 
                    triggerVibrate(50); 
                    playSound('ui_click'); 
                  }}
                  className={`w-full py-4 border rounded-2xl text-xl font-bold tracking-widest transition-all backdrop-blur-md relative overflow-hidden group ${
                      !winner && !isDraw ? 'opacity-50 cursor-not-allowed text-gray-500 border-gray-600 bg-gray-900/50' : 
                      gameMode === 'pve' && winner === 'X' && difficultyLevel < 500 
                      ? 'cursor-pointer bg-yellow-900/50 border-yellow-400 text-yellow-300 hover:text-white hover:bg-yellow-400/40 shadow-[0_0_15px_rgba(250,204,21,0.4),inset_0_0_10px_rgba(250,204,21,0.3)]'
                      : 'cursor-pointer bg-cyan-900/50 border-cyan-400 text-cyan-300 hover:text-white hover:bg-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.4),inset_0_0_10px_rgba(34,211,238,0.3)]'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  {gameMode === 'pve' && winner === 'X' && difficultyLevel < 500 ? 'NEXT LEVEL' : 'PLAY AGAIN'}
                </motion.button>
                
                <motion.button 
                  disabled={!winner && !isDraw}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setView('mode-select'); resetGame(); triggerVibrate(30); playSound('ui_click'); }}
                  className={`w-full py-4 border rounded-2xl text-xl font-bold tracking-widest transition-all backdrop-blur-md relative overflow-hidden group ${
                    !winner && !isDraw ? 'opacity-50 cursor-not-allowed text-gray-500 border-gray-600 bg-gray-900/50' :
                    'cursor-pointer bg-purple-900/50 border-purple-400 text-purple-300 hover:text-white hover:bg-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.4),inset_0_0_10px_rgba(168,85,247,0.3)]'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  HOME SCREEN
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Difficulty ModalOverlay */}
      <AnimatePresence>
        {showDifficultyModal && (() => {
          const LEVELS_PER_PAGE = 36;
          const TOTAL_LEVELS = 500;
          const totalPages = Math.ceil(TOTAL_LEVELS / LEVELS_PER_PAGE);
          const startLevel = levelPage * LEVELS_PER_PAGE + 1;
          const endLevel = Math.min((levelPage + 1) * LEVELS_PER_PAGE, TOTAL_LEVELS);
          const currentLevels = Array.from({ length: endLevel - startLevel + 1 }, (_, i) => startLevel + i);

          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm box-glossy border-2 border-cyan-400 p-6 rounded-3xl shadow-[0_0_30px_rgba(34,211,238,0.4)] flex flex-col items-center"
            >
              <button 
                onClick={() => { setShowDifficultyModal(false); triggerVibrate(30); playSound('ui_click'); }}
                className="absolute top-4 right-4 text-cyan-400 hover:text-white transition-colors bg-cyan-900/40 p-2 rounded-full border border-cyan-400/50 cursor-pointer z-10"
              >
                <X size={24} strokeWidth={3} />
              </button>

              <h2 className="text-2xl font-bold tracking-wider mb-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                SELECT LEVEL
              </h2>

              <h3 className="text-lg font-black tracking-widest mb-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                LEVEL {difficultyLevel}
              </h3>

              <div className="grid grid-cols-6 gap-2 mb-6 w-full max-w-[300px]">
                {currentLevels.map(level => {
                  const isLocked = level > maxUnlockedLevel;
                  return (
                  <button
                    key={level}
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) return;
                      setDifficultyLevel(level);
                      triggerVibrate(20);
                      playSound('ui_click');
                    }}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-sm transition-all focus:outline-none ${
                        isLocked 
                        ? 'bg-gray-800/50 text-gray-500 border border-gray-700/50 cursor-not-allowed'
                        : difficultyLevel === level 
                        ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.8)] scale-110' 
                        : 'bg-[#1e1b4b] text-cyan-400 border border-cyan-900/50 hover:border-cyan-400 hover:scale-105 cursor-pointer'
                    }`}
                  >
                    {isLocked ? <Lock size={16} /> : level}
                  </button>
                )})}
              </div>

              <div className="flex items-center justify-between w-full max-w-[300px] mb-6">
                 <button 
                    disabled={levelPage === 0}
                    onClick={() => { setLevelPage(prev => prev - 1); playSound('ui_click'); }}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${levelPage === 0 ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600' : 'bg-cyan-900/50 text-cyan-400 border border-cyan-400 hover:bg-cyan-800/80 cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.2)]'}`}
                 >
                    PREV
                 </button>
                 <span className="text-white text-sm font-bold tracking-widest opacity-80">
                    PAGE {levelPage + 1} / {totalPages}
                 </span>
                 <button 
                    disabled={levelPage === totalPages - 1}
                    onClick={() => { setLevelPage(prev => prev + 1); playSound('ui_click'); }}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${levelPage === totalPages - 1 ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600' : 'bg-cyan-900/50 text-cyan-400 border border-cyan-400 hover:bg-cyan-800/80 cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.2)]'}`}
                 >
                    NEXT
                 </button>
              </div>

              <button 
                onClick={() => { setShowDifficultyModal(false); setView('name-entry'); resetGame(); triggerVibrate(50); playSound('ui_click'); }}
                className="w-full max-w-[300px] py-4 bg-cyan-900/30 border-2 border-cyan-400 rounded-2xl text-xl font-bold tracking-widest hover:bg-cyan-400/30 active:scale-95 transition-all text-white backdrop-blur-sm cursor-pointer shadow-[inset_0_0_10px_rgba(34,211,238,0.3)]"
              >
                PLAY NOW
              </button>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
