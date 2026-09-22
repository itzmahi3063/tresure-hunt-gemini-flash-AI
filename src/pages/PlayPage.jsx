import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Gift,
  Grid,
  Sparkles,
  Gem,
  X,
  Trophy,
  Frown,
  Meh,
  RefreshCw,
  Coins,
  Brain,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { formatGems, formatUsdt } from '../utils/format';
import api from '../services/api';
import confetti from 'canvas-confetti';
import { showMonetagInterstitial, showGameOrChestAd, showQuizAdFlow } from '../services/ads';
import { setAdexiumGameInProgress } from '../services/adexium';

// ==========================================
// EASY MATH QUESTION GENERATOR FOR QUIZ
// ==========================================
function generateMathQuestion() {
  const operations = ['+', '-', '*', '/'];
  const op = operations[Math.floor(Math.random() * operations.length)];
  let num1, num2, answer;

  if (op === '+') {
    num1 = Math.floor(Math.random() * 20) + 1;
    num2 = Math.floor(Math.random() * 20) + 1;
    answer = num1 + num2;
  } else if (op === '-') {
    num1 = Math.floor(Math.random() * 25) + 5;
    num2 = Math.floor(Math.random() * (num1 - 1)) + 1;
    answer = num1 - num2;
  } else if (op === '*') {
    num1 = Math.floor(Math.random() * 10) + 2;
    num2 = Math.floor(Math.random() * 9) + 2;
    answer = num1 * num2;
  } else {
    // Division: ensure clean integer result
    num2 = Math.floor(Math.random() * 8) + 2; // divisor 2..9
    answer = Math.floor(Math.random() * 9) + 2; // answer 2..10
    num1 = num2 * answer; // num1 / num2 = answer
  }

  // Generate 3 unique distractors
  const distractors = new Set();
  let attempts = 0;
  while (distractors.size < 3 && attempts < 30) {
    attempts++;
    const delta = (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 6) + 1);
    const candidate = answer + delta;
    if (candidate >= 0 && candidate !== answer) {
      distractors.add(candidate);
    }
  }
  let fallback = 1;
  while (distractors.size < 3) {
    if (!distractors.has(answer + fallback) && answer + fallback >= 0) {
      distractors.add(answer + fallback);
    } else if (!distractors.has(answer - fallback) && answer - fallback >= 0) {
      distractors.add(answer - fallback);
    }
    fallback++;
  }

  const options = [answer, ...Array.from(distractors)].sort(() => Math.random() - 0.5);

  return {
    num1,
    num2,
    op: op === '*' ? '×' : op === '/' ? '÷' : op,
    answer,
    options
  };
}

