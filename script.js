
"use strict";

const canvas = document.querySelector("#game-board");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const highScoreEl = document.querySelector("#high-score");
const levelEl = document.querySelector("#level");
const statusEl = document.querySelector("#status");
const statusDot = document.querySelector("#status-dot");

const overlay = document.querySelector("#overlay");
const messageTitle = document.querySelector("#message-title");
const messageText = document.querySelector("#message-text");
const overlaySymbol = document.querySelector("#overlay-symbol");

const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const soundButton = document.querySelector("#sound-button");
const difficultySelect = document.querySelector("#difficulty");

const CELL = 20;
const GRID = canvas.width / CELL;

const SPEEDS = {
    easy: 175,
    medium: 120,
    hard: 75
};

let snake = [];
let food = { x: 15, y: 10 };
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };

let score = 0;
let highScore = 0;
let gameState = "ready";
let timer = null;
let soundEnabled = true;
let audioContext = null;

try {
    highScore = Number(localStorage.getItem("neonSnakeBest")) || 0;
} catch {
    highScore = 0;
}

highScoreEl.textContent = formatScore(highScore);

function formatScore(value) {
    return String(value).padStart(3, "0");
}

// Sound is created only after a user interaction.
function playSound(frequency = 440, duration = 0.08, type = "sine") {
    if (!soundEnabled) return;

    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(
            frequency,
            audioContext.currentTime
        );

        gain.gain.setValueAtTime(0.07, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch {
        // Gameplay still works if sound is unavailable.
    }
}

function updateStats() {
    scoreEl.textContent = formatScore(score);
    highScoreEl.textContent = formatScore(highScore);
    levelEl.textContent = String(
        Math.floor(score / 50) + 1
    ).padStart(2, "0");
}

function setStatus(text, state = "ready") {
    statusEl.textContent = text;
    statusDot.className = "dot";

    if (state === "paused") {
        statusDot.classList.add("paused");
    }

    if (state === "over") {
        statusDot.classList.add("over");
    }
}

function showOverlay(symbol, title, description, buttonText) {
    overlaySymbol.textContent = symbol;
    messageTitle.textContent = title;
    messageText.textContent = description;
    startButton.textContent = buttonText;
    overlay.classList.remove("hidden");
}

function hideOverlay() {
    overlay.classList.add("hidden");
}

function createFood() {
    const emptyCells = [];

    for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
            const occupied = snake.some(
                part => part.x === x && part.y === y
            );

            if (!occupied) {
                emptyCells.push({ x, y });
            }
        }
    }

    if (emptyCells.length === 0) return null;

    return emptyCells[
        Math.floor(Math.random() * emptyCells.length)
    ];
}

