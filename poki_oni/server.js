const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// 設定ファイルを読み込む関数
function loadConfig() {
    const rawData = fs.readFileSync('config.json');
    return JSON.parse(rawData);
}

const config = loadConfig();
const ip = config.server.ip;
const port = config.server.port;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use('img', express.static(path.join(__dirname, 'img')));
app.use(express.static('public'));

// config.jsonの提供
app.get('/config.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'config.json'));
});

let rooms = [];

// 部屋データの読み込み
const roomsFilePath = path.join(__dirname, 'rooms.json');
if (fs.existsSync(roomsFilePath)) {
    const roomsData = fs.readFileSync(roomsFilePath, 'utf8');
    try {
        rooms = JSON.parse(roomsData);
        if (!Array.isArray(rooms)) {
            rooms = [];
        }
    } catch (error) {
        console.error('部屋データの読み込み中にエラーが発生しました:', error);
        rooms = [];
    }
}

// 部屋データの保存
function saveRooms() {
    fs.writeFileSync(roomsFilePath, JSON.stringify(rooms, null, 2), 'utf8');
}

// 参加者数のブロードキャスト
function broadcastParticipantCount() {
    const participantCount = wss.clients.size;
    const message = JSON.stringify({ type: 'updateParticipants', participantCount });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// WebSocketの接続処理
wss.on('connection', (ws, req) => {
    console.log('新しいクライアントが接続しました。');
    broadcastParticipantCount();

    let currentRoom = null;
    let playerId = null;

    // WebSocketのクローズ処理
    ws.on('close', () => {
        console.log('クライアントが切断されました。');
        if (currentRoom) {
            currentRoom.participants = currentRoom.participants.filter(participant => participant.ws !== ws);
            if (currentRoom.participants.length === 0) {
                const roomIndex = rooms.indexOf(currentRoom);
                if (roomIndex > -1) {
                    rooms.splice(roomIndex, 1);
                    saveRooms();
                }
            } else {
                currentRoom.participants.forEach(participant => {
                    if (participant.ws !== ws && participant.ws.readyState === WebSocket.OPEN) {
                        participant.ws.send(JSON.stringify({ type: 'player-left', id: playerId }));
                    }
                });
            }
        }
        broadcastParticipantCount();
    });

    // WebSocketのメッセージ処理
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'join') {
                const room = rooms.find(r => r.roomId === data.roomId);
                if (room) {
                    playerId = Math.random().toString(36).substr(2, 9);
                    currentRoom = room;
                    room.participants.push({ ws, playerId, position: { x: 0, y: 0 } });
                    ws.send(JSON.stringify({ type: 'join', roomId: data.roomId, roomExists: true, playerId }));

                    // 新しいプレイヤーが参加したことを他の参加者に通知
                    room.participants.forEach(participant => {
                        if (participant.ws !== ws && participant.ws.readyState === WebSocket.OPEN) {
                            participant.ws.send(JSON.stringify({ type: 'new-player', id: playerId, position: { x: 0, y: 0 } }));
                        }
                    });

                    // 既存のプレイヤーの位置情報を新しいプレイヤーに送信
                    room.participants.forEach(participant => {
                        if (participant.ws !== ws) {
                            ws.send(JSON.stringify({ type: 'move', id: participant.playerId, position: participant.position }));
                        }
                    });
                } else {
                    ws.send(JSON.stringify({ type: 'join', roomId: data.roomId, roomExists: false }));
                }
            } else if (data.type === 'leave') {
                if (currentRoom) {
                    currentRoom.participants = currentRoom.participants.filter(participant => participant.ws !== ws);
                    if (currentRoom.participants.length === 0) {
                        const roomIndex = rooms.indexOf(currentRoom);
                        if (roomIndex > -1) {
                            rooms.splice(roomIndex, 1);
                        }
                    }
                    saveRooms();
                }
            } else if (data.type === 'move') {
                if (currentRoom) {
                    const participant = currentRoom.participants.find(p => p.ws === ws);
                    if (participant) {
                        participant.position = data.position;
                        currentRoom.participants.forEach(p => {
                            if (p.ws.readyState === WebSocket.OPEN) {
                                p.ws.send(JSON.stringify({ type: 'move', id: participant.playerId, position: data.position }));
                            }
                        });
                    }
                }
            } else if (data.type === 'startGame') {
                if (currentRoom) {
                    currentRoom.participants.forEach(p => {
                        if (p.ws.readyState === WebSocket.OPEN) {
                            p.ws.send(JSON.stringify({ type: 'startGame' }));
                        }
                    });
                }
            } else if (data.type === 'endGame') {
                if (currentRoom) {
                    currentRoom.participants.forEach(p => {
                        if (p.ws.readyState === WebSocket.OPEN) {
                            p.ws.send(JSON.stringify({ type: 'endGame' }));
                        }
                    });
                }
            }
        } catch (error) {
            console.error('メッセージの処理中にエラーが発生しました:', error);
        }
    });
});

// 部屋の作成エンドポイント
app.post('/create-room', (req, res) => {
    const roomId = generateRoomId();
    const newRoom = {
        roomId: roomId,
        participants: []
    };

    rooms.push(newRoom);
    saveRooms();

    res.json({ success: true, roomId: roomId });
});

// 部屋IDの生成
function generateRoomId() {
    return Math.random().toString(36).substring(2, 10);
}

// サーバーの起動
server.listen(port, ip, () => {
    console.log(`サーバーがポート ${port} で起動しました。`);
});