document.addEventListener('DOMContentLoaded', function () {
    const gameBoard = document.querySelector('.container');
    const gameBoxes = Array.from(document.querySelectorAll('.box'));
    let activeBox = null;
    let currentPlayer = 'A';

    const socket = new WebSocket('ws://localhost:5500');

    socket.addEventListener('message', function (event) {
        const messageData = JSON.parse(event.data);
        switch (messageData.type) {
            case 'INIT':
                setupBoard(messageData.state);
                break;
            case 'UPDATE':
                refreshBoard(messageData.state);
                break;
            case 'WIN':
                showWinMessage(messageData.message);
                break;
        }
    });

    function setupBoard(state) {
        gameBoxes.forEach(box => {
            box.textContent = '';
            box.removeAttribute('data-piece');
        });
        for (const piece in state.pieces) {
            const [row, col] = state.pieces[piece];
            const boxIndex = row * 5 + col;
            gameBoxes[boxIndex].textContent = piece;
            gameBoxes[boxIndex].setAttribute('data-piece', piece);
        }

        if (state.turn) {
            document.querySelector('.turn-indicator').textContent = `Player ${state.turn}'s Turn`;
            currentPlayer = state.turn;
        } else {
            document.querySelector('.turn-indicator').textContent = 'Any player can start';
        }
    }

    function refreshBoard(state) {
        setupBoard(state);
    }

    function validateMove(fromIndex, toIndex, piece) {
        const pieceType = piece.split('-')[1];
        const fromRow = Math.floor(fromIndex / 5);
        const fromCol = fromIndex % 5;
        const toRow = Math.floor(toIndex / 5);
        const toCol = toIndex % 5;
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

    function removeHighlights() {
        gameBoxes.forEach(box => box.classList.remove('highlight'));
    }

    function highlightAvailableMoves(piece) {
        const boxIndex = gameBoxes.indexOf(activeBox);
        gameBoxes.forEach((box, i) => {
            if (validateMove(boxIndex, i, piece) && isMoveValid(boxIndex, i)) {
                box.classList.add('highlight');
            }
        });
    }

    function isMoveValid(fromIndex, toIndex) {
        const movingPiece = gameBoxes[fromIndex].getAttribute('data-piece');
        const targetPiece = gameBoxes[toIndex].getAttribute('data-piece');

        if (!targetPiece) return true;

        const targetPieceTeam = targetPiece[0];
        const movingPieceTeam = movingPiece[0];

        return targetPieceTeam !== movingPieceTeam;
    }

    function transferPiece(fromBox, toBox) {
        toBox.textContent = fromBox.textContent;
        toBox.setAttribute('data-piece', fromBox.getAttribute('data-piece'));
        fromBox.textContent = '';
        fromBox.removeAttribute('data-piece');
    }

    function changeTurn() {
        // Check if there are any pieces left for Player A or Player B
        const playerAPieces = gameBoxes.some(box => box.getAttribute('data-piece')?.startsWith('A'));
        const playerBPieces = gameBoxes.some(box => box.getAttribute('data-piece')?.startsWith('B'));

        if (!playerAPieces) {
            socket.send(JSON.stringify({ type: 'WIN', message: 'Player B Wins!' }));
            showWinMessage('Player B Wins!');
            return;
        }
        
        if (!playerBPieces) {
            socket.send(JSON.stringify({ type: 'WIN', message: 'Player A Wins!' }));
            showWinMessage('Player A Wins!');
            return;
        }

        currentPlayer = (currentPlayer === 'A') ? 'B' : 'A';
        document.querySelector('.turn-indicator').textContent = `Player ${currentPlayer}'s Turn`;
    }

    function showWinMessage(message) {
        let winNotification = document.querySelector('.win-message');
        if (winNotification) {
            winNotification.textContent = message;
        } else {
            winNotification = document.createElement('div');
            winNotification.className = 'win-message';
            winNotification.textContent = message;
            winNotification.style.position = 'fixed';
            winNotification.style.top = '50%';
            winNotification.style.left = '50%';
            winNotification.style.transform = 'translate(-50%, -50%)';
            winNotification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            winNotification.style.color = 'white';
            winNotification.style.padding = '20px';
            winNotification.style.fontSize = '24px';
            winNotification.style.borderRadius = '10px';
            winNotification.style.zIndex = '1000';
            document.body.appendChild(winNotification);
        }
    }

    gameBoard.addEventListener('click', function (event) {
        const clickedBox = event.target;

        if (!clickedBox.classList.contains('box')) return;

        if (activeBox) {
            const activePiece = activeBox.getAttribute('data-piece');
            const clickedPiece = clickedBox.getAttribute('data-piece');

            if (clickedBox === activeBox) {
                removeHighlights();
                activeBox = null;
                return;
            }

            if (activePiece && validateMove(gameBoxes.indexOf(activeBox), gameBoxes.indexOf(clickedBox), activePiece) && isMoveValid(gameBoxes.indexOf(activeBox), gameBoxes.indexOf(clickedBox))) {
                transferPiece(activeBox, clickedBox);
                socket.send(JSON.stringify({ type: 'MOVE', from: activeBox.getAttribute('data-piece'), to: clickedBox.getAttribute('data-piece') }));
                activeBox = null;
                removeHighlights();
                changeTurn();
            } else {
                removeHighlights();
                activeBox = null;
            }
        } else {
            if (clickedBox.getAttribute('data-piece') && clickedBox.getAttribute('data-piece')[0] === currentPlayer) {
                activeBox = clickedBox;
                highlightAvailableMoves(activeBox.getAttribute('data-piece'));
            }
        }
    });
});