function resetBoard() {
    clearInterval(timer);
    timer = null;

    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];

    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;

    food = createFood();
    updateStats();
    drawGame();
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#060c13";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background grid
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1;

    for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(canvas.width, i * CELL);
        ctx.stroke();
    }

    // Glowing food
    if (food) {
        const fx = food.x * CELL + CELL / 2;
        const fy = food.y * CELL + CELL / 2;

        ctx.save();
        ctx.shadowColor = "#ff3cac";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#ff3cac";
        ctx.beginPath();
        ctx.arc(fx, fy, 6.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff0fa";
        ctx.beginPath();
        ctx.arc(fx - 2, fy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Snake body and head
    snake.forEach((part, index) => {
        const isHead = index === 0;
        const inset = isHead ? 1.5 : 2.5;
        const size = CELL - inset * 2;

        ctx.save();
        ctx.fillStyle = isHead ? "#c8ff72" : "#72e600";
        ctx.shadowColor = "#9dff00";
        ctx.shadowBlur = isHead ? 15 : 5;

        ctx.beginPath();
        ctx.roundRect(
            part.x * CELL + inset,
            part.y * CELL + inset,
            size,
            size,
            4
        );
        ctx.fill();
        ctx.restore();

        if (isHead) {
            drawEyes(part);
        }
    });
}

function drawEyes(head) {
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;

    let eyes;

    if (direction.x === 1) {
        eyes = [[cx + 4, cy - 4], [cx + 4, cy + 4]];
    } else if (direction.x === -1) {
        eyes = [[cx - 4, cy - 4], [cx - 4, cy + 4]];
    } else if (direction.y === -1) {
        eyes = [[cx - 4, cy - 4], [cx + 4, cy - 4]];
    } else {
        eyes = [[cx - 4, cy + 4], [cx + 4, cy + 4]];
    }

    ctx.fillStyle = "#132008";

    for (const [x, y] of eyes) {
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
    }
}

function startGame() {
    if (gameState === "playing") return;

    if (gameState === "over") {
        resetBoard();
    }

    gameState = "playing";
    hideOverlay();
    setStatus("SYSTEM ACTIVE", "playing");

    pauseButton.disabled = false;
    pauseButton.innerHTML = "Ⅱ <span>PAUSE</span>";

    clearInterval(timer);
    timer = setInterval(moveSnake, SPEEDS[difficultySelect.value]);

    playSound(620, 0.09);
}

function moveSnake() {
    if (gameState !== "playing") return;

    direction = { ...nextDirection };

    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };

    const eating = food &&
        head.x === food.x &&
        head.y === food.y;

    // The tail moves away on normal moves, so entering its
    // current cell is allowed unless we are eating.
    const bodyToCheck = eating ? snake : snake.slice(0, -1);

    const hitWall =
        head.x < 0 || head.x >= GRID ||
        head.y < 0 || head.y >= GRID;

    const hitSelf = bodyToCheck.some(
        part => part.x === head.x && part.y === head.y
    );

    if (hitWall || hitSelf) {
        endGame();
        return;
    }

    snake.unshift(head);

    if (eating) {
        score += 10;
        playSound(800, 0.09, "triangle");

        if (score > highScore) {
            highScore = score;

            try {
                localStorage.setItem("neonSnakeBest", String(highScore));
            } catch {
                // The high score still works for this session.
            }
        }

        food = createFood();
        updateStats();

        if (!food) {
            drawGame();
            finishGame("BOARD CLEARED!", "You filled every cell. Incredible!");
            return;
        }

        // Increase speed as the score grows.
        clearInterval(timer);
        timer = setInterval(
            moveSnake,
            Math.max(45, SPEEDS[difficultySelect.value] - score / 10)
        );
    } else {
        snake.pop();
    }

    drawGame();
}

function endGame() {
    playSound(180, 0.28, "sawtooth");
    finishGame("GAME OVER", `You scored ${score} points. Ready for another run?`);
}

function finishGame(title, description) {
    clearInterval(timer);
    timer = null;

    gameState = "over";
    pauseButton.disabled = true;

    setStatus("RUN TERMINATED", "over");
    showOverlay("✕", title, description, "PLAY AGAIN →");
}

function pauseGame() {
    if (gameState === "playing") {
        clearInterval(timer);
        timer = null;
        gameState = "paused";

        pauseButton.innerHTML = "▶ <span>RESUME</span>";
        setStatus("GAME PAUSED", "paused");
        showOverlay("Ⅱ", "PAUSED", "Your run is waiting for you.", "RESUME →");
    } else if (gameState === "paused") {
        startGame();
    }
}

function restartGame() {
    resetBoard();
    gameState = "ready";

    pauseButton.disabled = true;
    pauseButton.innerHTML = "Ⅱ <span>PAUSE</span>";

    setStatus("SYSTEM READY");
    showOverlay("▶", "READY PLAYER ONE?", "Grab the neon food. Avoid the walls and yourself.", "START GAME →");
}

function changeDirection(requested) {
    if (gameState === "over") return;

    // Do not allow a 180-degree turn into the snake itself.
    if (
        requested.x === -direction.x &&
        requested.y === -direction.y
    ) {
        return;
    }

    // Compare with the queued direction as well, so rapid
    // keyboard presses cannot reverse the snake between ticks.
    if (
        requested.x === -nextDirection.x &&
        requested.y === -nextDirection.y
    ) {
        return;
    }

    nextDirection = requested;

    if (gameState === "ready") {
        startGame();
    }
}

const directions = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 }
};

document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (directions[key]) {
        event.preventDefault();
        changeDirection(directions[key]);
    }

    if (key === " " || key === "escape") {
        if (gameState === "playing" || gameState === "paused") {
            event.preventDefault();
            pauseGame();
        }
    }

    if (key === "enter" &&
        (gameState === "ready" || gameState === "over")) {
        startGame();
    }
});

// Touch controls
document.querySelectorAll("[data-dir]").forEach(button => {
    const map = {
        up: directions.arrowup,
        down: directions.arrowdown,
        left: directions.arrowleft,
        right: directions.arrowright
    };

    button.addEventListener("pointerdown", event => {
        event.preventDefault();
        changeDirection(map[button.dataset.dir]);
    });
});

startButton.addEventListener("click", () => {
    if (gameState === "paused") {
        startGame();
    } else {
        startGame();
    }
});

pauseButton.addEventListener("click", pauseGame);
restartButton.addEventListener("click", restartGame);

soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundButton.innerHTML = soundEnabled
        ? "♫ <span>SOUND ON</span>"
        : "♫ <span>SOUND OFF</span>";

    soundButton.setAttribute("aria-pressed", String(soundEnabled));

    if (soundEnabled) {
        playSound(500, 0.08);
    }
});

difficultySelect.addEventListener("change", () => {
    if (gameState === "playing") {
        clearInterval(timer);
        timer = setInterval(
            moveSnake,
            Math.max(45, SPEEDS[difficultySelect.value] - score / 10)
        );
    }
});

// Initial state: draw the board but do not start the timer.
resetBoard();
