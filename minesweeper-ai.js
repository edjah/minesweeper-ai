let canvas = document.getElementById('minesweeper-canvas');

function Minesweeper(width=6, height=11, mineDensity=0.15) {
    this.height = height;
    this.width = width;

    this.numMines = Math.floor(mineDensity * width * height);
    this.unflaggedMines = this.numMines;
    this.runtime = 0;

    this.cells = null;
    this.gameActive = true;
    this.finalMine = null;

    // for rendering and event handling
    this.reComputeSizes = function() {
        // TODO: make canvas.width and canvas.height dependent on window size
        this.cellSize = Math.floor(Math.min(
            (canvas.width - 10) / this.width,
            (canvas.height - 20) / this.height,
        ));

        this.paddingY = (canvas.height - this.cellSize * this.height) / 2;
        this.paddingX = (canvas.width - this.cellSize * this.width) / 2;
    }

    this.reComputeSizes();
    window.onresize = () => this.reComputeSizes;

    // add an event listener for the canvas
    canvas.onmouseup = (event) => {
        window.event = event;
        let row = Math.floor((event.offsetY - this.paddingY) / this.cellSize);
        let col = Math.floor((event.offsetX - this.paddingX) / this.cellSize);
        if (row >= 0 && row < this.height && col >= 0 && col < this.width) {
            let flagToggle = event.which === 3;
            this.clickCell(row, col, flagToggle);
        }
    };


    this.adjacentCoords = function(row, col) {
        let result = [];
        for (let i = -1; i <= 1; ++i) {
            for (let j = -1; j <= 1; ++j) {
                if ((i !== 0 || j !== 0)  &&
                    (0 <= row + i && row + i < this.height) &&
                    (0 <= col + j && col + j < this.width)) {
                    result.push([row + i, col + j]);
                }
            }
        }
        return result;
    }

    this.setup = function(first_click) {
        let [first_click_y, first_click_x] = first_click;

        // creating an empty 2d array.
        this.cells = [];
        for (let i = 0; i < this.height; ++i) {
            let row = [];
            for (let j = 0; j < this.width; ++j) {
                row.push({ value: 0, status: 'hidden' });
            }
            this.cells.push(row);
        }

        // filling the array with mines
        for (let n = 0; n < this.numMines; ++n) {
            while (true) {
                let row = Math.floor(Math.random() * this.height);
                let col = Math.floor(Math.random() * this.width);

                if (row === first_click_y && col === first_click_x) {
                    continue;
                }

                if (this.cells[row][col].value === 0) {
                    this.cells[row][col].value = -1;
                    break;
                }
            }
        }

        // computing the counts for every cell
        for (let i = 0; i < this.height; ++i) {
            for (let j = 0; j < this.width; ++j) {
                if (this.cells[i][j].value === 0) {
                    for (let [y, x] of this.adjacentCoords(i, j)) {
                        this.cells[i][j].value += (this.cells[y][x].value === -1);
                    }
                }
            }
        }

        // starting the timer
        this.runtime = 0;
        this.runtimeInterval = setInterval(() => {
            this.runtime += 1;
            this.render();
        }, 1000);

        // setting the number of unflagged mines
        this.unflaggedMines = this.numMines;
    }

    this.clickCell = function(row, col, flagToggle) {
        if (!this.gameActive) {
            return;
        }

        if (this.cells === null) {
            this.setup([row, col]);
        }

        if (flagToggle && this.cells[row][col].status === 'hidden') {
            this.cells[row][col].status = 'flag';
            this.unflaggedMines -= 1;
        } else if (flagToggle && this.cells[row][col].status === 'flag') {
            this.cells[row][col].status = 'hidden';
            this.unflaggedMines += 1;
        } else if (!flagToggle && this.cells[row][col].status === 'hidden') {
            this.cells[row][col].status = 'visible';

            if (this.cells[row][col].value === 0) {
                this.revealConnectedBlanks(row, col);
            }
        }


        if (!flagToggle && this.cells[row][col].value === -1) {
            this.finalMine = [row, col];
            setTimeout(() => this.gameLost());
        }

        this.render();

        // check game victory
        let allRevealed = true;
        for (let i = 0; i < this.height; ++i) {
            for (let j = 0; j < this.width; ++j) {
                let { value, status } = this.cells[i][j];
                if (value >= 0 && status !== 'visible') {
                    allRevealed = false;
                }
            }
        }

        if (allRevealed) {
            setTimeout(() => this.gameWon());
        }
    }

    this.revealConnectedBlanks = function(row, col) {
        const dfs = (row, col, seen) => {
            let key = row + '' + col;
            if (seen.has(key)) {
                return;
            }

            seen.add(key);

            for (let [y, x] of this.adjacentCoords(row, col)) {
                let { value, status } = this.cells[y][x];

                if (status !== 'flag') {
                    this.cells[y][x].status = 'visible';
                }

                if (value === 0 && status !== 'flag') {
                    dfs(y, x, seen);
                }
            }
        }

        dfs(row, col, new Set());
    }

    this.render = function() {
        // rendering the number of flags
        document.getElementById('num-bombs').innerHTML = this.unflaggedMines;

        // rendering the timer
        let [min, sec] = [Math.floor(this.runtime / 60), this.runtime % 60];
        let timer = min + ':' + (sec < 10 ? '0' + sec : sec);
        document.getElementById('timer').innerHTML = timer;

        // rendering the grid
        canvas.width = canvas.width;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.font = Math.floor(this.cellSize / 2) + "px monospace";
        ctx.strokeStyle = '#000000';
        ctx.textAlign = 'center';

        const s = this.cellSize;

        // add a red box around the final mine if there is one
        if (this.finalMine !== null) {
            let y = this.paddingY + this.finalMine[0] * s;
            let x = this.paddingX + this.finalMine[1] * s;

            ctx.fillStyle = '#cc0000';
            ctx.rect(x, y, s, s);
            ctx.fill();
        }

        // render the rest of the boxes
        for (let i = 0; i < this.height; ++i) {
            for (let j = 0; j < this.width; ++j) {
                let y = this.paddingY + i * s;
                let x = this.paddingX + j * s;

                ctx.lineWidth = 1;
                ctx.rect(x, y, s, s);
                ctx.stroke();

                if (this.cells !== null) {
                    if (this.cells[i][j].status === 'flag') {
                        // render a flag
                        ctx.beginPath();
                        ctx.lineWidth = 2;
                        ctx.fillStyle = "#cc0000";

                        ctx.moveTo(x + 1/3 * s, y + 11/30 * s);
                        ctx.lineTo(x + 2/3 * s, y + 1/5 * s);
                        ctx.lineTo(x + 2/3 * s, y + 8/15 * s);
                        ctx.lineTo(x + 1/3 * s, y + 11/30 * s);
                        ctx.fill();

                        ctx.moveTo(x + 2/3 * s, y + 8/15 * s);
                        ctx.lineTo(x + 2/3 * s, y + 11/15 * s);
                        ctx.lineTo(-5 + x + 2/3 * s, y + 11/15 * s);
                        ctx.lineTo(5 + x + 2/3 * s, y + 11/15 * s);
                        ctx.stroke();

                        // draw an X over incorrect flags if game over
                        if (!this.gameActive && this.cells[i][j].value !== -1) {
                            ctx.moveTo(x + 1/6 * s, y + 1/6 * s);
                            ctx.lineTo(x + 5/6 * s, y + 5/6 * s);
                            ctx.moveTo(x + 5/6 * s, y + 1/6 * s);
                            ctx.lineTo(x + 1/6 * s, y + 5/6 * s);
                            ctx.stroke();
                        }

                    } else if (this.cells[i][j].status === 'visible') {
                        if (this.cells[i][j].value === -1) {
                            // render a mine
                            ctx.beginPath();
                            ctx.fillStyle = "#000000";
                            ctx.arc(x + s/2, y + s/2, 1/6*s, 0, 2 * Math.PI);
                            ctx.fill();

                            // render the mine spikes
                            for (let phi = 0; phi < 2 * Math.PI; phi += Math.PI / 4) {
                                let dx = Math.sin(phi) * 1/4*s;
                                let dy = Math.cos(phi) * 1/4*s;
                                ctx.moveTo(x + s/2, y + s/2);
                                ctx.lineTo(x + s/2 + dx, y + s/2 + dy);
                            }
                            ctx.stroke();

                        } else {
                            ctx.beginPath();
                            ctx.fillStyle = "#EEEEEE";
                            ctx.rect(x, y, s, s);
                            ctx.fill();

                            const numberColors = {
                                0: '#EEEEEE',
                                1: '#0000FF',
                                2: '#00FF00',
                                3: '#0000FF',
                                4: '#800080',
                                5: '#800000',
                                6: '#40E0D0',
                                7: '#000000',
                                8: '#808080',
                            };

                            ctx.fillStyle = numberColors[this.cells[i][j].value];
                            ctx.fillText(this.cells[i][j].value, x + 1/2*s, y + 3/4*s);
                        }
                    }
                }
            }
        }
    }

    this.gameWon = function() {
        clearInterval(this.runtimeInterval);
        this.gameActive = false;

        // flag all mine cells
        for (let i = 0; i < this.height; ++i) {
            for (let j = 0; j < this.width; ++j) {
                if (this.cells[i][j].value === -1) {
                    this.cells[i][j].status = 'flag';
                }
            }
        }

        this.render();
        setTimeout(() => alert('You won!'), 100);
    }

    this.gameLost = function() {
        clearInterval(this.runtimeInterval);
        this.gameActive = false;

        // reveal all non-flagged cells
        for (let i = 0; i < this.height; ++i) {
            for (let j = 0; j < this.width; ++j) {
                if (this.cells[i][j].status !== 'flag') {
                    this.cells[i][j].status = 'visible';
                }
            }
        }

        this.render();
        setTimeout(() => alert('You lost!'), 100);
    }

    this.render();
}


// global game state
let width = 6;
let height = 12;
let density = 0.1;

let game = new Minesweeper(width, height, density);

function setupNewGame() {
    // clear intervals and remove event listeners
    canvas.parentNode.replaceChild(canvas.cloneNode(true), canvas);
    canvas = document.getElementById('minesweeper-canvas');
    clearInterval(game.runtimeInterval);

    // set up a new game
    game = new Minesweeper(width, height, density);
}

document.getElementById('new-game-button').onclick = function() {
    setupNewGame();
}

document.getElementById('settings-button').onclick = function() {
    document.getElementById('settings-modal').style.display = 'flex';
};

document.getElementById('settings-close').onclick = function() {
    document.getElementById('settings-modal').style.display = 'none';
};

document.getElementById('settings-size').oninput = function(e) {
    width = e.target.valueAsNumber;
    height = width * 2;
    setupNewGame();
}

document.getElementById('settings-density').oninput = function(e) {
    density = e.target.valueAsNumber;
    setupNewGame();
}
