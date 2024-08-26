const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const express = require('express');
const open = require('open');

const app = express();
const server = http.createServer(app);
const wsServer = new WebSocket.Server({ server });

const startingPositions = {
    'A-P1': [0, 0], 'A-P2': [0, 1], 'A-H1': [0, 2], 'A-H2': [0, 3], 'A-P3': [0, 4],
    'B-P1': [4, 0], 'B-P2': [4, 1], 'B-H1': [4, 2], 'B-H2': [4, 3], 'B-P3': [4, 4]
};

let currentGameState = {
    pieces: { ...startingPositions },
    currentPlayer: 'A'
};

app.use(express.static(path.join(__dirname, '../client')));

wsServer.on('connection', (clientSocket) => {
    console.log('Client connected');
    clientSocket.send(JSON.stringify({ type: 'INIT', state: currentGameState }));

    clientSocket.on('message', (msg) => {
        const parsedMessage = JSON.parse(msg);
        if (parsedMessage.type === 'MOVE') {
            processMove(parsedMessage, clientSocket);
        } else if (parsedMessage.type === 'RESET') {
            resetGameState();
            sendToAllClients({ type: 'INIT', state: currentGameState });
        }
    });
});

function processMove(moveData, clientSocket) {
    const { from, to } = moveData;
    const selectedPiece = currentGameState.pieces[from];
    
    if (!selectedPiece || !isMoveValid(selectedPiece, from, to)) return;

    if (!isMoveLegal(from, to)) return;

    currentGameState.pieces[to] = currentGameState.pieces[from];
    delete currentGameState.pieces[from];
    currentGameState.currentPlayer = currentGameState.currentPlayer === 'A' ? 'B' : 'A';

    const winningPlayer = determineWinner();
    if (winningPlayer) {
        sendToAllClients({ type: 'WIN', message: winningPlayer });
    } else {
        sendToAllClients({ type: 'UPDATE', state: currentGameState });
    }
}

function isMoveValid(piece, from, to) {
    const pieceType = piece.split('-')[1];
    const [fromRow, fromCol] = from.split('-').map(Number);
    const [toRow, toCol] = to.split('-').map(Number);
    const rowDifference = Math.abs(toRow - fromRow);
    const colDifference = Math.abs(toCol - fromCol);

    if (toRow === fromRow) return false;

    switch (pieceType) {
        case 'P1':
        case 'P2':
        case 'P3':
            return (rowDifference === 1 && colDifference <= 1) || (rowDifference <= 1 && colDifference === 1);
        case 'H1':
            return (rowDifference === 2 && colDifference === 0) || (rowDifference === 0 && colDifference === 2);
        case 'H2':
            return (rowDifference === 2 && colDifference === 2);
        default:
            return false;
    }
}

function isMoveLegal(from, to) {
    const movingPiece = currentGameState.pieces[from];
    const destinationPiece = currentGameState.pieces[to];

    if (!destinationPiece) return true;

    const movingPieceTeam = movingPiece[0];
    const destinationPieceTeam = destinationPiece[0];

    return destinationPieceTeam !== movingPieceTeam;
}

function resetGameState() {
    currentGameState = {
        pieces: { ...startingPositions },
        currentPlayer: 'A'
    };
}

function sendToAllClients(message) {
    wsServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

function determineWinner() {
    const playerAHasPieces = Object.keys(currentGameState.pieces).some(piece => piece.startsWith('A-'));
    const playerBHasPieces = Object.keys(currentGameState.pieces).some(piece => piece.startsWith('B-'));

    if (!playerAHasPieces) return 'Player B Wins!';
    if (!playerBHasPieces) return 'Player A Wins!';
    return null;
}

server.listen(5500, () => {
    console.log('Server is listening on port 5500');
    open('http://localhost:5500');
});


