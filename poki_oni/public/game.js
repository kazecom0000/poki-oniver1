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
    moveRight: false
};

const platforms = [
    { x: 100, y: 500, width: 200, height: 20 },
    { x: 400, y: 400, width: 200, height: 20 },
    { x: 700, y: 300, width: 200, height: 20 }
];

let isPaused = false;

function drawPlayer() {
    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x, player.y, player.width, player.height);
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
}

function checkPlatformCollision() {
    player.onGround = false;

    platforms.forEach(platform => {
        // 上からプラットフォームに衝突する場合
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height <= platform.y &&
            player.y + player.height + player.dy >= platform.y) {
            player.y = platform.y - player.height;
            player.dy = 0;
            player.onGround = true;
        }
        // 下からプラットフォームに衝突する場合
        else if (player.x < platform.x + platform.width &&
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
    const urlParams = new URLSearchParams(window.location.search);
    const gameMode = urlParams.get('mode');
    
    document.addEventListener('keydown', keyDownHandler);
    document.addEventListener('keyup', keyUpHandler);
    resumeButton.addEventListener('click', togglePause);
    homeButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // ゲーム開始時にポーズ画面を非表示にする
    pauseOverlay.style.display = 'none';

    update();
    
    if (gameMode === 'online') {
        console.log('オンラインモードが選択されました。');
        // ここにオンラインモードの処理を追加
        const ws = new WebSocket(`ws://${config.server.ip}:${config.server.port}`);
        
        ws.onopen = () => {
            console.log('オンラインモードのWebSocket接続が確立されました。');
            // 必要な処理を追加
        };

        ws.onerror = (error) => {
            console.error('オンラインモードのWebSocketエラー:', error);
        };

        ws.onclose = () => {
            console.log('オンラインモードのWebSocket接続が閉じられました。');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('メッセージを受信しました:', data);
            // 必要な処理を追加
        };
    } else {
        console.log('オフラインモードが選択されました。');
    }
}

startGame();