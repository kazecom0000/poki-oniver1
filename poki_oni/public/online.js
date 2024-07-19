// 設定ファイルを読み込む関数
async function loadConfig() {
    const response = await fetch('config.json');
    const config = await response.json();
    return config;
}

let ws;

async function connectWebSocket() {
    const config = await loadConfig();
    const ip = config.server.ip; // サーバーのIPアドレス
    const port = config.server.port; // ポート番号

    ws = new WebSocket(`ws://${ip}:${port}`);

    ws.onopen = () => {
        console.log('WebSocket接続が確立されました。');
        const createRoomButton = document.getElementById('createRoomButton');
        const joinRoomButton = document.getElementById('joinRoomButton');
        if (createRoomButton && joinRoomButton) {
            createRoomButton.disabled = false;
            joinRoomButton.disabled = false;
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocketエラー:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket接続が閉じられました。再接続を試みます...');
        setTimeout(connectWebSocket, 1000); // 1秒後に再接続を試みる
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
            console.log('参加者が更新されました:', data.participantCount);
            document.getElementById('participantCount').innerText = `参加者数: ${data.participantCount}`;
        } else if (data.type === 'startGame') {
            console.log('ゲームが開始されました。');
        } else if (data.type === 'roomDeleted') {
            alert('部屋が削除されました。ホームにリダイレクトされます。');
            window.location.href = '/';
        }
    };
}

connectWebSocket();

document.getElementById('createRoomButton').addEventListener('click', async () => {
    try {
        const response = await fetch('/create-room', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('サーバーからの応答が正常ではありません');
        }

        const data = await response.json();
        if (data.success) {
            alert(`部屋が作成されました。部屋ID: ${data.roomId}`);
            window.location.href = `/room.html?roomId=${data.roomId}&isHost=true`;
        } else {
            alert('部屋の作成に失敗しました。');
        }
    } catch (error) {
        console.error('エラーが発生しました:', error);
        alert('部屋の作成中にエラーが発生しました。');
    }
});

document.getElementById('joinRoomButton').addEventListener('click', () => {
    const roomId = prompt('参加する部屋のIDを入力してください:');
    if (roomId) {
        joinRoom(roomId);
    }
});

function joinRoom(roomId) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'join', roomId: roomId }));
    } else {
        console.log('WebSocketが開いていません。部屋に参加できません。');
    }
}