// 設定ファイルを読み込む関数
async function loadConfig() {
    const response = await fetch('/config.json'); // 修正: 絶対パスを使用
    const config = await response.json();
    return config;
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeButton = document.getElementById('resumeButton');
const homeButton = document.getElementById('homeButton');

const player = {
    x: canvas.width / 2,
    y: canvas.height - 50,
    width: 50,
    height: 50,
    dx: 5,
    dy: 0,
    gravity: 0.8,
    jumpPower: 15,
    isJumping: false,
    onGround: true,
    moveLeft: false,
    moveRight: false,
    id: null
};

const otherPlayers = {};

const platforms = [
    { x: 100, y: 500, width: 200, height: 20 },
    { x: 400, y: 400, width: 200, height: 20 },
    { x: 700, y: 300, width: 200, height: 20 }
];

let isPaused = false;
let ws;

function drawPlayer() {
    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

function drawOtherPlayers() {
    ctx.fillStyle = 'red';
    for (const id in otherPlayers) {
        const p = otherPlayers[id];
        ctx.fillRect(p.x, p.y, p.width, p.height);
    }
}

function drawPlatforms() {
    ctx.fillStyle = 'green';
    platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function update() {
    if (isPaused) return;

    clearCanvas();
    drawPlatforms();
    drawPlayer();
    drawOtherPlayers();
    handleMovement();
    applyGravity();
    checkPlatformCollision();
    checkBoundaries();
    requestAnimationFrame(update);
}

function applyGravity() {
    if (!player.onGround) {
        player.dy += player.gravity;
        player.y += player.dy;

        if (player.y + player.height > canvas.height) {
            player.y = canvas.height - player.height;
            player.dy = 0;
            player.onGround = true;
        }
    }
}

function handleMovement() {
    if (player.moveRight) {
        player.x += player.dx;
    }
    if (player.moveLeft) {
        player.x -= player.dx;
    }

    if (player.isJumping && player.onGround) {
        player.dy = -player.jumpPower;
        player.onGround = false;
    }

    sendPlayerPosition();
}

function checkPlatformCollision() {
    player.onGround = false;

    platforms.forEach(platform => {
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height <= platform.y &&
            player.y + player.height + player.dy >= platform.y) {
            player.y = platform.y - player.height;
            player.dy = 0;
            player.onGround = true;
        } else if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y >= platform.y + platform.height &&
            player.y + player.dy <= platform.y + platform.height) {
            player.y = platform.y + platform.height;
            player.dy = 0;
        }
    });

    if (player.y + player.height >= canvas.height) {
        player.y = canvas.height - player.height;
        player.dy = 0;
        player.onGround = true;
    }
}

function checkBoundaries() {
    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }
    if (player.y < 0) {
        player.y = 0;
        player.dy = 0;
    }
}

function keyDownHandler(event) {
    if (event.key === 'ArrowRight') {
        player.moveRight = true;
    } else if (event.key === 'ArrowLeft') {
        player.moveLeft = true;
    } else if (event.key === ' ' && player.onGround) {
        player.isJumping = true;
    } else if (event.key === 'Escape') {
        togglePause();
    }
}

function keyUpHandler(event) {
    if (event.key === 'ArrowRight') {
        player.moveRight = false;
    } else if (event.key === 'ArrowLeft') {
        player.moveLeft = false;
    } else if (event.key === ' ') {
        player.isJumping = false;
    }
}

function togglePause() {
    isPaused = !isPaused;
    pauseOverlay.style.display = isPaused ? 'flex' : 'none';
    if (!isPaused) {
        update();
    }
}

async function startGame() {
    const config = await loadConfig();
    document.addEventListener('keydown', keyDownHandler);
    document.addEventListener('keyup', keyUpHandler);
    resumeButton.addEventListener('click', togglePause);
    homeButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    pauseOverlay.style.display = 'none';

    connectWebSocket(config);
    update();
}

function connectWebSocket(config) {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    console.log(`接続する部屋ID: ${roomId}`);
    const { ip, port } = config.server;
    ws = new WebSocket(`ws://${ip}:${port}`);

    ws.onopen = () => {
        console.log('WebSocket接続が確立しました。');
        ws.send(JSON.stringify({ type: 'join', roomId: roomId }));
    };

    ws.onmessage = (message) => {
        const data = JSON.parse(message.data);

        if (data.type === 'join') {
            if (data.roomExists) {
                console.log('部屋に参加しました。プレイヤーID:', data.playerId);
                player.id = data.playerId;
            } else {
                console.log('部屋が存在しません。');
            }
        } else if (data.type === 'new-player') {
            console.log('新しいプレイヤーが参加しました:', data.id);
            otherPlayers[data.id] = { x: data.position.x, y: data.position.y, width: 50, height: 50 };
        } else if (data.type === 'move') {
            if (otherPlayers[data.id]) {
                otherPlayers[data.id].x = data.position.x;
                otherPlayers[data.id].y = data.position.y;
            }
        } else if (data.type === 'player-left') {
            console.log('プレイヤーが切断されました:', data.id);
            delete otherPlayers[data.id];
        }
    };

    ws.onclose = () => {
        console.log('WebSocket接続が切断されました。');
    };

    ws.onerror = (error) => {
        console.error('WebSocketエラーが発生しました:', error);
    };
}

function sendPlayerPosition() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'move', position: { x: player.x, y: player.y } }));
    }
}

startGame();