// ==========================================
// UNBEATABLE MINIMAX ALGORITHM FOR AI BOT
// ==========================================
function checkWinnerState(squares) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (let [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return squares.includes(null) ? null : 'draw';
}

function minimax(squares, depth, isMaximizing) {
  const winner = checkWinnerState(squares);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;
  if (winner === 'draw') return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (squares[i] === null) {
        squares[i] = 'O';
        const score = minimax(squares, depth + 1, false);
        squares[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (squares[i] === null) {
        squares[i] = 'X';
        const score = minimax(squares, depth + 1, true);
        squares[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

function getBestBotMove(squares, difficultyMode = 'hard') {
  // If in 'beatable' mode (10% chance match), give smart player an opening:
  if (difficultyMode === 'beatable') {
    const emptyIndices = squares.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
    
    // 1. If bot can win immediately, do it 70% of the time (still feels smart)
    for (let idx of emptyIndices) {
      const copy = [...squares];
      copy[idx] = 'O';
      if (checkWinnerState(copy) === 'O' && Math.random() < 0.70) {
        return idx;
      }
    }

    // 2. In 40% of moves in beatable mode, pick a random open spot instead of blocking, giving the user a chance to win if they play smartly
    if (Math.random() < 0.45 && emptyIndices.length > 0) {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }
  }

  // Otherwise (90% matches or default hard): 100% Unbeatable Minimax
  let bestScore = -Infinity;
  let move = null;
  for (let i = 0; i < 9; i++) {
    if (squares[i] === null) {
      squares[i] = 'O';
      const score = minimax(squares, 0, false);
      squares[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
}

export default function PlayPage() {
  const { user, setUser, setActiveTab } = useApp();

  // Mode: 'list' | 'tictactoe_in_game' | 'lucky_draw_modal'
  const [currentView, setCurrentView] = useState('list');
  const [showPayConfirmModal, setShowPayConfirmModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Daily Game Limits
  const [dailyStats, setDailyStats] = useState({
    luckyDrawsToday: 0,
    maxLuckyDraws: 10,
    tictactoeToday: 0,
    maxTictactoe: 10,
    quizToday: 0,
    maxQuiz: 10
  });

  // Quiz state
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [selectedQuizOption, setSelectedQuizOption] = useState(null);
  const [quizStatus, setQuizStatus] = useState('idle'); // 'idle' | 'correct' | 'incorrect'
  const [isClaimingQuiz, setIsClaimingQuiz] = useState(false);
  const [quizAdProgress, setQuizAdProgress] = useState('');

  // Tic-Tac-Toe state
  const [board, setBoard] = useState(Array(9).fill(null));
  const [difficultyMode, setDifficultyMode] = useState('hard');
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameOverResult, setGameOverResult] = useState(null); // 'win' | 'lose' | 'draw' | null

  // Lucky Draw state
  const [selectedCardIdx, setSelectedCardIdx] = useState(null);
  const [drawOutcome, setDrawOutcome] = useState(null); // { reward, otherCards }
  const [drawing, setDrawing] = useState(false);

  // Fetch stats & active sessions on mount
  useEffect(() => {
    fetchGameStats();
    checkActiveSession();
  }, []);

  const fetchGameStats = async () => {
    try {
      const res = await api.get('/game/stats');
      if (res.data.success) {
        setDailyStats({
          luckyDrawsToday: res.data.luckyDrawsToday || 0,
          maxLuckyDraws: res.data.maxLuckyDraws || 10,
          tictactoeToday: res.data.tictactoeToday || 0,
          maxTictactoe: res.data.maxTictactoe || 10,
          quizToday: res.data.quizToday || 0,
          maxQuiz: res.data.maxQuiz || 10
        });
      }
    } catch (err) {
      console.warn('Could not load game stats:', err);
    }
  };

  const checkActiveSession = async () => {
    try {
      const res = await api.get('/game/tictactoe/session');
      if (res.data.success && res.data.session) {
        const session = res.data.session;
        const currentBoard = session.board || Array(9).fill(null);
        setBoard(currentBoard);
        setDifficultyMode(session.difficultyMode || 'hard');
        setIsPlayerTurn(session.isPlayerTurn ?? true);
        setCurrentView('tictactoe_in_game');
        setAdexiumGameInProgress(true);

        // Check if game was already finished when app was closed/reloaded
        const winner = checkWinnerState(currentBoard);
        if (winner) {
          handleFinishGame(winner, currentBoard);
        }
      }
    } catch (err) {
      console.warn('Could not restore session:', err);
    }
  };

  // 1. Trigger Start / Pay Prompt
  const handleInitiateTicTacToe = () => {
    triggerHaptic('selection');
    if (dailyStats.tictactoeToday >= dailyStats.maxTictactoe) {
      alert('You have reached the daily limit of 10/10 Tic-Tac-Toe games today! Come back tomorrow.');
      return;
    }
    setShowPayConfirmModal(true);
  };

  // 2. Pay 1000 GEMS and Start
  const handleConfirmPaymentAndStart = async () => {
    if (!user || (user.diamonds || 0) < 1000) {
      triggerHaptic('notification', 'error');
      alert('Insufficient GEMS! You need at least 1,000 GEMS to start.');
      setShowPayConfirmModal(false);
      return;
    }

    setIsProcessingPayment(true);
    triggerHaptic('impact', 'medium');

    try {
      // Alternating Adsgram (49079) / Monetag ad with Gigapub fallback
      await showGameOrChestAd({ flowKey: 'game' });

      const res = await api.post('/game/tictactoe/start');
      if (res.data.success) {
        if (res.data.user) setUser(res.data.user);
        const session = res.data.session;
        setBoard(session.board || Array(9).fill(null));
        setDifficultyMode(session.difficultyMode || 'hard');
        setIsPlayerTurn(true);
        setGameOverResult(null);
        setShowPayConfirmModal(false);
        setCurrentView('tictactoe_in_game');
        setAdexiumGameInProgress(true); // suppress Adexium auto-ads while playing
        triggerHaptic('notification', 'success');
        fetchGameStats();
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      alert(err.response?.data?.error || err.message || 'Failed to start game');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // 3. User Click Move
  const handlePlayerMove = async (index) => {
    if (board[index] || !isPlayerTurn || isBotThinking || gameOverResult) return;

    triggerHaptic('impact', 'light');
    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);

    api.post('/game/tictactoe/save', { board: newBoard, isPlayerTurn: false }).catch(() => {});

    const playerResult = checkWinnerState(newBoard);
    if (playerResult) {
      handleFinishGame(playerResult, newBoard);
      return;
    }

    // Bot's Turn (90% Unbeatable Minimax / 10% Beatable Opportunity)
    setIsPlayerTurn(false);
    setIsBotThinking(true);

    setTimeout(() => {
      const botMove = getBestBotMove(newBoard, difficultyMode);
      if (botMove !== null) {
        newBoard[botMove] = 'O';
        setBoard([...newBoard]);
      }

      const botResult = checkWinnerState(newBoard);
      if (botResult) {
        handleFinishGame(botResult, newBoard);
      } else {
        setIsPlayerTurn(true);
        api.post('/game/tictactoe/save', { board: newBoard, isPlayerTurn: true }).catch(() => {});
      }
      setIsBotThinking(false);
    }, 550);
  };

  // 4. Finish Game & Credit Rewards
  const handleFinishGame = async (winner, finalBoard) => {
    let outcome = 'lose';
    if (winner === 'X') outcome = 'win';
    else if (winner === 'draw') outcome = 'draw';

    setGameOverResult(outcome);
    setAdexiumGameInProgress(false);

    if (outcome === 'win') {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
      triggerHaptic('notification', 'success');
    } else if (outcome === 'draw') {
      triggerHaptic('notification', 'warning');
    } else {
      triggerHaptic('notification', 'error');
    }

    try {
      const res = await api.post('/game/tictactoe/finish', {
        result: outcome,
        board: finalBoard
      });
      if (res.data.success) {
        if (res.data.user) setUser(res.data.user);
        fetchGameStats();
      }
    } catch (err) {
      console.error('Error finalizing game:', err);
    }
  };

  const handleReturnToPlay = async () => {
    triggerHaptic('selection');
    setAdexiumGameInProgress(false);
    if (currentView === 'tictactoe_in_game' && !gameOverResult) {
      try {
        await api.post('/game/tictactoe/finish', {
          result: 'lose',
          board
        });
      } catch (e) {
        console.warn('Could not forfeit active session:', e);
      }
    }
    setBoard(Array(9).fill(null));
    setGameOverResult(null);
    setCurrentView('list');
    fetchGameStats();
  };

  // ==========================================
  // LUCKY DRAW: 3-CARD SELECTION & CHAIN RULE
  // ==========================================
  const handleOpenLuckyDrawModal = () => {
    triggerHaptic('selection');
    if (dailyStats.luckyDrawsToday >= dailyStats.maxLuckyDraws) {
      alert('You have completed all 10/10 Lucky Draws today! Come back tomorrow.');
      return;
    }
    resetLuckyDraw();
    setCurrentView('lucky_draw_modal');
    setAdexiumGameInProgress(true); // suppress Adexium auto-ads while playing
  };

  const handlePickLuckyCard = async (index) => {
    if (drawing || drawOutcome !== null) return;
    setDrawing(true);
    setSelectedCardIdx(index);
    triggerHaptic('impact', 'heavy');

    try {
      const res = await api.post('/game/luckydraw/play');
      if (res.data.success) {
        setTimeout(async () => {
          setDrawOutcome({
            reward: res.data.reward,
            otherCards: res.data.otherCards || ['Empty Card', '10 GEMS']
          });
          if (res.data.user) setUser(res.data.user);
          setDrawing(false);
          setAdexiumGameInProgress(false);

          if (res.data.reward?.amount > 0) {
            confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
            triggerHaptic('notification', 'success');
          } else {
            triggerHaptic('notification', 'warning');
          }
          fetchGameStats();

          // Alternating Adsgram (49079) / Monetag ad with Gigapub fallback
          try {
            await showGameOrChestAd({ flowKey: 'game' });
          } catch {
            // Ad failed/skipped — reward was already granted, nothing to undo.
          }
        }, 850);
      }
    } catch (err) {
      setDrawing(false);
      triggerHaptic('notification', 'error');
      alert(err.response?.data?.error || 'Failed to draw card');
    }
  };

  const resetLuckyDraw = () => {
    setSelectedCardIdx(null);
    setDrawOutcome(null);
    setDrawing(false);
    setAdexiumGameInProgress(true); // suppress Adexium auto-ads for the next pick
  };

  // ==========================================
  // MATH QUIZ GAME HANDLERS
  // ==========================================
  const handleOpenQuizModal = () => {
    triggerHaptic('selection');
    if (dailyStats.quizToday >= dailyStats.maxQuiz) {
      alert('You have completed all 10/10 Math Quizzes today (+100 GEMS earned)! Come back tomorrow.');
      return;
    }
    setQuizQuestion(generateMathQuestion());
    setSelectedQuizOption(null);
    setQuizStatus('idle');
    setQuizAdProgress('');
    setCurrentView('quiz_modal');
    setAdexiumGameInProgress(true);
  };

  const handleSelectQuizOption = (opt) => {
    if (quizStatus === 'correct' || isClaimingQuiz || !quizQuestion) return;
    setSelectedQuizOption(opt);
    if (opt === quizQuestion.answer) {
      setQuizStatus('correct');
      triggerHaptic('notification', 'success');
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
    } else {
      setQuizStatus('incorrect');
      triggerHaptic('notification', 'error');
    }
  };

  const handleRetryQuiz = () => {
    triggerHaptic('selection');
    setSelectedQuizOption(null);
    setQuizStatus('idle');
  };

  const handleClaimQuizReward = async () => {
    if (quizStatus !== 'correct' || isClaimingQuiz) return;
    setIsClaimingQuiz(true);
    setQuizAdProgress('Preparing ad sequence...');
    triggerHaptic('impact', 'medium');

    try {
      const watchStartedAt = Date.now();
      await showQuizAdFlow({
        onProgress: (status) => setQuizAdProgress(status)
      });

      const res = await api.post('/game/quiz/claim', { watchStartedAt });
      if (res.data.success) {
        if (res.data.user) setUser(res.data.user);
        triggerHaptic('notification', 'success');
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        await fetchGameStats();

        if ((dailyStats.quizToday + 1) >= (dailyStats.maxQuiz || 10)) {
          alert('Awesome! You have completed all 10/10 Math Quizzes today (+100 GEMS earned)!');
          setCurrentView('list');
        } else {
          setQuizQuestion(generateMathQuestion());
          setSelectedQuizOption(null);
          setQuizStatus('idle');
        }
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      alert(err.response?.data?.error || err.message || 'Failed to claim quiz reward');
    } finally {
      setIsClaimingQuiz(false);
      setQuizAdProgress('');
    }
  };

  // Helper to get card display text
  const getCardContent = (idx) => {
    if (drawOutcome === null) {
      return {
        isPicked: false,
        label: `Card #${idx + 1}`,
        isGold: false
      };
    }

    if (idx === selectedCardIdx) {
      return {
        isPicked: true,
        label: drawOutcome.reward.label,
        isGold: true,
        reward: drawOutcome.reward
      };
    } else {
      // Unselected other cards
      const otherIdx = idx > selectedCardIdx ? idx - 1 : idx;
      const otherLabel = drawOutcome.otherCards[otherIdx] || '10 GEMS';
      return {
        isPicked: false,
        label: otherLabel,
        isGold: false
      };
    }
  };

  // =========================================================================
  // VIEW: IN-GAME SCREEN (Matched to Image 3: media_1789483004132.png)
  // =========================================================================
  if (currentView === 'tictactoe_in_game') {
    return (
      <div className="min-h-screen pb-28 pt-4 px-4 max-w-md mx-auto flex flex-col items-center justify-between animate-fadeIn select-none">
        <div className="w-full flex flex-col items-center space-y-3">
          {/* Header */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
                <Grid size={18} className="text-cyan-400" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-wide">Tic-Tac-Toe</h2>
            </div>
            <button
              onClick={handleReturnToPlay}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
              title="Exit Game"
            >
              <X size={18} />
            </button>
          </div>

          {/* Turn Indicator Pill */}
          <div className="bg-[#1A1528] border border-[#7C3AED]/50 px-4 py-1.5 rounded-full text-xs font-bold text-[#C084FC] tracking-wide shadow-md">
            {isBotThinking ? (
              <span className="flex items-center space-x-1.5 animate-pulse">
                <span>Opponent's Turn (O)...</span>
              </span>
            ) : isPlayerTurn ? (
              <span>Your Turn (X)</span>
            ) : (
              <span>Opponent's Turn (O)</span>
            )}
          </div>
        </div>

        {/* 3x3 Dark Game Board Container (Image 3) */}
        <div className="w-full max-w-[340px] bg-[#121522] border border-[#22283C] rounded-[28px] p-4 shadow-2xl my-6">
          <div className="grid grid-cols-3 gap-3">
            {board.map((cell, idx) => (
              <button
                key={idx}
                onClick={() => handlePlayerMove(idx)}
                disabled={!!cell || !isPlayerTurn || isBotThinking || !!gameOverResult}
                className={`h-24 sm:h-28 rounded-2xl flex items-center justify-center font-black text-4xl transition-all duration-150 ${
                  cell === 'X'
                    ? 'bg-[#0E111C] border border-cyan-500/60 text-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.35)]'
                    : cell === 'O'
                    ? 'bg-[#0E111C] border border-rose-500/60 text-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.35)]'
                    : 'bg-[#0F121F] border border-[#1E2336] hover:border-cyan-500/40 active:scale-95'
                }`}
              >
                {cell === 'X' && <span className="animate-scaleUp">X</span>}
                {cell === 'O' && <span className="animate-scaleUp">O</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Reward Ratio Pills (Image 3) */}
        <div className="w-full flex items-center justify-center space-x-2 mb-2">
          <div className="bg-[#151928] border border-[#22283C] px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5">
            <span className="text-gray-400 text-[11px]">Win:</span>
            <span className="text-emerald-400">+200</span>
          </div>

          <div className="bg-[#151928] border border-[#22283C] px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5">
            <span className="text-gray-400 text-[11px]">Draw:</span>
            <span className="text-white">1000</span>
          </div>

          <div className="bg-[#151928] border border-[#22283C] px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5">
            <span className="text-gray-400 text-[11px]">Lose:</span>
            <span className="text-rose-400">500</span>
          </div>
        </div>

        {/* GAME OVER MODAL (Matched to Image 2: media_1789482993164.png) */}
        {gameOverResult && (
          <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-[#131726] border border-[#7C3AED]/60 rounded-3xl p-6 w-full max-w-sm text-center shadow-[0_0_35px_rgba(124,58,237,0.3)] space-y-4 animate-scaleUp my-auto">
              {/* Result Icon */}
              <div className="flex justify-center">
                {gameOverResult === 'lose' && (
                  <div className="w-18 h-18 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.4)]">
                    <Frown size={42} className="text-rose-400" />
                  </div>
                )}
                {gameOverResult === 'win' && (
                  <div className="w-18 h-18 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                    <Trophy size={40} className="text-emerald-400" />
                  </div>
                )}
                {gameOverResult === 'draw' && (
                  <div className="w-18 h-18 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                    <Meh size={40} className="text-amber-400" />
                  </div>
                )}
              </div>

              {/* Title & Reward Text */}
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white">
                  {gameOverResult === 'lose' && 'You Lost!'}
                  {gameOverResult === 'win' && 'You Won!'}
                  {gameOverResult === 'draw' && "It's a Draw!"}
                </h3>

                <div
                  className={`text-2xl font-black ${
                    gameOverResult === 'win'
                      ? 'text-emerald-400'
                      : gameOverResult === 'draw'
                      ? 'text-yellow-400'
                      : 'text-rose-400'
                  }`}
                >
                  {gameOverResult === 'win' && '+1200 GEMS'}
                  {gameOverResult === 'draw' && '+1000 GEMS'}
                  {gameOverResult === 'lose' && '+500 GEMS'}
                </div>

                <p className="text-xs text-[#8E95A5] font-medium">Added to your wallet</p>
              </div>

              {/* Return to Play Button (Green) */}
              <button
                onClick={handleReturnToPlay}
                className="w-full bg-[#00DF82] hover:bg-[#00DF82]/90 text-[#0A0A0E] font-extrabold py-3.5 rounded-2xl text-sm shadow-[0_4px_16px_rgba(0,223,130,0.35)] active:scale-95 transition-all mt-3"
              >
                Return to Play
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN PLAY PAGE (Matched to Screenshot 1 & 2)
  // =========================================================================
  return (
    <div className="min-h-screen pb-28 pt-2 px-4 max-w-md mx-auto space-y-4 animate-fadeIn">
      {/* 1. HEADER */}
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-white tracking-wide">Play &amp; Earn</h2>
        <p className="text-xs text-[#8E95A5]">
          Try Lucky Draw &amp; play Tic-Tac-Toe to earn more <span className="text-white font-semibold">GEMS</span>
        </p>
      </div>

      {/* 2. GAME CARD 1: LUCKY DRAW (3D OAK & GOLD/PURPLE) */}
      <div
        style={{
          background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
          borderTop: '2px solid #825429',
          borderLeft: '1.5px solid #4a341f',
          borderRight: '1.5px solid #4a341f',
          borderBottom: '5px solid #140d06',
          boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8), 0 0 20px rgba(168, 85, 247, 0.15)'
        }}
        className="rounded-[28px] p-5 space-y-4 relative overflow-hidden"
      >
        <div className="flex items-center space-x-3.5">
          {/* 3D Purple Icon Box */}
          <div
            style={{
              background: 'linear-gradient(180deg, #c084fc 0%, #9333ea 55%, #6b21a8 100%)',
              borderTop: '1.5px solid #e9d5ff',
              borderBottom: '3.5px solid #3b0764',
              boxShadow: '0 4px 14px rgba(147, 51, 234, 0.4)'
            }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
          >
            <Gift size={28} />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-white">Lucky Draw</h3>
            <p className="text-xs font-bold text-[#c084fc]">
              {dailyStats.luckyDrawsToday}/10 draws completed today
            </p>
            <div className="inline-flex items-center space-x-1.5 bg-[#140c06] border border-[#382413] px-2.5 py-0.5 rounded-lg">
              <Gem size={11} className="text-[#f7bf46]" />
              <span className="text-[11px] font-mono font-bold text-[#f7bf46]">Win GEMS / USDT Jackpot</span>
            </div>
          </div>
        </div>

        {/* 3D Action Button */}
        <button
          onClick={handleOpenLuckyDrawModal}
          style={{
            background: 'linear-gradient(180deg, #c084fc 0%, #9333ea 50%, #7e22ce 100%)',
            borderTop: '1.5px solid #e9d5ff',
            borderLeft: '1px solid #9333ea',
            borderRight: '1px solid #9333ea',
            borderBottom: '4px solid #4c1d95',
            color: '#ffffff',
            boxShadow: '0 6px 16px rgba(147, 51, 234, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5)'
          }}
          className="w-full font-black py-3.5 rounded-2xl active:translate-y-1 active:border-b-[1px] transition-all text-xs uppercase tracking-wider"
        >
          Play Lucky Draw
        </button>
      </div>

      {/* 3. GAME CARD 2: PLAY TIC-TAC-TOE (3D OAK & CYAN) */}
      <div
        style={{
          background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
          borderTop: '2px solid #825429',
          borderLeft: '1.5px solid #4a341f',
          borderRight: '1.5px solid #4a341f',
          borderBottom: '5px solid #140d06',
          boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 229, 255, 0.15)'
        }}
        className="rounded-[28px] p-5 space-y-4 relative overflow-hidden"
      >
        <div className="flex items-center space-x-3.5">
          {/* 3D Cyan Icon Box */}
          <div
            style={{
              background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 55%, #0369a1 100%)',
              borderTop: '1.5px solid #bae6fd',
              borderBottom: '3.5px solid #082f49',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
            }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
          >
            <Grid size={28} />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-white">Play Tic-Tac-Toe</h3>
            <p className="text-xs font-bold text-[#38bdf8]">
              {dailyStats.tictactoeToday}/10 games completed today
            </p>
            <div className="inline-flex items-center space-x-1.5 bg-[#140c06] border border-[#382413] px-2.5 py-0.5 rounded-lg">
              <Gem size={11} className="text-cyan-400" />
              <span className="text-[11px] font-mono font-bold text-white">Entry: 1,000 GEMS</span>
            </div>
          </div>
        </div>

        {/* 3D Action Button */}
        <button
          onClick={handleInitiateTicTacToe}
          style={{
            background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%)',
            borderTop: '1.5px solid #bae6fd',
            borderLeft: '1px solid #0284c7',
            borderRight: '1px solid #0284c7',
            borderBottom: '4px solid #0c4a6e',
            color: '#ffffff',
            boxShadow: '0 6px 16px rgba(2, 132, 199, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5)'
          }}
          className="w-full font-black py-3.5 rounded-2xl active:translate-y-1 active:border-b-[1px] transition-all text-xs uppercase tracking-wider font-heading"
        >
          Play Tic-Tac-Toe Arena
        </button>
      </div>

      {/* 4. GAME CARD: MATH QUIZ (3D OAK & EMERALD) */}
      <div
        style={{
          background: 'linear-gradient(180deg, #322113 0%, #26170c 100%)',
          borderTop: '2px solid #825429',
          borderLeft: '1.5px solid #4a341f',
          borderRight: '1.5px solid #4a341f',
          borderBottom: '5px solid #140d06',
          boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8), 0 0 20px rgba(16, 185, 129, 0.15)'
        }}
        className="rounded-[28px] p-5 space-y-4 relative overflow-hidden"
      >
        <div className="flex items-center space-x-3.5">
          {/* 3D Emerald Icon Box */}
          <div
            style={{
              background: 'linear-gradient(180deg, #34d399 0%, #059669 55%, #047857 100%)',
              borderTop: '1.5px solid #a7f3d0',
              borderBottom: '3.5px solid #064e3b',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)'
            }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
          >
            <Brain size={28} />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-white">Math Quiz</h3>
            <p className="text-xs font-bold text-[#34d399]">
              {dailyStats.quizToday || 0}/10 completed today
            </p>
            <div className="inline-flex items-center space-x-1.5 bg-[#140c06] border border-[#382413] px-2.5 py-0.5 rounded-lg">
              <Gem size={11} className="text-[#34d399]" />
              <span className="text-[11px] font-mono font-bold text-[#34d399]">Reward: 10 GEMS / Solve</span>
            </div>
          </div>
        </div>

        {/* 3D Action Button */}
        <button
          onClick={handleOpenQuizModal}
          style={{
            background: 'linear-gradient(180deg, #34d399 0%, #059669 50%, #047857 100%)',
            borderTop: '1.5px solid #a7f3d0',
            borderLeft: '1px solid #059669',
            borderRight: '1px solid #059669',
            borderBottom: '4px solid #064e3b',
            color: '#ffffff',
            boxShadow: '0 6px 16px rgba(5, 150, 105, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5)'
          }}
          className="w-full font-black py-3.5 rounded-2xl active:translate-y-1 active:border-b-[1px] transition-all text-xs uppercase tracking-wider font-heading"
        >
          Play Math Quiz
        </button>
      </div>

      {/* 5. GAME CARD 3: WEEKLY CONTEST (3D OAK & GOLD) */}
      <div
        style={{
          background: 'linear-gradient(180deg, #382710 0%, #241608 100%)',
          borderTop: '2px solid #eab308',
          borderLeft: '1.5px solid #a16207',
          borderRight: '1.5px solid #a16207',
          borderBottom: '5px solid #140d04',
          boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.8), 0 0 25px rgba(234, 179, 8, 0.25)'
        }}
        className="rounded-[28px] p-5 space-y-4 relative overflow-hidden"
      >
        <div className="flex items-center space-x-3.5">
          {/* 3D Gold Trophy Icon Box */}
          <div
            style={{
              background: 'linear-gradient(180deg, #fde047 0%, #eab308 55%, #ca8a04 100%)',
              borderTop: '1.5px solid #fef08a',
              borderBottom: '3.5px solid #713f12',
              boxShadow: '0 4px 14px rgba(234, 179, 8, 0.5)'
            }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-[#1c1202] font-black shrink-0 text-2xl"
          >
            🏆
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <h3 className="text-base font-black text-white font-heading">Weekly Contest</h3>
              <span className="text-[9px] bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-400/40 font-numbers font-bold">
                TOP 5
              </span>
            </div>
            <p className="text-xs font-bold text-yellow-400">
              Compete for Top 5 &amp; Win Massive Rewards
            </p>
            <div className="inline-flex items-center space-x-1.5 bg-[#140c06] border border-yellow-500/30 px-2.5 py-0.5 rounded-lg">
              <span className="text-[11px] font-numbers font-bold text-yellow-300">⭐ Min 10 Referrals to Qualify</span>
            </div>
          </div>
        </div>

        {/* 3D Action Button */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('refer');
            const checkScroll = (attempts = 0) => {
              const el = document.getElementById('weekly-contest');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else if (attempts < 10) {
                setTimeout(() => checkScroll(attempts + 1), 100);
              }
            };
            setTimeout(() => checkScroll(0), 420);
          }}
          className="w-full btn-3d-gold py-3.5 rounded-2xl text-xs uppercase tracking-wider font-heading font-black flex items-center justify-center space-x-2 text-black"
        >
          <Trophy size={16} className="text-amber-950" />
          <span>Enter Weekly Contest</span>
        </button>
      </div>

      {/* 5. HOW IT WORKS / PRIZE POOL SECTION */}
      <div className="pt-2 space-y-3">
        <div className="flex items-center space-x-2 text-[#f7bf46] font-black text-sm uppercase tracking-wider">
          <Sparkles size={18} className="text-[#f7bf46]" />
          <span>Game Rules &amp; Prize Pool</span>
        </div>

        {/* Prize Pool Showcase: Lucky Draw */}
        <div
          style={{
            background: 'linear-gradient(180deg, #2b1c10 0%, #1a1008 100%)',
            borderTop: '1.5px solid #664b2d',
            borderLeft: '1px solid #4a341f',
            borderRight: '1px solid #4a341f',
            borderBottom: '4px solid #0f0904',
            boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
          }}
          className="rounded-[24px] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-black text-white text-sm">
              <Gift size={16} className="text-purple-400" />
              <span>Lucky Draw Prize Pool</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
              10 Draws / Day
            </span>
          </div>

          <p className="text-[11px] text-[#a89782] font-medium leading-relaxed">
            Pick 1 of 3 ancient mystery cards to discover hidden pirate treasure! Possible prize pool rewards:
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-[#140c06] border border-[#3d2918] p-2 rounded-xl flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
                $
              </div>
              <div>
                <p className="text-[11px] font-black text-white">$0.005 USDT</p>
                <p className="text-[9px] text-cyan-400 font-medium">Jackpot Reward</p>
              </div>
            </div>

            <div className="bg-[#140c06] border border-[#3d2918] p-2 rounded-xl flex items-center space-x-2">
              <Gem size={18} className="text-[#f7bf46]" />
              <div>
                <p className="text-[11px] font-black text-white">50 GEMS</p>
                <p className="text-[9px] text-[#f7bf46] font-medium">Mega Stash</p>
              </div>
            </div>

            <div className="bg-[#140c06] border border-[#3d2918] p-2 rounded-xl flex items-center space-x-2">
              <Gem size={18} className="text-amber-400" />
              <div>
                <p className="text-[11px] font-black text-white">20 GEMS</p>
                <p className="text-[9px] text-[#a89782] font-medium">Rare Crystals</p>
              </div>
            </div>

            <div className="bg-[#140c06] border border-[#3d2918] p-2 rounded-xl flex items-center space-x-2">
              <Gem size={18} className="text-yellow-500" />
              <div>
                <p className="text-[11px] font-black text-white">10 GEMS</p>
                <p className="text-[9px] text-[#a89782] font-medium">Bounty Cache</p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works: Tic-Tac-Toe */}
        <div
          style={{
            background: 'linear-gradient(180deg, #2b1c10 0%, #1a1008 100%)',
            borderTop: '1.5px solid #664b2d',
            borderLeft: '1px solid #4a341f',
            borderRight: '1px solid #4a341f',
            borderBottom: '4px solid #0f0904',
            boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
          }}
          className="rounded-[24px] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-black text-white text-sm">
              <Grid size={16} className="text-cyan-400" />
              <span>Tic-Tac-Toe Arena</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              10 Games / Day
            </span>
          </div>

          <ul className="space-y-2 text-[#a89782] text-[11px] leading-relaxed">
            <li className="flex items-start space-x-2">
              <span className="text-[#f7bf46] font-black">•</span>
              <span>Entry stake: <strong className="text-white">1000 GEMS</strong> to challenge the master AI bot</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-emerald-400 font-black">•</span>
              <span><strong className="text-emerald-400">Win:</strong> Claim <strong className="text-white">1200 GEMS</strong> (+200 GEMS pure profit)</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-amber-400 font-black">•</span>
              <span><strong className="text-amber-400">Draw:</strong> Receive <strong className="text-white">1000 GEMS</strong> full refund (break even)</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-rose-400 font-black">•</span>
              <span><strong className="text-rose-400">Defeat:</strong> Receive <strong className="text-white">500 GEMS</strong> consolation (-500 GEMS loss)</span>
            </li>
          </ul>
        </div>

        {/* How It Works: Math Quiz */}
        <div
          style={{
            background: 'linear-gradient(180deg, #2b1c10 0%, #1a1008 100%)',
            borderTop: '1.5px solid #664b2d',
            borderLeft: '1px solid #4a341f',
            borderRight: '1px solid #4a341f',
            borderBottom: '4px solid #0f0904',
            boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
          }}
          className="rounded-[24px] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-black text-white text-sm">
              <Brain size={16} className="text-emerald-400" />
              <span>Math Quiz Challenge</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              10 Quizzes / Day
            </span>
          </div>

          <ul className="space-y-2 text-[#a89782] text-[11px] leading-relaxed">
            <li className="flex items-start space-x-2">
              <span className="text-[#34d399] font-black">•</span>
              <span>Solve easy math equations with random addition, subtraction, multiplication &amp; division.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-emerald-400 font-black">•</span>
              <span>Earn <strong className="text-white font-bold">10 GEMS</strong> for each correct solve (up to 100 GEMS daily).</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-amber-400 font-black">•</span>
              <span>Incorrect answers can be retried immediately on the same equation!</span>
            </li>
          </ul>
        </div>
      </div>

      {/* MODAL 1: START CONFIRMATION (Matched to Image 1: media_1789482993163.png) */}
      {showPayConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#141828] border border-[#22283C] rounded-[28px] p-6 w-full max-w-sm text-center shadow-2xl space-y-5 animate-scaleUp relative my-auto">
            {/* Blue Question Icon (Image 1) */}
            <div className="w-16 h-16 mx-auto rounded-full bg-[#0284C7] flex items-center justify-center shadow-[0_0_24px_rgba(2,132,199,0.5)]">
              <span className="text-white text-3xl font-black">?</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-wide">
                Start Tic-Tac-Toe
              </h3>
              <p className="text-xs text-[#8E95A5] leading-relaxed px-2">
                You need to watch a short Ad and pay <strong className="text-white font-bold">1000 GEMS</strong> to start the match. Proceed?
              </p>
            </div>

            {/* Buttons Row (Cancel vs Pay Now) */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setShowPayConfirmModal(false);
                }}
                disabled={isProcessingPayment}
                className="flex-1 bg-[#1A1F30] hover:bg-[#232A40] text-white font-bold py-3.5 rounded-2xl text-xs transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmPaymentAndStart}
                disabled={isProcessingPayment}
                className="flex-1 bg-[#00DF82] hover:bg-[#00DF82]/90 text-[#0A0A0E] font-extrabold py-3.5 rounded-2xl text-xs shadow-[0_4px_16px_rgba(0,223,130,0.35)] active:scale-95 transition-all"
              >
                {isProcessingPayment ? 'Paying...' : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: 3-CARD LUCKY DRAW (WITH GOLD CARD REVEAL & CHAIN PROBABILITY) */}
      {currentView === 'lucky_draw_modal' && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#151928] border border-purple-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-scaleUp text-center my-auto">
            <button
              onClick={() => {
                setAdexiumGameInProgress(false);
                setCurrentView('list');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X size={20} />
            </button>

            <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mb-2">
              <Gift size={24} className="text-purple-400" />
            </div>

            <h3 className="text-lg font-black text-white">Lucky Draw</h3>
            <p className="text-xs text-[#8E95A5] mb-4">
              {drawOutcome ? 'Cards Revealed!' : 'Pick 1 of 3 Mystery Cards!'}
            </p>

            {/* 3 Mystery Cards Grid */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[0, 1, 2].map((idx) => {
                const card = getCardContent(idx);
                const isSelected = selectedCardIdx === idx;

                return (
                  <button
                    key={idx}
                    onClick={() => handlePickLuckyCard(idx)}
                    disabled={drawing || drawOutcome !== null}
                    className={`h-28 rounded-2xl border flex flex-col items-center justify-center transition-all duration-300 p-2 relative overflow-hidden ${
                      card.isGold
                        ? 'bg-gradient-to-b from-[#FFE57F] via-[#F5A623] to-[#C97D00] text-[#1A1000] border-2 border-[#FFF5B8] shadow-gold-glow scale-105 z-10'
                        : isSelected
                        ? 'bg-purple-600/30 border-purple-400 scale-105'
                        : drawOutcome !== null
                        ? 'bg-gradient-to-b from-[#111C28] to-[#0A121A] border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.15)]'
                        : 'bg-[#0E111C] border-[#22283C] hover:border-purple-500/60 active:scale-95'
                    }`}
                  >
                    {card.isGold ? (
                      <>
                        <Sparkles size={26} className="text-yellow-900 animate-spin" style={{ animationDuration: '3s' }} />
                        <span className="text-[11px] font-black uppercase tracking-tight text-black mt-2 leading-tight">
                          {card.label}
                        </span>
                        <span className="text-[8px] font-bold text-yellow-950 uppercase mt-0.5">
                          Won!
                        </span>
                      </>
                    ) : drawOutcome !== null ? (
                      <>
                        <Gem size={22} className="text-cyan-400/70" />
                        <span className="text-[10px] font-bold text-cyan-300/90 mt-2 leading-tight">
                          {card.label}
                        </span>
                      </>
                    ) : (
                      <>
                        <Gem size={26} className={isSelected ? 'text-purple-300 animate-bounce' : 'text-purple-400'} />
                        <span className="text-[10px] font-bold text-gray-400 mt-2">
                          Card #{idx + 1}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {drawing && (
              <p className="text-xs text-purple-400 font-bold animate-pulse mb-3">
                Revealing Mystery Card...
              </p>
            )}

            {drawOutcome && (
              <div className="mb-4 bg-[#0D101C] border border-[#22283C] p-3 rounded-xl space-y-1 animate-scaleUp">
                <p className="text-xs text-gray-400 font-medium">Your Selected Prize:</p>
                <div className="text-base font-black text-yellow-400 flex items-center justify-center space-x-1.5">
                  <Coins size={16} />
                  <span>{drawOutcome.reward.label}</span>
                </div>
              </div>
            )}

            <div className="flex space-x-2">
              {drawOutcome && dailyStats.luckyDrawsToday < dailyStats.maxLuckyDraws && (
                <button
                  onClick={resetLuckyDraw}
                  className="flex-1 bg-[#20263C] hover:bg-[#2A324E] text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-1.5 text-xs"
                >
                  <RefreshCw size={14} />
                  <span>Draw Again ({10 - dailyStats.luckyDrawsToday} left)</span>
                </button>
              )}
              <button
                onClick={() => setCurrentView('list')}
                className="flex-1 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white font-bold py-3 rounded-xl text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MATH QUIZ CHALLENGE (EASY MATH & ADEXIUM + MONETAG REWARDED POPUP) */}
      {currentView === 'quiz_modal' && quizQuestion && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#151928] border border-emerald-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-scaleUp text-center my-auto space-y-4">
            <button
              onClick={() => {
                setAdexiumGameInProgress(false);
                setCurrentView('list');
              }}
              disabled={isClaimingQuiz}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X size={20} />
            </button>

            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Brain size={24} className="text-emerald-400" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Math Quiz Challenge</h3>
              <div className="flex items-center justify-center space-x-2 mt-1">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Solve #{Math.min((dailyStats.quizToday || 0) + 1, 10)} of 10 today
                </span>
                <span className="text-xs font-bold text-yellow-400 flex items-center space-x-1">
                  <Gem size={12} className="text-yellow-400" />
                  <span>+10 GEMS</span>
                </span>
              </div>
            </div>

            {/* Question Display Card */}
            <div className="bg-[#0e1220] border-2 border-emerald-500/40 rounded-2xl py-5 px-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <p className="text-xs uppercase tracking-widest text-[#8E95A5] font-bold mb-1">
                Solve This Equation
              </p>
              <div className="text-3xl font-black text-white tracking-wider flex items-center justify-center space-x-3">
                <span>{quizQuestion.num1}</span>
                <span className="text-emerald-400 font-extrabold">{quizQuestion.op}</span>
                <span>{quizQuestion.num2}</span>
                <span className="text-emerald-400 font-extrabold">=</span>
                <span className="text-yellow-400">?</span>
              </div>
            </div>

            {/* 4 Options Grid (2x2) */}
            <div className="grid grid-cols-2 gap-2.5">
              {quizQuestion.options.map((option, idx) => {
                const isSelected = selectedQuizOption === option;
                const isCorrect = isSelected && quizStatus === 'correct';
                const isIncorrect = isSelected && quizStatus === 'incorrect';

                let btnStyle = 'bg-[#0E111C] border-[#22283C] text-white hover:border-emerald-500/60';
                if (isCorrect) {
                  btnStyle = 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-105';
                } else if (isIncorrect) {
                  btnStyle = 'bg-rose-500/20 border-rose-400 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-shake';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectQuizOption(option)}
                    disabled={quizStatus === 'correct' || isClaimingQuiz}
                    className={`h-14 rounded-xl border font-black text-lg transition-all flex items-center justify-center space-x-2 ${btnStyle}`}
                  >
                    <span>{option}</span>
                    {isCorrect && <CheckCircle2 size={18} className="text-emerald-400" />}
                    {isIncorrect && <XCircle size={18} className="text-rose-400" />}
                  </button>
                );
              })}
            </div>

            {/* Status and Action Buttons */}
            {quizStatus === 'idle' && (
              <p className="text-xs text-[#8E95A5] font-medium">
                Tap the correct option above to solve!
              </p>
            )}

            {quizStatus === 'incorrect' && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-rose-400 font-bold flex items-center justify-center space-x-1">
                  <XCircle size={14} />
                  <span>Incorrect answer! Don't worry, try again.</span>
                </p>
                <button
                  onClick={handleRetryQuiz}
                  className="w-full bg-[#1A1F30] hover:bg-[#232A40] text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all"
                >
                  <RefreshCw size={14} />
                  <span>Try Again</span>
                </button>
              </div>
            )}

            {quizStatus === 'correct' && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-emerald-400 font-bold flex items-center justify-center space-x-1">
                  <CheckCircle2 size={14} />
                  <span>Correct Answer! (+10 GEMS)</span>
                </p>

                {quizAdProgress && (
                  <div className="bg-[#0e1220] border border-cyan-500/30 rounded-xl p-2.5 text-xs text-cyan-300 font-mono animate-pulse">
                    {quizAdProgress}
                  </div>
                )}

                <button
                  onClick={handleClaimQuizReward}
                  disabled={isClaimingQuiz}
                  className="w-full bg-[#00DF82] hover:bg-[#00DF82]/90 text-[#0A0A0E] font-extrabold py-3.5 rounded-2xl text-xs shadow-[0_4px_16px_rgba(0,223,130,0.35)] active:scale-95 transition-all flex items-center justify-center space-x-2"
                >
                  <Gem size={16} />
                  <span>{isClaimingQuiz ? 'Watching Ad & Claiming...' : 'Claim 10 GEMS'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
