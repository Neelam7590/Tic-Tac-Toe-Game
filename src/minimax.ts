type Player = 'X' | 'O' | null;

export const evaluateBoardHeuristic = (squares: Player[], size: number): number => {
    let score = 0;
    // A simple heuristic evaluating pieces on the board
    // It's mostly about adjacent pieces
    for (let i = 0; i < squares.length; i++) {
        if (squares[i]) {
            const r = Math.floor(i / size);
            const c = i % size;
            
            // Check neighbors
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                        const neighbor = squares[nr * size + nc];
                        if (squares[i] === 'O' && neighbor === 'O') score += 2;
                        if (squares[i] === 'X' && neighbor === 'X') score -= 2;
                    }
                }
            }
        }
    }
    return score;
};

export const getBestMoveMinimax = (
  board: Player[], 
  size: number, 
  depth: number, 
  checkWinner: (sq: Player[], sz: number) => { winner: Player; line: number[] | null }
): number | undefined => {
    let bestScore = -Infinity;
    let bestMove: number | undefined;

    const emptyIndices: number[] = [];
    const occupiedIndices: number[] = [];
    board.forEach((cell, i) => {
        if (cell === null) emptyIndices.push(i);
        else occupiedIndices.push(i);
    });

    if (emptyIndices.length === 0) return undefined;
    
    // First move middle
    if (occupiedIndices.length === 0) {
        return Math.floor((size * size) / 2);
    }
    
    let candidateMoves = emptyIndices;
    if (size > 3) {
        const adjacentMoves = new Set<number>();
        occupiedIndices.forEach(idx => {
            const r = Math.floor(idx / size);
            const c = idx % size;
            for(let dr=-2; dr<=2; dr++){
                for(let dc=-2; dc<=2; dc++){
                    if(dr===0 && dc===0) continue;
                    const nr = r+dr;
                    const nc = c+dc;
                    if(nr>=0 && nr<size && nc>=0 && nc<size){
                        const nIdx = nr * size + nc;
                        if(board[nIdx] === null) adjacentMoves.add(nIdx);
                    }
                }
            }
        });
        if(adjacentMoves.size > 0) {
            candidateMoves = Array.from(adjacentMoves);
        }
    }

    const minimax = (squares: Player[], currentDepth: number, isMaximizing: boolean, alpha: number, beta: number): number => {
        const { winner } = checkWinner(squares, size);
        if (winner === 'O') return 1000 + currentDepth;
        if (winner === 'X') return -1000 - currentDepth;
        
        const isTie = squares.every(cell => cell !== null);
        if (isTie) return 0;
        
        if (currentDepth === 0) {
            return evaluateBoardHeuristic(squares, size);
        }

        let candidates = [];
        squares.forEach((cell, i) => { if (cell === null) candidates.push(i); });
        
        if (size > 3) {
            const adj = new Set<number>();
            for(let i=0; i<squares.length; i++){
                if(squares[i]) {
                    const r = Math.floor(i / size);
                    const c = i % size;
                    for(let dr=-1; dr<=1; dr++) {
                        for(let dc=-1; dc<=1; dc++) {
                            const nr = r+dr, nc = c+dc;
                            if(nr>=0 && nr<size && nc>=0 && nc<size) {
                                const nIdx = nr * size + nc;
                                if(!squares[nIdx]) adj.add(nIdx);
                            }
                        }
                    }
                }
            }
            if(adj.size > 0) {
               candidates = Array.from(adj);
               // keep candidate list tight for performance at depth
               if (candidates.length > 10) {
                   candidates = candidates.slice(0, 10);
               }
            }
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let i of candidates) {
                squares[i] = 'O';
                let ev = minimax(squares, currentDepth - 1, false, alpha, beta);
                squares[i] = null;
                maxEval = Math.max(maxEval, ev);
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let i of candidates) {
                squares[i] = 'X';
                let ev = minimax(squares, currentDepth - 1, true, alpha, beta);
                squares[i] = null;
                minEval = Math.min(minEval, ev);
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    };

    candidateMoves.sort(() => Math.random() - 0.5); // Add some variety when multiple moves are equally good

    for (let i of candidateMoves) {
        board[i] = 'O';
        let score = minimax(board, depth - 1, false, -Infinity, Infinity);
        board[i] = null;
        // console.log(`Move ${i} gives score ${score}`);
        if (score > bestScore) {
            bestScore = score;
            bestMove = i;
        }
    }
    
    return bestMove;
};
