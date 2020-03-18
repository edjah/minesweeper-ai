window.aiState = null;

function aiClickCell(game, row, col) {
    // unflag the cell if the player has mistakenly flagged it
    if (game.cells && game.cells[row][col].status === 'flag') {
        game.clickCell(row, col, true);
    }

    game.clickCell(row, col, false);

    // draw a circle around on top of the cell that was clicked
    let y = game.paddingY + (row + 0.5) * game.cellSize;
    let x = game.paddingX + (col + 0.5) * game.cellSize;

    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(x, y, 3/7 * game.cellSize, 0, 2 * Math.PI);
    ctx.stroke();
}

function useAI(game) {
    const { height, width, numMines, cells } = game;

    // click the top-left cell to start
    if (cells === null) {
        aiClickCell(game, 0, 0);
        return;
    }

    // remove non-visible information from the game cells. no cheating!!!
    let cellValues = [];
    for (let i = 0; i < height; ++i) {
        let row = [];
        for (let j = 0; j < width; ++j) {
            if (cells[i][j].status === 'visible') {
                row.push(cells[i][j].value);
            } else {
                row.push(-1);
            }
        }
        cellValues.push(row);
    }

    let [row, col] = findOptimalClick(height, width, numMines, cellValues);
    aiClickCell(game, row, col);
}

function findOptimalClick(height, width, numMines, cells) {
    // we use this state to cache the positions of known mines
    if (window.aiState === null) {
        window.aiState = {
            knownMines: new Set(),
        };
    }

    // counting the number of hidden
    let numHiddenCells = 0;
    for (let i = 0; i < height; ++i) {
        for (let j = 0; j < width; ++j) {
            numHiddenCells += (cells[i][j] === -1);
        }
    }

    // helper function for finding neighbors of a cell
    function adjacentCoords(row, col, radius) {
        let result = [];
        for (let dy = -radius; dy <= radius; ++dy) {
            for (let dx = -radius; dx <= radius; ++dx) {
                if ((dy !== 0 || dx !== 0)  &&
                    (0 <= row + dy && row + dy < height) &&
                    (0 <= col + dx && col + dx < width)) {
                    result.push([row + dy, col + dx]);
                }
            }
        }
        return result;
    }

    // helper function that generates a list of all k-sized combinations
    // this function is optimized using the assumption that items.length < 8
    // from: https://rosettacode.org/wiki/Combinations#Imperative
    function combinations(items, k) {
        // count the number of 1 bits in a number
        function bitcount(n) {
            let count = 0;
            while (n > 0) {
                count += (n & 1);
                n >>= 1;
            }
            return count;
        }

        // iterate through all possible subsets
        // and select the subsets which have k elements
        let result = [];
        let numSubsets = 1 << items.length;

        for (let n = 0; n < numSubsets; ++n) {
            if (bitcount(n) == k) {
                let m = n;
                let combo = [];
                for (let i = 0; i < items.length; ++i) {
                    if (m & 1) {
                        combo.push(items[i]);
                    }
                    m >>= 1;
                }
                result.push(combo);
            }
        }

        return result;
    }

    function probabilityOfBeingMine(targetRow, targetCol) {
        // this cell is a known mine, so no need to re-compute
        if (window.aiState.knownMines.has(targetRow + ':' + targetCol)) {
            return 1;
        }

        // if there are no visible immediate neighbors, we can't get too much
        // information about this cell, so just guess the prior
        let immediateNeighbors = adjacentCoords(targetRow, targetCol, 1);
        immediateNeighbors = immediateNeighbors.filter(x => cells[x[0]][x[1]] >= 0);
        if (immediateNeighbors.length === 0) {
            return numMines / numHiddenCells;
        }

        // getting a list of all of visible neighbors. we can expand the
        // neighbor radius to give a more confident estimate at the cost of
        // a potentially longer search
        let neighbors = adjacentCoords(targetRow, targetCol, 5);
        neighbors = neighbors.filter(x => cells[x[0]][x[1]] >= 0);

        // helper function which checks all neighbors and makes sure that we
        // haven't assigned too many mines
        function checkNeighbors(minePositions, checkEquality = false) {
            for (let [r, c] of neighbors) {
                let adj = adjacentCoords(r, c, 1);
                let alreadySetMines = 0;
                for (let [i, j] of adj) {
                    alreadySetMines += minePositions.has(i + ':' + j);
                }

                if ((alreadySetMines > cells[r][c]) ||
                    (checkEquality && alreadySetMines != cells[r][c])) {
                    return false;
                }
            }

            return true;
        }

        // counting the number of ways to assign mines such that all of the
        // neighbors have their constraints satisfied. then count the number
        // of ways such that the cell at (targetRow, targetCol) has a mine.
        let totalWays = 0;
        let numTargetWays = 0;

        // perform a dfs through the neighbors and try to make mine assignments
        // that satisfy all neighbor constraints
        function dfs(pos, minePositions) {
            if (pos === neighbors.length) {
                if (checkNeighbors(minePositions, true)) {
                    numTargetWays += minePositions.has(targetRow + ':' + targetCol);
                    totalWays += 1;
                }
                return;
            }

            if (!checkNeighbors(minePositions, false)) {
                return;
            }

            // for the current cell, if there have not been enough mines
            // assigned, generate all possible settings of mines to the
            // unassigned adjacent cells
            let [r, c] = neighbors[pos];
            let adj = adjacentCoords(r, c, 1).filter(x => cells[x[0]][x[1]] === -1);
            let unassigned = adj.filter(x => !minePositions.has(x[0] + ':' + x[1]));

            let expectedMines = cells[r][c];
            let remainingMines = expectedMines - (adj.length - unassigned.length);

            for (let combo of combinations(unassigned, remainingMines)) {
                for (let [i, j] of combo) {
                    minePositions.add(i + ':' + j);
                }

                dfs(pos + 1, minePositions);

                for (let [i, j] of combo) {
                    minePositions.delete(i + ':' + j);
                }
            }
        }

        dfs(0, new Set());

        if (numTargetWays === totalWays) {
            window.aiState.knownMines.add(targetRow + ':' + targetCol);
        }
        return numTargetWays / totalWays;
    }

    // find the unclicked cell with the lowest probability of being a mine
    let bestCell = null;
    let bestProb = 1;

    for (let i = 0; i < height; ++i) {
        for (let j = 0; j < width; ++j) {
            if (cells[i][j] === -1) {
                let prob = probabilityOfBeingMine(i, j);
                if (prob === 0) {
                    console.log('best prob = 0 | best cell =', [i, j]);
                    return [i, j];
                } else if (prob < bestProb) {
                    bestProb = prob;
                    bestCell = [i, j];
                }
            }
        }
    }

    console.log('best prob =', bestProb, '| best cell =', bestCell);
    return bestCell;
}
