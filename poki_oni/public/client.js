// 設定ファイルを読み込む関数
async function loadConfig() {
    const response = await fetch('/config.json'); // 修正: 絶対パスを使用
    const config = await response.json();
    return config;
}

document.addEventListener('DOMContentLoaded', async () => {
    const createRoomButton = document.getElementById('createRoomButton');
    const joinRoomButton = document.getElementById('joinRoomButton');
    const startGameButton = document.getElementById('startGameButton');
    const participantCountElement = document.getElementById('participantCount');
    const statusElement = document.getElementById('status');

    let ws;
    let roomId;

    // 設定ファイルを読み込む
    const config = await loadConfig();

    createRoomButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/create-room', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('サーバーからの応答が正常ではありません');
            }

            const data = await response.json();
            if (data.success) {
                roomId = data.roomId;
                statusElement.textContent = `部屋が作成されました。部屋ID: ${roomId}`;
                startWebSocket();
            } else {
                alert('部屋の作成に失敗しました。');
            }
        } catch (error) {
            console.error('エラーが発生しました:', error);
            alert('部屋の作成中にエラーが発生しました。');
        }
    });

    joinRoomButton.addEventListener('click', () => {
        roomId = prompt('参加したい部屋のIDを入力してください:');
        if (roomId) {
            startWebSocket();
        }
    });

    startGameButton.addEventListener('click', () => {
        if (ws && roomId) {
            ws.send(JSON.stringify({ type: 'startGame', roomId: roomId }));
        }
    });

    async function startWebSocket() {
        const { ip, port } = config.server;

        ws = new WebSocket(`ws://${ip}:${port}`);

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'join', roomId: roomId }));
            startGameButton.disabled = false;
        };

        ws.onerror = (error) => {
            console.error('WebSocketエラー:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket接続が閉じられました。再接続を試みます...');
            startGameButton.disabled = true;
            setTimeout(startWebSocket, 1000); // 1秒後に再接続を試みる
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'create') {
                console.log('部屋が作成されました。ID:', data.roomId);
                window.location.href = `/room.html?roomId=${data.roomId}&isHost=true`;
            } else if (data.type === 'join') {
                if (data.roomExists) {
                    window.location.href = `/room.html?roomId=${data.roomId}&isHost=false`;
                } else {
                    alert('部屋が存在しません。もう一度IDを入力してください。');
                }
            } else if (data.type === 'updateParticipants') {
                participantCountElement.textContent = `参加者数: ${data.participantCount}`;
            } else if (data.type === 'startGame') {
                statusElement.textContent = 'ゲームが開始されました！';
                startGame();
            } else if (data.type === 'roomDeleted') {
                alert('部屋が削除されました。ホームにリダイレクトされます。');
                window.location.href = '/';
            }
        };
    }

    function startGame() {
        // ゲームを開始するためのロジックをここに追加します。
        // 例えば、ゲームステージを表示したり、ゲームロジックを初期化したりします。
        window.location.href = `/onlinegame/online.html?roomId=${roomId}`;
    }

    function joinRoom(roomId) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'join', roomId: roomId }));
        } else {
            console.log('WebSocketが開いていません。部屋に参加できません。');
        }
    }

    // WebSocket接続の開始
    startWebSocket();
});